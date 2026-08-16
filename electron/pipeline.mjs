import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { convertToWhisperWav } from './convert.mjs';
import { transcribeWhisperWav } from './transcribe.mjs';
import { createTempSessionDir, cleanupTempSessionDir } from './tempFiles.mjs';
import { parseWavInfo } from './wavInfo.mjs';

function extensionForMimeType(mimeType) {
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  return 'audio';
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Full offline pipeline executed in the Electron main process:
 *   recorded Blob bytes → temp WebM → FFmpeg → WAV → whisper-cli → transcript
 *
 * Temporary files are deleted before returning. No patient audio archive.
 */
export async function convertRecording(audioBytes, mimeType) {
  const sessionDir = await createTempSessionDir();
  const inputExt = extensionForMimeType(mimeType || 'audio/webm');
  const inputPath = path.join(sessionDir, `recording.${inputExt}`);
  const wavPath = path.join(sessionDir, 'recording.wav');

  try {
    await writeFile(inputPath, Buffer.from(audioBytes));

    const original = {
      mimeType: mimeType || 'unknown',
      sizeBytes: audioBytes.byteLength,
      sizeFormatted: formatBytes(audioBytes.byteLength),
    };

    await convertToWhisperWav(inputPath, wavPath);

    const wavBuffer = await readFile(wavPath);
    const wavInfo = parseWavInfo(wavBuffer);

    const converted = {
      ...wavInfo,
      sizeFormatted: formatBytes(wavInfo.sizeBytes),
    };

    return {
      original,
      converted,
      wavBytes: Uint8Array.from(wavBuffer),
    };
  } finally {
    await cleanupTempSessionDir(sessionDir);
  }
}

export async function processRecording(audioBytes, mimeType) {
  const sessionDir = await createTempSessionDir();
  const inputExt = extensionForMimeType(mimeType || 'audio/webm');
  const inputPath = path.join(sessionDir, `recording.${inputExt}`);
  const wavPath = path.join(sessionDir, 'recording.wav');

  try {
    await writeFile(inputPath, Buffer.from(audioBytes));

    const original = {
      mimeType: mimeType || 'unknown',
      sizeBytes: audioBytes.byteLength,
      sizeFormatted: formatBytes(audioBytes.byteLength),
    };

    await convertToWhisperWav(inputPath, wavPath);

    const wavBuffer = await readFile(wavPath);
    const wavInfo = parseWavInfo(wavBuffer);

    const converted = {
      ...wavInfo,
      sizeFormatted: formatBytes(wavInfo.sizeBytes),
    };

    const transcript = await transcribeWhisperWav(wavPath, sessionDir);

    return {
      transcript,
      original,
      converted,
    };
  } finally {
    await cleanupTempSessionDir(sessionDir);
  }
}
