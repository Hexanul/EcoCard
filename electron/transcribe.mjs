import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathsConfig, whisperRuntimeConfig } from './config.mjs';

export class WhisperCliNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WhisperCliNotFoundError';
  }
}

export class WhisperModelNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WhisperModelNotFoundError';
  }
}

export class WhisperTranscriptionFailedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WhisperTranscriptionFailedError';
  }
}

/**
 * Runs local whisper-cli.exe with trusted paths from configuration only.
 *
 * Verified whisper-cli.exe flags (whisper.cpp build on this machine):
 *   -m, --model FNAME
 *   -f, --file FNAME
 *   -l, --language LANG
 *   -nt, --no-timestamps
 *   -otxt, --output-txt
 *   -of, --output-file FNAME   (without extension)
 *
 * Example:
 *   whisper-cli.exe -m ggml-large-v3-turbo.bin -f recording.wav -l ro -nt -otxt -of transcript
 */
export async function transcribeWhisperWav(wavPath, sessionDir) {
  const whisperCliPath = pathsConfig.whisperCliPath;
  const modelPath = pathsConfig.modelPath;

  if (!existsSync(whisperCliPath)) {
    throw new WhisperCliNotFoundError('whisper-cli.exe nu a fost găsit.');
  }

  if (!existsSync(modelPath)) {
    throw new WhisperModelNotFoundError(
      'Modelul Whisper large-v3-turbo nu a fost găsit.',
    );
  }

  const outputPrefix = path.join(sessionDir, 'transcript');
  const outputTxtPath = `${outputPrefix}.txt`;
  const whisperDir = path.dirname(whisperCliPath);

  const args = [
    '-m',
    modelPath,
    '-f',
    wavPath,
    '-l',
    whisperRuntimeConfig.language,
    '-nt',
    '-otxt',
    '-of',
    outputPrefix,
  ];

  return new Promise((resolve, reject) => {
    const processRef = spawn(whisperCliPath, args, {
      cwd: whisperDir,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    processRef.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    processRef.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    processRef.on('error', (error) => {
      reject(
        new WhisperTranscriptionFailedError(
          `Transcrierea locală a eșuat: ${error.message}`,
        ),
      );
    });

    processRef.on('close', async (code) => {
      try {
        if (code !== 0) {
          console.error('[Echo Report] whisper-cli stderr:', stderr);
          console.error('[Echo Report] whisper-cli stdout:', stdout);
          reject(new WhisperTranscriptionFailedError('Transcrierea locală a eșuat.'));
          return;
        }

        if (!existsSync(outputTxtPath)) {
          reject(
            new WhisperTranscriptionFailedError(
              'Transcrierea locală a eșuat: fișierul de ieșire lipsește.',
            ),
          );
          return;
        }

        const transcript = (await readFile(outputTxtPath, 'utf8')).trim();
        await unlink(outputTxtPath).catch(() => undefined);

        if (!transcript) {
          reject(
            new WhisperTranscriptionFailedError(
              'Transcrierea locală a eșuat: rezultatul este gol.',
            ),
          );
          return;
        }

        resolve(transcript);
      } catch (error) {
        reject(
          new WhisperTranscriptionFailedError(
            error instanceof Error ? error.message : 'Transcrierea locală a eșuat.',
          ),
        );
      }
    });
  });
}
