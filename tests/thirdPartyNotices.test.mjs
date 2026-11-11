import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { findForbidden, findUnlistedComponents } = require('../scripts/check-package.cjs');

const root = path.resolve(import.meta.dirname, '..');
const notices = readFileSync(path.join(root, 'legal', 'THIRD_PARTY_NOTICES.txt'), 'utf8');

function installedVersion(name) {
  return JSON.parse(readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
}

test('third-party notices name the installed versions of the bundled npm packages', () => {
  for (const [name, label] of [
    ['react', 'React'],
    ['react-dom', 'React DOM'],
    ['scheduler', 'Scheduler'],
    ['electron', 'Electron'],
  ]) {
    const version = installedVersion(name);
    assert.ok(notices.includes(`${label} ${version}`), `notices should mention "${label} ${version}"`);
  }
});

test('third-party notices cover the default model files', () => {
  const config = readFileSync(path.join(root, 'electron', 'config.cts'), 'utf8');
  const models = [...config.matchAll(/'(ggml-[\w.-]+\.bin)'/g)].map((match) => match[1]);
  assert.ok(models.length >= 2, 'expected the whisper and VAD model names in electron/config.cts');
  for (const model of models) assert.ok(notices.includes(model), `notices should list ${model}`);
});

test('the terms point to the third-party notices', () => {
  const terms = readFileSync(path.join(root, 'legal', 'termeni.txt'), 'utf8');
  assert.ok(terms.includes('THIRD_PARTY_NOTICES.txt'));
});

test('package check flags shipped files missing from the notices and forbidden ffmpeg tools', () => {
  const appOutDir = mkdtempSync(path.join(tmpdir(), 'ecocard-package-check-'));
  try {
    const bin = path.join(appOutDir, 'resources', 'app', 'bin');
    mkdirSync(bin, { recursive: true });
    for (const name of ['whisper-cli.exe', 'Whisper.dll', 'parakeet.dll', 'ffmpeg.exe']) {
      writeFileSync(path.join(bin, name), '');
    }

    const unlisted = findUnlistedComponents(appOutDir, notices).map((file) => path.basename(file));
    assert.deepEqual(unlisted.sort(), ['ffmpeg.exe', 'parakeet.dll']);
    assert.deepEqual(findForbidden(appOutDir).map((file) => path.basename(file)), ['ffmpeg.exe']);
  } finally {
    rmSync(appOutDir, { recursive: true, force: true });
  }
});
