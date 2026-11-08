// Speech recognition engines for the dictation benchmark
// (npm run eval:dictation -- --engine=<name>). Dev tools only: the app itself
// runs whisper through electron/transcription.cts.
//
// The alternative engines run on sherpa-onnx (k2-fsa, Apache-2.0). Their files
// are local and git-ignored, like whisper's; `node scripts/setup-asr-engines.mjs`
// downloads sherpa-onnx and the Parakeet v3 model:
//   app/bin/sherpa-onnx/sherpa-onnx-offline.exe (+ its DLLs): the Windows x64
//     release from github.com/k2-fsa/sherpa-onnx/releases
//   app/models/parakeet-tdt-0.6b-v3-int8/: NVIDIA Parakeet TDT 0.6B v3
//     (CC-BY-4.0), "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8" from the
//     sherpa-onnx asr-models release
//   app/models/sped-parakeet-ro-110m/: SpeD ParakeetRo 110M (Romanian,
//     huggingface.co/gabrielpirlo/SpeD_ParakeetRo_110M_TDT-CTC), exported once
//     from NeMo to ONNX with sherpa-onnx's NeMo export scripts
//     (scripts/nemo/ in the sherpa-onnx repository). Its weight licence is not
//     stated: benchmark only until the authors confirm it.
// A model folder holds tokens.txt plus either encoder/decoder/joiner*.onnx
// (transducer) or model*.onnx (CTC).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from './dictation-check.mjs';

const SHERPA_CLI = path.join(ROOT, 'app', 'bin', 'sherpa-onnx', 'sherpa-onnx-offline.exe');
// Same thread count as the app's whisper (electron/transcription.cts).
const THREADS = Math.max(4, Math.min(16, os.availableParallelism()));

export const ENGINES = {
  whisper: { label: 'whisper large-v3-turbo' },
  'parakeet-v3': { label: 'Parakeet TDT 0.6B v3', modelDir: path.join(ROOT, 'app', 'models', 'parakeet-tdt-0.6b-v3-int8') },
  'sped-ro': { label: 'SpeD ParakeetRo 110M', modelDir: path.join(ROOT, 'app', 'models', 'sped-parakeet-ro-110m') },
};

// The model files of a sherpa-onnx model folder ("encoder.int8.onnx", ...).
function findModelFile(dir, prefix) {
  const files = fs.readdirSync(dir).filter((file) => file.startsWith(prefix) && file.endsWith('.onnx'));
  // Prefer the int8 build when both are present (smaller and faster on a CPU).
  return files.find((file) => file.includes('int8')) ?? files[0];
}

function sherpaModelArgs(modelDir) {
  if (!fs.existsSync(modelDir)) throw new Error(`model folder missing: ${path.relative(ROOT, modelDir)}`);
  const tokens = path.join(modelDir, 'tokens.txt');
  if (!fs.existsSync(tokens)) throw new Error(`tokens.txt missing in ${path.relative(ROOT, modelDir)}`);
  const encoder = findModelFile(modelDir, 'encoder');
  if (encoder) {
    const decoder = findModelFile(modelDir, 'decoder');
    const joiner = findModelFile(modelDir, 'joiner');
    if (!decoder || !joiner) throw new Error(`decoder/joiner missing in ${path.relative(ROOT, modelDir)}`);
    return [
      `--encoder=${path.join(modelDir, encoder)}`,
      `--decoder=${path.join(modelDir, decoder)}`,
      `--joiner=${path.join(modelDir, joiner)}`,
      `--tokens=${tokens}`,
      '--model-type=nemo_transducer',
    ];
  }
  const model = findModelFile(modelDir, 'model');
  if (!model) throw new Error(`no encoder*.onnx or model*.onnx in ${path.relative(ROOT, modelDir)}`);
  return [`--nemo-ctc-model=${path.join(modelDir, model)}`, `--tokens=${tokens}`];
}

// sherpa-onnx-offline prints each result as a JSON line ({"text": ...}),
// on stderr in current releases; both streams are searched.
function parseSherpaText(output) {
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{') || !trimmed.includes('"text"')) continue;
    try {
      const result = JSON.parse(trimmed);
      if (typeof result.text === 'string') return result.text.trim();
    } catch {
      // Not the result line.
    }
  }
  return null;
}

/** Transcribes a whisper-format WAV (16 kHz mono PCM 16-bit) with a sherpa-onnx model. */
export async function transcribeWithSherpa(wav, modelDir) {
  if (!fs.existsSync(SHERPA_CLI)) throw new Error(`sherpa-onnx missing: ${path.relative(ROOT, SHERPA_CLI)}`);
  const modelArgs = sherpaModelArgs(modelDir);
  // Named like the app's whisper sessions, so the app's startup sweep removes
  // a directory left behind by an interrupted run.
  const sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), `echoreport-${process.pid}-`));
  try {
    const wavPath = path.join(sessionDir, 'recording.wav');
    fs.writeFileSync(wavPath, wav);
    const { code, output } = await new Promise((resolve, reject) => {
      const child = spawn(SHERPA_CLI, [...modelArgs, `--num-threads=${THREADS}`, wavPath], {
        cwd: path.dirname(SHERPA_CLI),
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let text = '';
      child.stdout.on('data', (chunk) => { text += chunk.toString(); });
      child.stderr.on('data', (chunk) => { text += chunk.toString(); });
      child.once('error', reject);
      child.once('close', (exitCode) => resolve({ code: exitCode, output: text }));
    });
    const transcript = parseSherpaText(output);
    if (code !== 0 || transcript === null) {
      const lastLines = output.trim().split(/\r?\n/).slice(-5).join('\n');
      throw new Error(`sherpa-onnx failed (exit code ${code}):\n${lastLines}`);
    }
    return transcript;
  } finally {
    fs.rmSync(sessionDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
