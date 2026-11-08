// Downloads the alternative speech recognition engine for the dictation
// benchmark (scripts/asr-engines.mjs, `npm run eval:dictation -- --engine=…`):
// the sherpa-onnx command-line tool and NVIDIA's Parakeet TDT 0.6B v3 model.
// Dev tool only; nothing here ships with the app.
//
//   node scripts/setup-asr-engines.mjs
//
// - sherpa-onnx (k2-fsa, Apache-2.0): its official PyPI wheels (a wheel is a
//   zip, unpacked with Windows' own tar.exe), checked against PyPI's SHA-256,
//   into app/bin/sherpa-onnx/.
// - Parakeet TDT 0.6B v3 int8 (NVIDIA, CC-BY-4.0, ~700 MB): the sherpa-onnx
//   export on Hugging Face, checked against Hugging Face's hashes, into
//   app/models/parakeet-tdt-0.6b-v3-int8/.
// Both folders are git-ignored. Files already present with the right size are
// not downloaded again.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHERPA_VERSION = '2.0.1';
const SHERPA_DIR = path.join(ROOT, 'app', 'bin', 'sherpa-onnx');
// Wheel → files it contributes (the executable needs the core package's DLLs).
const SHERPA_WHEELS = {
  'sherpa-onnx-bin': ['sherpa-onnx-offline.exe'],
  'sherpa-onnx-core': ['onnxruntime.dll', 'sherpa-onnx-c-api.dll', 'sherpa-onnx-cxx-api.dll'],
};
const MODEL_REPO = 'csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8';
const MODEL_DIR = path.join(ROOT, 'app', 'models', 'parakeet-tdt-0.6b-v3-int8');
const MODEL_FILES = ['encoder.int8.onnx', 'decoder.int8.onnx', 'joiner.int8.onnx', 'tokens.txt'];
const WINDOWS_TAR = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

// Streams a download to disk and returns its SHA-256 and git blob SHA-1
// (Hugging Face identifies small files by the latter).
async function download(url, destination, size) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`${url}: HTTP ${response.status}`);
  const total = size || Number(response.headers.get('content-length')) || 0;
  const sha256 = createHash('sha256');
  // The git blob id hashes a "blob <size>\0" header before the content.
  const blobSha1 = createHash('sha1').update(`blob ${total}\0`);
  const partial = `${destination}.part`;
  let received = 0;
  let shown = -1;
  await pipeline(
    Readable.fromWeb(response.body),
    async function* (source) {
      for await (const chunk of source) {
        sha256.update(chunk);
        blobSha1.update(chunk);
        received += chunk.length;
        const percent = total ? Math.floor((received / total) * 100) : 0;
        if (percent >= shown + 10) {
          shown = percent;
          process.stdout.write(`  ${path.basename(destination)}: ${percent} %\r`);
        }
        yield chunk;
      }
    },
    fs.createWriteStream(partial),
  );
  process.stdout.write('\n');
  return { partial, sha256: sha256.digest('hex'), blobSha1: blobSha1.digest('hex') };
}

function accept(partial, destination) {
  fs.renameSync(partial, destination);
}

function reject(partial, name) {
  fs.rmSync(partial, { force: true });
  throw new Error(`${name}: checksum does not match; nothing was kept`);
}

async function setupSherpa() {
  if (Object.values(SHERPA_WHEELS).flat().every((file) => fs.existsSync(path.join(SHERPA_DIR, file)))) {
    console.log(`sherpa-onnx ${SHERPA_VERSION}: already in app/bin/sherpa-onnx/`);
    return;
  }
  fs.mkdirSync(SHERPA_DIR, { recursive: true });
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echoreport-setup-'));
  try {
    for (const [name, files] of Object.entries(SHERPA_WHEELS)) {
      const release = await getJson(`https://pypi.org/pypi/${name}/${SHERPA_VERSION}/json`);
      const wheel = release.urls.find((file) => file.filename.endsWith('-win_amd64.whl'));
      if (!wheel) throw new Error(`${name} ${SHERPA_VERSION}: no Windows x64 wheel on PyPI`);
      console.log(`Downloading ${wheel.filename} from PyPI...`);
      const wheelPath = path.join(workDir, wheel.filename);
      const { partial, sha256 } = await download(wheel.url, wheelPath, wheel.size);
      if (sha256 !== wheel.digests.sha256) reject(partial, wheel.filename);
      accept(partial, wheelPath);
      const unpacked = path.join(workDir, name);
      fs.mkdirSync(unpacked);
      execFileSync(WINDOWS_TAR, ['-xf', wheelPath, '-C', unpacked]);
      const scripts = path.join(unpacked, `${name.replace(/-/g, '_')}-${SHERPA_VERSION}.data`, 'data', 'Scripts');
      for (const file of files) fs.copyFileSync(path.join(scripts, file), path.join(SHERPA_DIR, file));
    }
    console.log(`sherpa-onnx ${SHERPA_VERSION}: installed in app/bin/sherpa-onnx/`);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

async function setupParakeet() {
  fs.mkdirSync(MODEL_DIR, { recursive: true });
  const tree = await getJson(`https://huggingface.co/api/models/${MODEL_REPO}/tree/main`);
  for (const name of MODEL_FILES) {
    const entry = tree.find((item) => item.path === name);
    if (!entry) throw new Error(`${MODEL_REPO}: ${name} not found`);
    const destination = path.join(MODEL_DIR, name);
    if (fs.existsSync(destination) && fs.statSync(destination).size === entry.size) {
      console.log(`  ${name}: already downloaded`);
      continue;
    }
    console.log(`Downloading ${name} (${Math.round(entry.size / 1e6)} MB) from Hugging Face...`);
    const { partial, sha256, blobSha1 } = await download(
      `https://huggingface.co/${MODEL_REPO}/resolve/main/${name}`,
      destination,
      entry.size,
    );
    // Large files are stored with their SHA-256 (LFS), small ones by git blob id.
    const ok = entry.lfs ? sha256 === entry.lfs.oid : blobSha1 === entry.oid;
    if (!ok) reject(partial, name);
    accept(partial, destination);
  }
  console.log('Parakeet TDT 0.6B v3: installed in app/models/parakeet-tdt-0.6b-v3-int8/');
}

if (process.platform !== 'win32') {
  console.error('The benchmark engines are set up for Windows only.');
  process.exit(1);
}
try {
  await setupSherpa();
  await setupParakeet();
  console.log('\nNext: npm run eval:dictation -- --engine=parakeet-v3   then   npm run eval:dictation -- --compare');
} catch (error) {
  console.error(`Setup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
