// Dictation test loop: transcribes new recordings in dictation/recordings/
// with the app's own pipeline — the renderer's Chromium-based WAV conversion
// (scripts/whisper-wav.mjs) and the main process's whisper invocation —
// caches them in dictation/transcripts/, then checks every transcript and
// each script's perfect text against the script's expected values.
//
//   npm run eval:dictation [-- <name-filter>] [--retranscribe] [--all] [--json]
//
// Run through npm: the npm script compiles the parser, the audio converter
// and the Electron code first.
import fs from 'node:fs';
import path from 'node:path';
import {
  AUDIO_EXTENSIONS,
  RECORDINGS_DIR,
  TRANSCRIPTS_DIR,
  evaluateTranscript,
  isPassing,
  loadKnownIssues,
  loadScripts,
  loadTranscripts,
  scriptNameFor,
} from './dictation-check.mjs';
import { convertFilesToWhisperWav } from './whisper-wav.mjs';

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const filter = args.find((arg) => !arg.startsWith('--')) ?? '';
const asJson = flags.has('--json');
const showAll = flags.has('--all');
const log = asJson ? () => undefined : (...parts) => console.log(...parts);

const scripts = loadScripts();
const scriptNames = scripts.map((script) => script.name);

// 1. Transcribe recordings that have no cached transcript yet.
async function transcribeRecordings() {
  if (!fs.existsSync(RECORDINGS_DIR)) return;
  const recordings = fs
    .readdirSync(RECORDINGS_DIR)
    .filter((file) => AUDIO_EXTENSIONS.includes(path.extname(file).toLowerCase()))
    .filter((file) => file.includes(filter))
    .sort();
  const pending = [];
  for (const file of recordings) {
    const base = path.basename(file, path.extname(file));
    const transcriptPath = path.join(TRANSCRIPTS_DIR, `${base}.txt`);
    if (!scriptNameFor(base, scriptNames)) {
      log(`! ${file}: name must start with a script name (${scriptNames.join(', ')}), e.g. standard-2026-10-04.m4a; skipped`);
      continue;
    }
    if (fs.existsSync(transcriptPath) && !flags.has('--retranscribe')) continue;
    pending.push({ file, base, transcriptPath });
  }
  if (pending.length === 0) return;

  // One hidden Electron window converts all pending recordings at once.
  const wavs = await convertFilesToWhisperWav(pending.map(({ file }) => path.join(RECORDINGS_DIR, file)));
  const { transcribeAudio } = await import('../dist-electron/transcription.cjs');
  for (const [index, { file, base, transcriptPath }] of pending.entries()) {
    log(`Transcribing ${file} (local whisper, may take a few minutes)...`);
    const started = Date.now();
    const result = await transcribeAudio(wavs[index], 'audio/wav');
    if (!result.success) {
      log(`! ${file}: ${result.errorCode}: ${result.message}`);
      continue;
    }
    fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
    fs.writeFileSync(transcriptPath, `${result.transcript}\n`, 'utf8');
    log(`  -> dictation/transcripts/${base}.txt (${Math.round((Date.now() - started) / 1000)} s)`);
  }
}

function formatRow(row, known) {
  const mark = known ? 'KNOWN' : row.status;
  const values = row.status === 'OK'
    ? row.expected
    : `expected ${JSON.stringify(row.expected)}, got ${row.actual === null ? '—' : JSON.stringify(row.actual)}`;
  const lines = [`  ${mark.padEnd(9)} ${row.label.padEnd(40)} ${values}`];
  if (row.detail) lines.push(`            ${row.detail}${known ? ` — known: ${known}` : ''}`);
  if (row.excerpt) lines.push(`            text: ${row.excerpt}`);
  return lines.join('\n');
}

await transcribeRecordings();

const knownIssues = loadKnownIssues();
const targets = [
  ...scripts.map((script) => ({ name: `${script.name}.txt (perfect text)`, text: script.text, script: script.name, baseline: true })),
  ...loadTranscripts(scripts),
].filter((target) => target.name.includes(filter));

const results = [];
for (const target of targets) {
  const script = scripts.find((candidate) => candidate.name === target.script);
  if (!script) {
    log(`! ${target.name}: no matching script in dictation/scripts/; skipped`);
    continue;
  }
  const known = target.baseline ? {} : (knownIssues[target.name] ?? {});
  const evaluation = evaluateTranscript(target.text, script.expected);
  const failures = evaluation.rows.filter((row) => !isPassing(row.status) && !known[row.key]);
  results.push({ name: target.name, script: script.name, ...evaluation, failures: failures.length, known });

  log(`\n=== ${target.name}  [script: ${script.name}]  ${evaluation.passed}/${evaluation.total} OK${failures.length ? `, ${failures.length} to fix` : ''}`);
  let section = '';
  for (const row of evaluation.rows) {
    if (!showAll && row.status === 'OK') continue;
    if (row.section !== section) {
      section = row.section;
      log(`  -- ${section}`);
    }
    log(formatRow(row, known[row.key]));
  }
}

const unresolved = results.reduce((sum, result) => sum + result.failures, 0);
if (asJson) {
  console.log(JSON.stringify({ results, unresolved }, null, 2));
} else {
  log(`\nSummary: ${results.map((result) => `${result.name} ${result.passed}/${result.total}`).join(' | ') || 'nothing to check'}`);
  log(unresolved === 0 ? 'All checked fields pass.' : `${unresolved} field(s) to fix.`);
  if (!fs.existsSync(RECORDINGS_DIR) || fs.readdirSync(RECORDINGS_DIR).length === 0) {
    log('Tip: record dictation/scripts/standard.txt and save it as dictation/recordings/standard-<date>.m4a');
  }
}
process.exitCode = unresolved === 0 ? 0 : 1;
