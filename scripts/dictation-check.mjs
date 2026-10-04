// Shared logic for the dictation test loop: loads reading scripts, cached
// transcripts and known issues from dictation/, and checks a transcript
// against a script's expected values exactly as the review panel would see
// it (parseEchoTranscript + buildDetectedItems). Used by
// scripts/eval-dictation.mjs and tests/dictation.test.mjs.
//
// Requires the compiled parser: `npx tsc -p tsconfig.parser.json`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MEASUREMENT_FIELDS, MEASUREMENT_SECTIONS, DERIVED_MEASUREMENT_KEYS } from '../dist-parser-tests/src/config/measurementFields.js';
import { parseEchoTranscript } from '../dist-parser-tests/src/services/medicalParser.js';
import { buildDetectedItems } from '../dist-parser-tests/src/services/reportState.js';
import { createEmptyMeasurements } from '../dist-parser-tests/src/types/echoReport.js';
import { calculateDerivedMeasurements } from '../dist-parser-tests/src/utils/derivedMeasurements.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DICTATION_DIR = path.join(ROOT, 'dictation');
export const SCRIPTS_DIR = path.join(DICTATION_DIR, 'scripts');
export const RECORDINGS_DIR = path.join(DICTATION_DIR, 'recordings');
export const TRANSCRIPTS_DIR = path.join(DICTATION_DIR, 'transcripts');
export const KNOWN_ISSUES_PATH = path.join(DICTATION_DIR, 'known-issues.json');
export const AUDIO_EXTENSIONS = ['.m4a', '.wav', '.webm', '.ogg', '.mp3'];

const PATIENT_KEYS = ['lastName', 'firstName', 'age', 'weight', 'height'];
const PATIENT_LABELS = { lastName: 'Nume', firstName: 'Prenume', age: 'Vârstă', weight: 'Greutate', height: 'Înălțime' };
const FIELD_ORDER = MEASUREMENT_SECTIONS.flatMap((section) =>
  section.fields.map((field) => ({ key: field.key, section: section.title })),
);
const PASSING = new Set(['OK', 'OK*']);

export function isPassing(status) {
  return PASSING.has(status);
}

/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
export function normalizeText(value) {
  return String(value)
    .toLocaleLowerCase('ro-RO')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function asNumber(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  return Number(trimmed);
}

function sameValue(expected, actual) {
  if (actual === undefined || actual === null) return false;
  const expectedNumber = asNumber(expected);
  if (expectedNumber !== null) {
    const actualNumber = asNumber(actual);
    return actualNumber !== null && Math.abs(actualNumber - expectedNumber) < 1e-9;
  }
  return normalizeText(expected) === normalizeText(actual);
}

/** Script name for a recording/transcript base name: "standard-2026-10-04" -> "standard". */
export function scriptNameFor(baseName, scriptNames) {
  const match = scriptNames
    .filter((name) => baseName === name || baseName.startsWith(`${name}-`))
    .sort((a, b) => b.length - a.length)[0];
  return match ?? null;
}

export function loadScripts() {
  if (!fs.existsSync(SCRIPTS_DIR)) return [];
  return fs
    .readdirSync(SCRIPTS_DIR)
    .filter((file) => file.endsWith('.expected.json'))
    .map((file) => {
      const name = file.slice(0, -'.expected.json'.length);
      const textPath = path.join(SCRIPTS_DIR, `${name}.txt`);
      return {
        name,
        text: fs.readFileSync(textPath, 'utf8'),
        expected: JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, file), 'utf8')),
      };
    });
}

export function loadTranscripts(scripts) {
  if (!fs.existsSync(TRANSCRIPTS_DIR)) return [];
  const names = scripts.map((script) => script.name);
  return fs
    .readdirSync(TRANSCRIPTS_DIR)
    .filter((file) => file.endsWith('.txt'))
    .sort()
    .map((file) => {
      const name = file.slice(0, -'.txt'.length);
      return {
        name,
        path: path.join(TRANSCRIPTS_DIR, file),
        text: fs.readFileSync(path.join(TRANSCRIPTS_DIR, file), 'utf8'),
        script: scriptNameFor(name, names),
      };
    });
}

export function loadKnownIssues() {
  if (!fs.existsSync(KNOWN_ISSUES_PATH)) return {};
  return JSON.parse(fs.readFileSync(KNOWN_ISSUES_PATH, 'utf8'));
}

/** Expected value for every measurement key: dictated ones plus computed ratios. */
export function expectedMeasurements(expected) {
  const dictated = { ...createEmptyMeasurements(), ...expected.measurements };
  const derived = calculateDerivedMeasurements(dictated);
  const result = { ...expected.measurements };
  for (const key of DERIVED_MEASUREMENT_KEYS) {
    if (derived[key] !== '') result[key] = derived[key];
  }
  return result;
}

function excerptAround(text, index, length) {
  const start = Math.max(0, index - 60);
  const end = Math.min(text.length, index + length + 60);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ')}${end < text.length ? '…' : ''}`;
}

