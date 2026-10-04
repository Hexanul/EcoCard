import assert from 'node:assert/strict';
import test from 'node:test';
import { DERIVED_MEASUREMENT_KEYS, MEASUREMENT_SECTIONS } from '../dist-parser-tests/src/config/measurementFields.js';
import {
  evaluateTranscript,
  isPassing,
  loadKnownIssues,
  loadScripts,
  loadTranscripts,
} from '../scripts/dictation-check.mjs';

// Regression lock for the dictation test loop (see CLAUDE.md): every reading
// script must parse perfectly as text, and every committed whisper transcript
// must keep passing, except fields listed in dictation/known-issues.json.

const scripts = loadScripts();
const transcripts = loadTranscripts(scripts);
const knownIssues = loadKnownIssues();
const dictatedFields = MEASUREMENT_SECTIONS.flatMap((section) => section.fields)
  .filter((field) => !DERIVED_MEASUREMENT_KEYS.includes(field.key));
const dictatedKeys = dictatedFields.map((field) => field.key);
// A script with "scope": "numeric" dictates only labels and numbers, so it
// covers the measurements that have a unit and skips the qualitative ones.
const numericKeys = dictatedFields.filter((field) => field.unit).map((field) => field.key);

function describeFailures(rows) {
  return rows
    .map((row) => `${row.status} ${row.key}: expected ${JSON.stringify(row.expected)}, got ${JSON.stringify(row.actual)} ${row.detail} ${row.excerpt}`)
    .join('\n');
}

test('there is at least one reading script', () => {
  assert.ok(scripts.length > 0);
});

for (const script of scripts) {
  test(`script "${script.name}" covers every dictated measurement exactly once`, () => {
    const keys = script.expected.scope === 'numeric' ? numericKeys : dictatedKeys;
    assert.deepEqual(Object.keys(script.expected.measurements).sort(), [...keys].sort());
  });

  // "repeatedValues": "<reason>" exempts a script that was already recorded.
  test(`script "${script.name}" uses a unique value for every numeric field`, { skip: script.expected.repeatedValues }, () => {
    const numbers = [
      ...Object.values(script.expected.measurements),
      ...Object.values(script.expected.patient ?? {}),
    ].filter((value) => /^\d+([.,]\d+)?$/.test(value)).map((value) => Number(value.replace(',', '.')));
    const repeated = numbers.filter((value, index) => numbers.indexOf(value) !== index);
    assert.deepEqual(repeated, [], 'repeated values make misplaced values undetectable');
  });

  test(`script "${script.name}" parses perfectly as text`, () => {
    const { rows } = evaluateTranscript(script.text, script.expected);
    const failures = rows.filter((row) => row.status !== 'OK');
    assert.equal(failures.length, 0, describeFailures(failures));
  });
}

for (const transcript of transcripts) {
  test(`transcript "${transcript.name}" still parses`, () => {
    const script = scripts.find((candidate) => candidate.name === transcript.script);
    assert.ok(script, `no script matches transcript name "${transcript.name}"`);
    const known = knownIssues[transcript.name] ?? {};
    const { rows } = evaluateTranscript(transcript.text, script.expected);
    const failures = rows.filter((row) => !isPassing(row.status) && !known[row.key]);
    assert.equal(failures.length, 0, describeFailures(failures));
    const nowPassing = Object.keys(known).filter((key) => rows.find((row) => row.key === key && isPassing(row.status)));
    assert.deepEqual(nowPassing, [], 'these known issues are fixed; remove them from dictation/known-issues.json');
  });
}

test('known issues only refer to existing transcripts', () => {
  const names = new Set(transcripts.map((transcript) => transcript.name));
  assert.deepEqual(Object.keys(knownIssues).filter((name) => !names.has(name)), []);
});
