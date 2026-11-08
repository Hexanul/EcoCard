// Dictation test loop: transcribes new recordings in dictation/recordings/
// with the app's own pipeline — the renderer's Chromium-based WAV conversion
// (scripts/whisper-wav.mjs) and the main process's whisper invocation —
// caches them in dictation/transcripts/, then checks every transcript and
// each script's perfect text against the script's expected values. Each
// recording also gets a word error rate (WER) against the text that was read,
// which measures the speech recognition alone.
//
//   npm run eval:dictation [-- <name-filter>] [--retranscribe] [--all] [--json]
//                          [--engine=whisper|parakeet-v3|sped-ro] [--compare]
//
// --engine benchmarks another speech recognition engine (scripts/
// asr-engines.mjs) on the same WAVs; its transcripts go to the git-ignored
// dictation/transcripts-<engine>/, so the committed whisper transcripts (and
// the lock test) never change. --compare prints, for every recording, the WER,
// the fields the parser gets right and the transcription time of each engine.
//
// Run through npm: the npm script compiles the parser, the audio converter
// and the Electron code first.
import fs from 'node:fs';
import path from 'node:path';
import {
  AUDIO_EXTENSIONS,
  DICTATION_DIR,
  RECORDINGS_DIR,
  TRANSCRIPTS_DIR,
  evaluateTranscript,
  isPassing,
  loadKnownIssues,
  loadScripts,
  loadTranscripts,
  scriptNameFor,
  wordErrorRate,
} from './dictation-check.mjs';
import { ENGINES, transcribeWithSherpa } from './asr-engines.mjs';
import { convertFilesToWhisperWav } from './whisper-wav.mjs';

const flags = new Set();
let filter = '';
let engine = 'whisper';
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--engine') engine = args[++index] ?? '';
  else if (arg.startsWith('--engine=')) engine = arg.slice('--engine='.length);
  else if (arg.startsWith('--')) flags.add(arg);
  else if (!filter) filter = arg;
}
if (!ENGINES[engine]) {
  console.error(`Unknown engine "${engine}"; use one of: ${Object.keys(ENGINES).join(', ')}`);
  process.exit(2);
}
const asJson = flags.has('--json');
const showAll = flags.has('--all');
const compare = flags.has('--compare');
const log = asJson ? () => undefined : (...parts) => console.log(...parts);

const transcriptsDirFor = (name) => (name === 'whisper' ? TRANSCRIPTS_DIR : path.join(DICTATION_DIR, `transcripts-${name}`));
// Transcription seconds per engine and recording (git-ignored).
const TIMINGS_PATH = path.join(DICTATION_DIR, 'timings.json');
const timings = fs.existsSync(TIMINGS_PATH) ? JSON.parse(fs.readFileSync(TIMINGS_PATH, 'utf8')) : {};

const scripts = loadScripts();
const scriptNames = scripts.map((script) => script.name);

async function transcribe(wav) {
  if (engine === 'whisper') {
    const { transcribeAudio } = await import('../dist-electron/transcription.cjs');
    const result = await transcribeAudio(wav, 'audio/wav');
    if (!result.success) throw new Error(`${result.errorCode}: ${result.message}`);
    return result.transcript;
  }
  return transcribeWithSherpa(wav, ENGINES[engine].modelDir);
}

