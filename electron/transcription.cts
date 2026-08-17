import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runtimePaths } from './config.cjs';
import type { ConvertedAudio, TranscriptionFailure, TranscriptionResponse } from './shared.cjs';

const PROCESS_TIMEOUT_MS = 10 * 60 * 1000;
const failure = (errorCode: TranscriptionFailure['errorCode'], message: string): TranscriptionFailure => ({ success: false, errorCode, message });
const formatBytes = (bytes: number): string => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`;

function inputExtension(mimeType: string): string | null {
  const type = mimeType.toLowerCase();
  if (type.includes('webm')) return 'webm'; if (type.includes('ogg')) return 'ogg';
  if (type.includes('mp4') || type.includes('m4a')) return 'm4a'; if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
  return type.includes('wav') ? 'wav' : null;
}

type ProcessResult = { exitCode: number; stdout: string; stderr: string };
function runTrustedProcess(command: string, args: string[], cwd?: string): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let settled = false;
    const complete = (callback: () => void) => { if (!settled) { settled = true; clearTimeout(timeout); callback(); } };
    const timeout = setTimeout(() => { child.kill(); complete(() => reject(Object.assign(new Error('Process timed out.'), { code: 'PROCESS_TIMEOUT' }))); }, PROCESS_TIMEOUT_MS);
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once('error', (error) => complete(() => reject(error)));
    child.once('close', (exitCode) => complete(() => resolve({ exitCode: exitCode ?? -1, stdout, stderr })));
  });
}

function inspectWhisperWav(buffer: Buffer): ConvertedAudio | null {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') return null;
  const channels = buffer.readUInt16LE(22); const sampleRate = buffer.readUInt32LE(24); const bitDepth = buffer.readUInt16LE(34);
  if (buffer.readUInt16LE(20) !== 1 || channels !== 1 || sampleRate !== 16000 || bitDepth !== 16) return null;
  return { format: 'WAV', codec: 'PCM signed 16-bit', channels: 1, sampleRate: 16000, bitDepth: 16, sizeBytes: buffer.byteLength, sizeFormatted: formatBytes(buffer.byteLength) };
}

function isStorageError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && ['EACCES', 'EPERM', 'ENOSPC'].includes(String(error.code));
}

export async function transcribeAudio(audioBytes: Uint8Array, mimeType: string): Promise<TranscriptionResponse> {
  const extension = inputExtension(mimeType);
  if (!extension) return failure('INVALID_AUDIO', 'Formatul înregistrării audio nu este acceptat.');
  if (!existsSync(runtimePaths.ffmpegPath)) return failure('FFMPEG_NOT_FOUND', 'FFmpeg nu a fost găsit.');
  if (!existsSync(runtimePaths.whisperCliPath)) return failure('WHISPER_CLI_NOT_FOUND', 'whisper-cli.exe nu a fost găsit.');
  if (!existsSync(runtimePaths.modelPath)) return failure('WHISPER_MODEL_NOT_FOUND', 'Modelul Whisper large-v3-turbo nu a fost găsit.');
  let sessionDirectory: string | undefined;
  try {
    sessionDirectory = await mkdtemp(path.join(runtimePaths.tempDir || os.tmpdir(), 'echoreport-'));
    const inputPath = path.join(sessionDirectory, `source.${extension}`); const wavPath = path.join(sessionDirectory, 'recording.wav');
    const outputPrefix = path.join(sessionDirectory, 'transcript'); const outputTextPath = `${outputPrefix}.txt`;
    await writeFile(inputPath, Buffer.from(audioBytes));
    const ffmpeg = await runTrustedProcess(runtimePaths.ffmpegPath, ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-f', 'wav', wavPath]);
    if (ffmpeg.exitCode !== 0) { console.error('[Echo Report] FFmpeg failed:', ffmpeg.stderr); return failure('FFMPEG_CONVERSION_FAILED', 'Conversia audio locală a eșuat.'); }
    const converted = inspectWhisperWav(await readFile(wavPath));
    if (!converted) return failure('FFMPEG_CONVERSION_FAILED', 'Conversia audio locală a eșuat.');
    const whisper = await runTrustedProcess(runtimePaths.whisperCliPath, ['-m', runtimePaths.modelPath, '-f', wavPath, '-l', 'ro', '-nt', '-otxt', '-of', outputPrefix], path.dirname(runtimePaths.whisperCliPath));
    if (whisper.exitCode !== 0) {
      console.error(
        `[Echo Report] whisper-cli failed with exit code ${whisper.exitCode}:`,
        whisper.stderr || whisper.stdout || 'No diagnostic output was produced.',
      );
      return failure('WHISPER_PROCESS_FAILED', 'Transcrierea locală a eșuat.');
    }
    const transcript = (await readFile(outputTextPath, 'utf8')).trim();
    if (!transcript) return failure('WHISPER_PROCESS_FAILED', 'Transcrierea locală a eșuat.');
    return { success: true, transcript, original: { mimeType, sizeBytes: audioBytes.byteLength, sizeFormatted: formatBytes(audioBytes.byteLength) }, converted };
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'PROCESS_TIMEOUT') return failure('PROCESS_TIMEOUT', 'Transcrierea locală a depășit timpul permis.');
    if (isStorageError(error)) return failure('TEMPORARY_STORAGE_ERROR', 'Fișierele temporare nu au putut fi procesate local.');
    console.error('[Echo Report] Pipeline failed:', error); return failure('UNKNOWN_ERROR', 'Transcrierea locală a eșuat.');
  } finally {
    if (sessionDirectory) await rm(sessionDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