// Where a missing field should be in the transcript: first at its expected
// value (numbers are unique in a script), otherwise right after the previous
// field that was detected (its label normally follows that value).
function locate(text, key, expectedValue, itemsByField) {
  const number = asNumber(expectedValue);
  if (number !== null) {
    const [whole, fraction] = String(expectedValue).split(/[.,]/);
    const pattern = fraction
      ? new RegExp(`(?<![\\d.,])${whole}\\s*[.,]\\s*${fraction}(?!\\d)`)
      : new RegExp(`(?<![\\d.,])${whole}(?![\\d]|[.,]\\d)`);
    const match = pattern.exec(text);
    if (match) return { how: 'value', excerpt: excerptAround(text, match.index, match[0].length) };
  }
  // Text values ("normale", "suple") repeat across fields, so they are
  // located by position instead.
  const position = FIELD_ORDER.findIndex((field) => field.key === key);
  for (let i = position - 1; i >= 0; i -= 1) {
    const previous = itemsByField.get(FIELD_ORDER[i].key);
    if (!previous || !previous.sourceText) continue;
    const index = text.indexOf(previous.sourceText);
    if (index >= 0) {
      const after = index + previous.sourceText.length;
      return { how: `after ${FIELD_ORDER[i].key}`, excerpt: excerptAround(text, after, 0) };
    }
  }
  return { how: 'not found', excerpt: '' };
}

function uncertainty(item) {
  const reasons = [];
  if (item.confidence && item.confidence !== 'high') reasons.push(`confidence ${item.confidence}`);
  if (item.ambiguousValue) reasons.push('ambiguous value');
  if (item.unitMismatch) reasons.push(`unit mismatch (${item.unit})`);
  return reasons;
}

/**
 * Checks one transcript against a script's expected values. Returns one row
 * per patient field, measurement and the conclusions.
 */
export function evaluateTranscript(text, expected) {
  const parsed = parseEchoTranscript(text);
  const items = buildDetectedItems(parsed, createEmptyMeasurements());
  const itemsByField = new Map();
  const duplicates = new Set();
  for (const item of items) {
    if (itemsByField.has(item.field)) duplicates.add(item.field);
    itemsByField.set(item.field, item); // later items win, as when applying
  }
  const expectedValues = expectedMeasurements(expected);
  const ownerOfValue = (value, exceptKey) =>
    Object.keys(expectedValues).find((key) => key !== exceptKey && asNumber(value) !== null && sameValue(expectedValues[key], value));

  const rows = [];

  for (const key of PATIENT_KEYS) {
    if (expected.patient?.[key] === undefined) continue;
    const actual = parsed.patient[key];
    const ok = sameValue(expected.patient[key], actual);
    rows.push({
      group: 'patient', key, label: PATIENT_LABELS[key], section: 'Pacient',
      expected: expected.patient[key], actual: actual || null,
      status: ok ? 'OK' : actual ? 'WRONG' : 'MISSING',
      detail: '',
      excerpt: ok ? '' : locate(text, key, expected.patient[key], itemsByField).excerpt,
    });
  }

  for (const { key, section } of FIELD_ORDER) {
    const expectedValue = expectedValues[key];
    if (expectedValue === undefined) continue;
    const item = itemsByField.get(key);
    const label = MEASUREMENT_FIELDS[key].reviewLabel;
    const row = { group: 'measurement', key, label, section, expected: expectedValue, actual: item?.value ?? null, status: 'OK', detail: '', excerpt: '', source: item?.sourceText ?? '' };
    if (item && sameValue(expectedValue, item.value)) {
      const reasons = uncertainty(item);
      if (reasons.length > 0) {
        row.status = 'OK*';
        row.detail = `review row starts unchecked: ${reasons.join(', ')}`;
      }
      if (duplicates.has(key)) row.detail = [row.detail, 'detected more than once'].filter(Boolean).join('; ');
    } else if (item) {
      row.status = 'WRONG';
      const owner = ownerOfValue(item.value, key);
      row.detail = owner ? `got the value of ${owner}` : '';
      const reasons = uncertainty(item);
      if (duplicates.has(key)) reasons.push('detected more than once, the last one wins');
      if (reasons.length > 0) row.detail = [row.detail, reasons.join(', ')].filter(Boolean).join('; ');
      row.excerpt = row.source;
    } else {
      const misplacedIn = items.find((other) => other.field !== key && other.field !== 'conclusions' && sameValue(expectedValue, other.value) && asNumber(expectedValue) !== null);
      if (misplacedIn) {
        row.status = 'MISPLACED';
        row.detail = `value went to ${misplacedIn.field}`;
        row.excerpt = misplacedIn.sourceText;
      } else {
        row.status = 'MISSING';
        const where = locate(text, key, expectedValue, itemsByField);
        row.detail = `located by ${where.how}`;
        row.excerpt = where.excerpt;
      }
    }
    rows.push(row);
  }

  if (expected.conclusions !== undefined) {
    const ok = sameValue(expected.conclusions, parsed.conclusions);
    rows.push({
      group: 'conclusions', key: 'conclusions', label: 'Concluzii', section: 'Concluzii',
      expected: expected.conclusions, actual: parsed.conclusions || null,
      status: ok ? 'OK' : parsed.conclusions ? 'WRONG' : 'MISSING', detail: '', excerpt: '',
    });
  }

  const passed = rows.filter((row) => isPassing(row.status)).length;
  return { rows, passed, total: rows.length };
}
