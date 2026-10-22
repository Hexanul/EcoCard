import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runtimePaths } from './config.cjs';
import type { ConvertedAudio, TranscriptionFailure, TranscriptionResponse } from './shared.cjs';

// A dictation can last up to 30 minutes (the recording failsafe in
// DictationPanel), and whisper may run slower than real time on a slow PC.
const PROCESS_TIMEOUT_MS = 60 * 60 * 1000;
const SESSION_PREFIX = 'echoreport-';
// No session can still be in use after the longest possible whisper run.
const STALE_SESSION_AGE_MS = PROCESS_TIMEOUT_MS + 5 * 60 * 1000;
const failure = (errorCode: TranscriptionFailure['errorCode'], message: string): TranscriptionFailure => ({ success: false, errorCode, message });
const formatBytes = (bytes: number): string => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;

// Session directories hold the recording and its transcript (patient data).
// Tracked so that quitting mid-transcription still removes them.
const activeSessions = new Set<string>();
const activeProcesses = new Set<ChildProcess>();
const sessionRoot = (): string => runtimePaths.tempDir || os.tmpdir();

type ProcessResult = { exitCode: number; stdout: string; stderr: string };

// Windows code integrity (Smart App Control / WDAC) refused to load the
// unsigned whisper-cli.exe or one of its DLLs (ggml*.dll, whisper.dll):
// STATUS_SYSTEM_INTEGRITY_POLICY_VIOLATION and STATUS_INVALID_IMAGE_HASH.
const CODE_INTEGRITY_EXIT_CODES = new Set([0xC0E90002, 0xC0000428]);
function runTrustedProcess(command: string, args: string[], cwd?: string): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    activeProcesses.add(child);
    let stdout = ''; let stderr = ''; let settled = false;
    const complete = (callback: () => void) => { activeProcesses.delete(child); if (!settled) { settled = true; clearTimeout(timeout); callback(); } };
    const timeout = setTimeout(() => { child.kill(); complete(() => reject(Object.assign(new Error('Process timed out.'), { code: 'PROCESS_TIMEOUT' }))); }, PROCESS_TIMEOUT_MS);
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once('error', (error) => complete(() => reject(error)));
    child.once('close', (exitCode) => complete(() => resolve({ exitCode: exitCode ?? -1, stdout, stderr })));
  });
}

// The renderer converts every recording to this exact format (src/audio/
// whisperWav.ts, Chromium's decoders), so the main process only validates it:
// canonical 44-byte header, PCM 16-bit mono 16 kHz, data chunk matching the size.
function inspectWhisperWav(buffer: Buffer): ConvertedAudio | null {
  if (buffer.length <= 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') return null;
  if (buffer.toString('ascii', 12, 16) !== 'fmt ' || buffer.toString('ascii', 36, 40) !== 'data' || buffer.readUInt32LE(40) !== buffer.length - 44) return null;
  const channels = buffer.readUInt16LE(22); const sampleRate = buffer.readUInt32LE(24); const bitDepth = buffer.readUInt16LE(34);
  if (buffer.readUInt16LE(20) !== 1 || channels !== 1 || sampleRate !== 16000 || bitDepth !== 16) return null;
  return { format: 'WAV', codec: 'PCM signed 16-bit', channels: 1, sampleRate: 16000, bitDepth: 16, sizeBytes: buffer.byteLength, sizeFormatted: formatBytes(buffer.byteLength) };
}

function isStorageError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && ['EACCES', 'EPERM', 'ENOSPC'].includes(String(error.code));
}

