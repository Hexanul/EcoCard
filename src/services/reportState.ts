import type {
  ParsedEchoData,
  ParsedMeasurement,
  ParsedPatientInfo,
} from './medicalParser.js';
import type { EchoReport, MeasurementKey, PatientInfo } from '../types/echoReport.js';
import { DERIVED_MEASUREMENT_KEYS } from '../config/measurementFields.js';
import { calculateBmi } from '../utils/bmi.js';
import { calculateDerivedMeasurements } from '../utils/derivedMeasurements.js';

// Pure report-state logic shared by App.tsx; kept free of React and browser
// APIs so it can be unit tested with node:test.

/** Returns the number that follows a valid positive integer, or null. */
export function getFollowingCurrentNumber(value: string): number | null {
  const currentNumber = Number(value.trim());
  return Number.isInteger(currentNumber) && currentNumber > 0 ? currentNumber + 1 : null;
}

/** A form field that dictation fills: a measurement or the conclusions. */
export type DictatedField = MeasurementKey | 'conclusions';

/**
 * What dictation says about a value it put in the form. `warnings` need a
 * doctor decision (confirm, pick another dictated value, revert, or edit the
 * field) before the report can be previewed; `info` is only shown.
 */
export type DictationNote = {
  warnings: string[];
  info: string[];
  sourceText: string;
  // Different values dictated for the field; the first one is in the form.
  alternatives?: string[];
  // The form value this dictation replaced, offered as "Revino la …".
  previousValue?: string;
};

export type DictationNotes = Partial<Record<DictatedField, DictationNote>>;

/** The report together with what dictation did to it. */
export type ReportForm = {
  report: EchoReport;
  // Unresolved notes on dictated values.
  notes: DictationNotes;
  // The last value dictation put in each field. A different form value was
  // typed by the doctor, so replacing it gets a note.
  dictated: Partial<Record<DictatedField, string>>;
};

export function createReportForm(report: EchoReport): ReportForm {
  return { report, notes: {}, dictated: {} };
}

/** The fields of a parse whose dictated values changed since the previous parse. */
export type DictationChanges = {
  // Every dictated item of each changed measurement, in transcript order.
  measurements: ParsedMeasurement[];
  // The new conclusions, or null when they did not change.
  conclusions: string | null;
};

// Dictated ratios are ignored: the form always calculates them.
function itemsByField(items: ParsedMeasurement[]): Map<MeasurementKey, ParsedMeasurement[]> {
  const byField = new Map<MeasurementKey, ParsedMeasurement[]>();
  for (const item of items) {
    if (DERIVED_MEASUREMENT_KEYS.includes(item.field)) continue;
    byField.set(item.field, [...(byField.get(item.field) ?? []), item]);
  }
  return byField;
}

// What dictation says for a field, without the surrounding transcript text, so
// editing another part of the transcript does not count as a change.
function dictationSignature(items: ParsedMeasurement[]): string {
  return JSON.stringify(
    items.map((item) => [item.value, item.unit, item.confidence, item.convertedFrom, item.unitMismatch, item.ambiguousValue]),
  );
}

/**
 * Only fields whose dictation changed since the previous parse are applied,
 * so a correction made in the form survives later edits to unrelated parts of
 * the transcript. Returns null when nothing changed.
 */
export function changedDictation(previous: ParsedEchoData | null, next: ParsedEchoData): DictationChanges | null {
  const before = itemsByField(previous?.measurements ?? []);
  const measurements: ParsedMeasurement[] = [];
  for (const [field, items] of itemsByField(next.measurements)) {
    const previousItems = before.get(field);
    if (!previousItems || dictationSignature(previousItems) !== dictationSignature(items)) {
      measurements.push(...items);
    }
  }
  const conclusions = next.conclusions && next.conclusions !== previous?.conclusions ? next.conclusions : null;
  return measurements.length > 0 || conclusions !== null ? { measurements, conclusions } : null;
}

// A replaced value the doctor typed (not one dictation put there earlier).
function replacedValue(form: ReportForm, field: DictatedField, current: string, next: string): string | undefined {
  return current.trim() !== '' && current !== next && current !== form.dictated[field] ? current : undefined;
}

