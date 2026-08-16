import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { convertRecording, processRecording } from '../electron/pipeline.mjs';
import { pathsConfig } from '../electron/config.mjs';

const ffmpegPath = pathsConfig.ffmpegPath;
const sampleWav = 'C:\\Calin\\Whisper\\whisper.cpp\\samples\\jfk.wav';

async function runFfmpeg(args) {
  await new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { windowsHide: true, stdio: 'ignore' });
    proc.on('error', reject);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
  });
}

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'echoreport-test-'));
const webmPath = path.join(tempDir, 'test.webm');

try {
  await runFfmpeg(['-y', '-i', sampleWav, '-c:a', 'libopus', webmPath]);
  const bytes = await readFile(webmPath);

  console.log('--- Conversion test ---');
  const converted = await convertRecording(Uint8Array.from(bytes), 'audio/webm;codecs=opus');
  console.log('Original:', converted.original);
  console.log('Converted:', converted.converted);

  if (pathsConfig.modelPath && await import('node:fs').then((fs) => fs.existsSync(pathsConfig.modelPath))) {
    console.log('--- Full transcription test ---');
    const result = await processRecording(Uint8Array.from(bytes), 'audio/webm;codecs=opus');
    console.log('Transcript:', result.transcript);
  } else {
    console.log('--- Skipping transcription: model not found at', pathsConfig.modelPath);
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