export async function transcribeAudio(audioBytes: Uint8Array, mimeType: string): Promise<TranscriptionResponse> {
  const wav = Buffer.from(audioBytes.buffer, audioBytes.byteOffset, audioBytes.byteLength);
  const converted = mimeType === 'audio/wav' ? inspectWhisperWav(wav) : null;
  if (!converted) return failure('INVALID_AUDIO', 'Înregistrarea audio nu are formatul așteptat (WAV 16 kHz mono).');
  if (!existsSync(runtimePaths.whisperCliPath)) return failure('WHISPER_CLI_NOT_FOUND', 'whisper-cli.exe nu a fost găsit.');
  if (!existsSync(runtimePaths.modelPath)) return failure('WHISPER_MODEL_NOT_FOUND', 'Modelul Whisper nu a fost găsit.');
  let sessionDirectory: string | undefined;
  try {
    sessionDirectory = await mkdtemp(path.join(sessionRoot(), SESSION_PREFIX));
    activeSessions.add(sessionDirectory);
    const wavPath = path.join(sessionDirectory, 'recording.wav');
    const outputPrefix = path.join(sessionDirectory, 'transcript'); const outputTextPath = `${outputPrefix}.txt`;
    await writeFile(wavPath, wav);
    // -mc 0: don't condition on previous text (stops "Vmax, Vmax, Vmax" loops).
    // VAD skips silences that otherwise make whisper drop whole sentences.
    // Both measured on dictation/recordings; an initial --prompt with the
    // term list did not help and made results worse on its own.
    const vadArgs = existsSync(runtimePaths.vadModelPath) ? ['--vad', '-vm', runtimePaths.vadModelPath] : [];
    const whisper = await runTrustedProcess(runtimePaths.whisperCliPath, ['-m', runtimePaths.modelPath, '-f', wavPath, '-l', 'ro', '-nt', '-mc', '0', ...vadArgs, '-otxt', '-of', outputPrefix], path.dirname(runtimePaths.whisperCliPath));
    if (whisper.exitCode !== 0) {
      console.error(
        `[Echo Report] whisper-cli failed with exit code ${whisper.exitCode} (0x${(whisper.exitCode >>> 0).toString(16).toUpperCase()}):`,
        // stdout is never logged: it can contain transcript text (patient data).
        whisper.stderr || 'No diagnostic output was produced.',
      );
      if (CODE_INTEGRITY_EXIT_CODES.has(whisper.exitCode >>> 0)) {
        return failure('WHISPER_BLOCKED_BY_WINDOWS', 'Windows (Smart App Control) a blocat componentele de transcriere, deoarece nu sunt semnate digital. Contactați furnizorul aplicației.');
      }
      return failure('WHISPER_PROCESS_FAILED', 'Transcrierea locală a eșuat.');
    }
    const transcript = (await readFile(outputTextPath, 'utf8')).trim();
    if (!transcript) return failure('WHISPER_PROCESS_FAILED', 'Transcrierea locală a eșuat.');
    return { success: true, transcript, converted };
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'PROCESS_TIMEOUT') return failure('PROCESS_TIMEOUT', 'Transcrierea locală a depășit timpul permis.');
    if (isStorageError(error)) return failure('TEMPORARY_STORAGE_ERROR', 'Fișierele temporare nu au putut fi procesate local.');
    console.error('[Echo Report] Pipeline failed:', error); return failure('UNKNOWN_ERROR', 'Transcrierea locală a eșuat.');
  } finally {
    if (sessionDirectory) {
      activeSessions.delete(sessionDirectory);
      await rm(sessionDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/** Kills running whisper processes and deletes their session directories; called when the app quits. */
export function abortActiveTranscriptions(): void {
  for (const child of activeProcesses) child.kill();
  for (const directory of activeSessions) {
    // A just-killed whisper may still hold the WAV open for a moment.
    try { rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* removed at the next start */ }
  }
}

/**
 * Deletes session directories left behind by a crash or a killed app (the
 * finally block above never ran). Directories younger than the longest
 * possible run are kept, so another running instance keeps its session.
 */
export async function removeStaleSessionDirectories(): Promise<void> {
  const root = sessionRoot();
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(SESSION_PREFIX))
    .map(async (entry) => {
      const directory = path.join(root, entry.name);
      try {
        if (Date.now() - (await stat(directory)).mtimeMs > STALE_SESSION_AGE_MS) await rm(directory, { recursive: true, force: true });
      } catch { /* in use or already gone */ }
    }));
}