function noteFor(items: ParsedMeasurement[], previousValue: string | undefined): DictationNote | null {
  const [first] = items;
  const alternatives = [...new Set(items.map((item) => item.value))];
  const warnings: string[] = [];
  const info: string[] = [];
  if (alternatives.length > 1) {
    warnings.push(`Dictat de mai multe ori cu valori diferite (${alternatives.join(' / ')}) — alegeți valoarea corectă.`);
  }
  if (first.ambiguousValue) {
    warnings.push('Mai multe numere dictate pentru acest câmp — a fost propus primul.');
  } else if (first.confidence === 'low') {
    warnings.push('Dictat ca nesigur — verificați valoarea.');
  }
  if (first.unitMismatch) {
    warnings.push(`Unitate dictată (${first.unit}) diferită de unitatea câmpului — verificați valoarea.`);
  }
  if (previousValue !== undefined) {
    warnings.push(`A înlocuit valoarea din formular: ${previousValue}.`);
  }
  if (first.convertedFrom) info.push(`Convertit automat din ${first.convertedFrom} în ${first.unit}.`);
  if (first.confidence === 'medium') info.push('Dictat ca aproximativ.');
  if (warnings.length === 0 && info.length === 0) return null;
  return {
    warnings,
    info,
    sourceText: first.sourceText,
    ...(alternatives.length > 1 ? { alternatives } : {}),
    ...(previousValue !== undefined ? { previousValue } : {}),
  };
}

function withNote(notes: DictationNotes, field: DictatedField, note: DictationNote | null): DictationNotes {
  const next = { ...notes };
  if (note) next[field] = note;
  else delete next[field];
  return next;
}

/**
 * Puts the changed dictated values straight into the form, like the patient
 * data. Anything uncertain (several values, an ambiguous number, a unit
 * mismatch, a hedged value, or a replaced value the doctor typed) is kept
 * with a note under its field until the doctor resolves it.
 */
export function applyDictation(form: ReportForm, changes: DictationChanges): ReportForm {
  const measurements = { ...form.report.measurements };
  let notes = form.notes;
  const dictated = { ...form.dictated };

  for (const [field, items] of itemsByField(changes.measurements)) {
    const value = items[0].value;
    notes = withNote(notes, field, noteFor(items, replacedValue(form, field, measurements[field], value)));
    measurements[field] = value;
    dictated[field] = value;
  }

  let conclusions = form.report.conclusions;
  if (changes.conclusions !== null) {
    const previousValue = replacedValue(form, 'conclusions', conclusions, changes.conclusions);
    notes = withNote(
      notes,
      'conclusions',
      previousValue === undefined
        ? null
        : { warnings: ['A înlocuit textul scris în formular.'], info: [], sourceText: '', previousValue },
    );
    conclusions = changes.conclusions;
    dictated.conclusions = conclusions;
  }

  return {
    report: { ...form.report, measurements: calculateDerivedMeasurements(measurements), conclusions },
    notes,
    dictated,
  };
}

function emptyParsedPatient(): ParsedPatientInfo {
  return { lastName: '', firstName: '', age: '', weight: '', height: '' };
}

function setField(report: EchoReport, field: DictatedField, value: string): EchoReport {
  if (field === 'conclusions') return { ...report, conclusions: value };
  return { ...report, measurements: calculateDerivedMeasurements({ ...report.measurements, [field]: value }) };
}

/** A value typed by the doctor; it also settles any note on the field. */
export function editField(form: ReportForm, field: DictatedField, value: string): ReportForm {
  return { ...form, report: setField(form.report, field, value), notes: withNote(form.notes, field, null) };
}

/**
 * The doctor's decision on a note: keep the dictated value (no `value`), or
 * use another dictated value or the replaced one.
 */
export function resolveNote(form: ReportForm, field: DictatedField, value?: string): ReportForm {
  if (value === undefined) return { ...form, notes: withNote(form.notes, field, null) };
  return {
    report: setField(form.report, field, value),
    notes: withNote(form.notes, field, null),
    dictated: { ...form.dictated, [field]: value },
  };
}

/** Fields with a note that still needs a doctor decision. */
export function hasWarnings(note: DictationNote | undefined): boolean {
  return note !== undefined && note.warnings.length > 0;
}

const PATIENT_KEYS = ['lastName', 'firstName', 'age', 'weight', 'height'] as const;

/**
 * Returns only the dictated patient fields that changed since the previous
 * parse (other fields empty), so editing one part of the transcript never
 * re-applies values the doctor has since corrected in the form.
 */
export function changedPatientFields(
  previous: ParsedPatientInfo | null,
  next: ParsedPatientInfo,
): ParsedPatientInfo | null {
  const changed: ParsedPatientInfo = emptyParsedPatient();
  let any = false;
  for (const key of PATIENT_KEYS) {
    if (next[key] && next[key] !== previous?.[key]) {
      changed[key] = next[key];
      any = true;
    }
  }
  return any ? changed : null;
}

/** Fills the non-empty dictated fields into the patient form and refreshes the BMI. */
export function mergeParsedPatient(current: PatientInfo, parsed: ParsedPatientInfo): PatientInfo {
  const weight = parsed.weight || current.weight;
  const height = parsed.height || current.height;
  return {
    ...current,
    lastName: parsed.lastName || current.lastName,
    firstName: parsed.firstName || current.firstName,
    age: parsed.age || current.age,
    weight,
    height,
    bmi: calculateBmi(weight, height) || current.bmi,
  };
}
