import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runtimePaths } from './config.cjs';
import type { TranscriptionFailure, TranscriptionResponse } from './shared.cjs';

// A dictation can last up to 30 minutes (the recording failsafe in
// DictationPanel), and whisper may run slower than real time on a slow PC.
const PROCESS_TIMEOUT_MS = 60 * 60 * 1000;
// After killing a timed-out whisper, how long to wait for it to exit (and let
// go of the recording) before its session directory is deleted anyway.
const KILL_GRACE_MS = 5000;
const SESSION_PREFIX = 'echoreport-';
// Session directories are named echoreport-<pid>-xxxxxx after the process that
// owns them, so a start can tell a crashed run's leftovers from a live session.
const OWNED_SESSION = /^echoreport-(\d+)-/;
// No session can still be in use after the longest possible whisper run.
const STALE_SESSION_AGE_MS = PROCESS_TIMEOUT_MS + 5 * 60 * 1000;
// A file whisper still holds open for a moment (or an antivirus scan) makes rm fail with EBUSY.
const REMOVE_OPTIONS = { recursive: true, force: true, maxRetries: 5, retryDelay: 200 } as const;
const failure = (errorCode: TranscriptionFailure['errorCode'], message: string): TranscriptionFailure => ({ success: false, errorCode, message });

// Session directories hold the recording and its transcript (patient data).
// Tracked so that quitting mid-transcription still removes them.
const activeSessions = new Set<string>();
const activeProcesses = new Set<ChildProcess>();
const sessionRoot = (): string => runtimePaths.tempDir || os.tmpdir();

// Whisper's default is 4 threads. On an 8-core / 16-thread laptop all 16 were
// about 25 % faster, with identical transcripts (dictation/recordings,
// 2026-11-03); beyond 16 there is little to gain. Whisper runs at below-normal
// priority, so the rest of the PC stays responsive while it uses every core.
const WHISPER_THREADS = Math.max(4, Math.min(16, os.availableParallelism()));

// Whisper's tags for stretches without speech ("[BLANK_AUDIO]", "(muzică)").
const NON_SPEECH_TAG = /\[[^\]]*\]|\([^)]*\)/g;

type ProcessResult = { exitCode: number; stdout: string; stderr: string };

// Windows code integrity (Smart App Control / WDAC) refused to load the
// unsigned whisper-cli.exe or one of its DLLs (ggml*.dll, whisper.dll):
// STATUS_SYSTEM_INTEGRITY_POLICY_VIOLATION and STATUS_INVALID_IMAGE_HASH.
const CODE_INTEGRITY_EXIT_CODES = new Set([0xC0E90002, 0xC0000428]);
function runTrustedProcess(command: string, args: string[], cwd?: string): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    activeProcesses.add(child);
    try { if (child.pid !== undefined) os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch { /* keeps normal priority */ }
    let stdout = ''; let stderr = ''; let settled = false; let timedOut = false;
    let graceTimer: ReturnType<typeof setTimeout> | undefined;
    const timeoutError = () => Object.assign(new Error('Process timed out.'), { code: 'PROCESS_TIMEOUT' });
    const complete = (callback: () => void) => {
      activeProcesses.delete(child);
      if (settled) return;
      settled = true; clearTimeout(timeout); clearTimeout(graceTimer); callback();
    };
    // A timed-out whisper is killed, and the result waits for it to exit so the
    // session directory is not deleted while it still holds the recording.
    const timeout = setTimeout(() => {
      timedOut = true; child.kill();
      graceTimer = setTimeout(() => complete(() => reject(timeoutError())), KILL_GRACE_MS);
    }, PROCESS_TIMEOUT_MS);
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once('error', (error) => complete(() => reject(error)));
    child.once('close', (exitCode) => complete(() => (timedOut ? reject(timeoutError()) : resolve({ exitCode: exitCode ?? -1, stdout, stderr }))));
  });
}

// The renderer converts every recording to this exact format (src/audio/
// whisperWav.ts, Chromium's decoders), so the main process only validates it:
// canonical 44-byte header, PCM 16-bit mono 16 kHz, data chunk matching the size.
function isWhisperWav(buffer: Buffer): boolean {
  if (buffer.length <= 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') return false;
  if (buffer.toString('ascii', 12, 16) !== 'fmt ' || buffer.toString('ascii', 36, 40) !== 'data' || buffer.readUInt32LE(40) !== buffer.length - 44) return false;
  const channels = buffer.readUInt16LE(22); const sampleRate = buffer.readUInt32LE(24); const bitDepth = buffer.readUInt16LE(34);
  return buffer.readUInt16LE(20) === 1 && channels === 1 && sampleRate === 16000 && bitDepth === 16;
}

function isStorageError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && ['EACCES', 'EPERM', 'ENOSPC'].includes(String(error.code));
}

