import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { pathsConfig } from './config.mjs';

export class FfmpegNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FfmpegNotFoundError';
  }
}

export class AudioConversionFailedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AudioConversionFailedError';
  }
}

/**
 * Converts browser-recorded audio (WebM/Opus, etc.) to Whisper-compatible WAV:
 * PCM signed 16-bit, mono, 16 kHz.
 *
 * Executed only in the Electron main process — never from React.
 */
export async function convertToWhisperWav(inputPath, outputPath) {
  const ffmpegPath = pathsConfig.ffmpegPath;

  if (!existsSync(ffmpegPath)) {
    throw new FfmpegNotFoundError('FFmpeg nu a fost găsit.');
  }

  const args = [
    '-y',
    '-i',
    inputPath,
    '-ar',
    '16000',
    '-ac',
    '1',
    '-c:a',
    'pcm_s16le',
    '-f',
    'wav',
    outputPath,
  ];

  return new Promise((resolve, reject) => {
    const processRef = spawn(ffmpegPath, args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';

    processRef.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    processRef.on('error', (error) => {
      reject(
        new AudioConversionFailedError(
          `Conversia audio a eșuat: ${error.message}`,
        ),
      );
    });

    processRef.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      console.error('[Echo Report] FFmpeg stderr:', stderr);
      reject(new AudioConversionFailedError('Conversia audio a eșuat.'));
    });
  });
}