// 1. Transcribe recordings that have no cached transcript for this engine yet.
async function transcribeRecordings() {
  if (!fs.existsSync(RECORDINGS_DIR)) return;
  const transcriptsDir = transcriptsDirFor(engine);
  const recordings = fs
    .readdirSync(RECORDINGS_DIR)
    .filter((file) => AUDIO_EXTENSIONS.includes(path.extname(file).toLowerCase()))
    .filter((file) => file.includes(filter))
    .sort();
  const pending = [];
  for (const file of recordings) {
    const base = path.basename(file, path.extname(file));
    const transcriptPath = path.join(transcriptsDir, `${base}.txt`);
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
  for (const [index, { file, base, transcriptPath }] of pending.entries()) {
    log(`Transcribing ${file} (${ENGINES[engine].label}, may take a few minutes)...`);
    const started = Date.now();
    let transcript;
    try {
      transcript = await transcribe(wavs[index]);
    } catch (error) {
      log(`! ${file}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const seconds = Math.round((Date.now() - started) / 100) / 10;
    fs.mkdirSync(transcriptsDir, { recursive: true });
    fs.writeFileSync(transcriptPath, `${transcript}\n`, 'utf8');
    timings[engine] = { ...timings[engine], [base]: seconds };
    fs.writeFileSync(TIMINGS_PATH, `${JSON.stringify(timings, null, 2)}\n`, 'utf8');
    log(`  -> ${path.relative(DICTATION_DIR, transcriptPath).replace(/\\/g, '/')} (${seconds} s)`);
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

const percent = (value) => `${(value * 100).toFixed(1)} %`;

// Every engine's transcripts of the recordings matching the filter, scored.
function scoreEngine(name) {
  return loadTranscripts(scripts, transcriptsDirFor(name))
    .filter((target) => target.name.includes(filter))
    .flatMap((target) => {
      const script = scripts.find((candidate) => candidate.name === target.script);
      if (!script) return [];
      const evaluation = evaluateTranscript(target.text, script.expected);
      return [{
        name: target.name,
        wer: wordErrorRate(script.text, target.text),
        passed: evaluation.passed,
        total: evaluation.total,
        seconds: timings[name]?.[target.name] ?? null,
      }];
    });
}

function printComparison() {
  const engines = Object.keys(ENGINES).filter((name) => name === 'whisper' || fs.existsSync(transcriptsDirFor(name)));
  const scores = Object.fromEntries(engines.map((name) => [name, scoreEngine(name)]));
  const recordings = [...new Set(engines.flatMap((name) => scores[name].map((score) => score.name)))].sort();
  if (asJson) {
    console.log(JSON.stringify({ engines, scores }, null, 2));
    return;
  }
  const cell = (score) => (score
    ? `${percent(score.wer).padStart(7)} ${`${score.passed}/${score.total}`.padStart(6)} ${(score.seconds === null ? '—' : `${score.seconds} s`).padStart(7)}`
    : '—'.padStart(22));
  const width = Math.max(10, ...recordings.map((name) => name.length));
  log(`\n${'recording'.padEnd(width)}  ${engines.map((name) => name.padEnd(22)).join('  ')}`);
  log(`${''.padEnd(width)}  ${engines.map(() => '    WER fields    time').join('  ')}`);
  for (const recording of recordings) {
    log(`${recording.padEnd(width)}  ${engines.map((name) => cell(scores[name].find((score) => score.name === recording))).join('  ')}`);
  }
  log('\nWER: words wrong against the script that was read (speech recognition alone).');
  log('fields: values the current parser gets right; its aliases are tuned to whisper\'s mistakes.');
}

await transcribeRecordings();

if (compare) {
  printComparison();
} else {
  // Known issues describe the committed whisper transcripts only.
  const knownIssues = engine === 'whisper' ? loadKnownIssues() : {};
  const targets = [
    ...scripts.map((script) => ({ name: `${script.name}.txt (perfect text)`, text: script.text, script: script.name, baseline: true })),
    ...loadTranscripts(scripts, transcriptsDirFor(engine)),
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
    const wer = target.baseline ? null : wordErrorRate(script.text, target.text);
    results.push({ name: target.name, script: script.name, engine, wer, ...evaluation, failures: failures.length, known });

    log(`\n=== ${target.name}  [script: ${script.name}]  ${evaluation.passed}/${evaluation.total} OK${wer === null ? '' : `, WER ${percent(wer)}`}${failures.length ? `, ${failures.length} to fix` : ''}`);
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
    log(`\nSummary: ${results.map((result) => `${result.name} ${result.passed}/${result.total}${result.wer === null ? '' : ` (WER ${percent(result.wer)})`}`).join(' | ') || 'nothing to check'}`);
    log(unresolved === 0 ? 'All checked fields pass.' : `${unresolved} field(s) to fix.`);
    if (!fs.existsSync(RECORDINGS_DIR) || fs.readdirSync(RECORDINGS_DIR).length === 0) {
      log('Tip: record dictation/scripts/standard.txt and save it as dictation/recordings/standard-<date>.m4a');
    }
  }
  // Other engines are benchmarks: their failures are not parser bugs to fix.
  process.exitCode = unresolved === 0 || engine !== 'whisper' ? 0 : 1;
}
