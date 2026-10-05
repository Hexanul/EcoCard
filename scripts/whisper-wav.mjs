// Converts audio files to whisper's WAV format (16 kHz mono PCM 16-bit) with
// the app's own Chromium-based converter, by running
// scripts/whisper-wav-harness.cjs in Electron. Dev tools only; requires
// `tsc -p tsconfig.audio.json` (dist-audio/whisperWav.js) to have run.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import electronPath from 'electron';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HARNESS = path.join(ROOT, 'scripts', 'whisper-wav-harness.cjs');
const CONVERTER = path.join(ROOT, 'dist-audio', 'whisperWav.js');

/** Returns one WAV (Uint8Array) per input file, in order. */
export async function convertFilesToWhisperWav(files) {
  if (files.length === 0) return [];
  if (!fs.existsSync(CONVERTER)) throw new Error('dist-audio/whisperWav.js is missing; run `npx tsc -p tsconfig.audio.json`.');
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echoreport-wav-'));
  try {
    const outputs = files.map((_, index) => path.join(workDir, `${index}.wav`));
    const args = [HARNESS, CONVERTER, ...files.flatMap((file, index) => [path.resolve(file), outputs[index]])];
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const { code, stderr } = await new Promise((resolve, reject) => {
      const child = spawn(electronPath, args, { env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      let errors = '';
      child.stderr.on('data', (chunk) => { errors += chunk.toString(); });
      child.once('error', reject);
      child.once('close', (exitCode) => resolve({ code: exitCode, stderr: errors }));
    });
    if (code !== 0) {
      const reason = stderr.split('\n').find((line) => line.startsWith('whisper-wav-harness:')) ?? `exit code ${code}`;
      throw new Error(`Audio conversion failed: ${reason}`);
    }
    return outputs.map((output) => new Uint8Array(fs.readFileSync(output)));
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}