export async function transcribeAudio(audioBytes: Uint8Array, mimeType: string): Promise<TranscriptionResponse> {
  const wav = Buffer.from(audioBytes.buffer, audioBytes.byteOffset, audioBytes.byteLength);
  if (mimeType !== 'audio/wav' || !isWhisperWav(wav)) return failure('INVALID_AUDIO', 'Înregistrarea audio nu are formatul așteptat (WAV 16 kHz mono).');
  if (!existsSync(runtimePaths.whisperCliPath)) return failure('WHISPER_CLI_NOT_FOUND', 'whisper-cli.exe nu a fost găsit.');
  if (!existsSync(runtimePaths.modelPath)) return failure('WHISPER_MODEL_NOT_FOUND', 'Modelul Whisper nu a fost găsit.');
  let sessionDirectory: string | undefined;
  try {
    sessionDirectory = await mkdtemp(path.join(sessionRoot(), `${SESSION_PREFIX}${process.pid}-`));
    activeSessions.add(sessionDirectory);
    const wavPath = path.join(sessionDirectory, 'recording.wav');
    const outputPrefix = path.join(sessionDirectory, 'transcript'); const outputTextPath = `${outputPrefix}.txt`;
    await writeFile(wavPath, wav);
    // -mc 0: don't condition on previous text (stops "Vmax, Vmax, Vmax" loops).
    // VAD skips silences that otherwise make whisper drop whole sentences.
    // Both measured on dictation/recordings; an initial --prompt with the
    // term list did not help and made results worse on its own.
    const vadArgs = existsSync(runtimePaths.vadModelPath) ? ['--vad', '-vm', runtimePaths.vadModelPath] : [];
    const whisper = await runTrustedProcess(runtimePaths.whisperCliPath, ['-m', runtimePaths.modelPath, '-f', wavPath, '-l', 'ro', '-nt', '-mc', '0', ...vadArgs, '-t', String(WHISPER_THREADS), '-otxt', '-of', outputPrefix], path.dirname(runtimePaths.whisperCliPath));
    if (whisper.exitCode !== 0) {
      console.error(
        `[Echo Report] whisper-cli failed with exit code ${whisper.exitCode} (0x${(whisper.exitCode >>> 0).toString(16).toUpperCase()}):`,
        // stdout is never logged: it can contain transcript text (patient data).
        whisper.stderr || 'No diagnostic output was produced.',
      );
      if (CODE_INTEGRITY_EXIT_CODES.has(whisper.exitCode >>> 0)) {
        return failure('WHISPER_BLOCKED_BY_WINDOWS', 'Windows (Smart App Control) a blocat componentele de transcriere, deoarece nu sunt semnate digital. Contactați furnizorul aplicației.');
      }
      return failure('WHISPER_PROCESS_FAILED', 'Programul de transcriere s-a oprit cu o eroare. Încercați din nou; dacă se repetă, contactați furnizorul aplicației.');
    }
    const transcript = (await readFile(outputTextPath, 'utf8')).trim();
    if (!transcript.replace(NON_SPEECH_TAG, '').trim()) {
      return failure('NO_SPEECH', 'Nu s-a auzit nicio dictare în înregistrare. Verificați microfonul și dictați din nou.');
    }
    return { success: true, transcript };
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'PROCESS_TIMEOUT') return failure('PROCESS_TIMEOUT', 'Transcrierea locală a depășit timpul permis.');
    if (isStorageError(error)) return failure('TEMPORARY_STORAGE_ERROR', 'Fișierele temporare nu au putut fi procesate local.');
    console.error('[Echo Report] Pipeline failed:', error); return failure('UNKNOWN_ERROR', 'Transcrierea locală a eșuat.');
  } finally {
    if (sessionDirectory) {
      activeSessions.delete(sessionDirectory);
      // A directory that still cannot be removed is deleted at the next start.
      await rm(sessionDirectory, REMOVE_OPTIONS).catch(() => undefined);
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

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to someone else.
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EPERM';
  }
}

/**
 * Deletes session directories left behind by a crash or a killed app (the
 * finally block above never ran): those whose owning process is no longer
 * running, and any older than the longest possible run (also covering a
 * reused process id). A dev tool's live session (eval:dictation) is kept.
 * Directories without an owner (older builds, scripts/whisper-wav.mjs) go
 * only once they are that old.
 */
export async function removeStaleSessionDirectories(): Promise<void> {
  const root = sessionRoot();
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(SESSION_PREFIX))
    .map(async (entry) => {
      const directory = path.join(root, entry.name);
      if (activeSessions.has(directory)) return;
      try {
        const owner = OWNED_SESSION.exec(entry.name);
        const ownerGone = owner !== null && (Number(owner[1]) === process.pid || !isProcessRunning(Number(owner[1])));
        if (ownerGone || Date.now() - (await stat(directory)).mtimeMs > STALE_SESSION_AGE_MS) {
          await rm(directory, REMOVE_OPTIONS);
        }
      } catch { /* in use or already gone; retried at the next start */ }
    }));
}
