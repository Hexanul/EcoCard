import type { EchoReport, MeasurementKey, Measurements } from '../types/echoReport.js';
import { MEASUREMENT_FIELDS, MEASUREMENT_SECTIONS } from '../config/measurementFields.js';
import {
  MEASUREMENT_LIMITS,
  PATIENT_LIMITS,
  type PatientLimitKey,
  type ValueLimits,
} from '../config/measurementLimits.js';

// Plausibility checks for the form values (limits in config/measurementLimits.ts).
// Pure, so they can be unit tested with node:test.

export type ValueStatus = 'empty' | 'accept' | 'confirm' | 'reject';

/**
 * Filters what is typed into a numeric field: digits and one decimal
 * separator (a comma becomes a dot), at most `maxDecimals` decimals. Values
 * are never checked against the limits while typing.
 */
export function sanitizeNumericInput(raw: string, maxDecimals: number): string {
  let result = '';
  let decimals = -1;
  for (const char of raw) {
    if (char >= '0' && char <= '9') {
      if (decimals >= maxDecimals) continue;
      if (decimals >= 0) decimals += 1;
      result += char;
    } else if ((char === '.' || char === ',') && decimals < 0) {
      // Without decimals the separator ends the value ("190.5" stays "190").
      decimals = 0;
      if (maxDecimals > 0) result += '.';
    }
  }
  return result;
}

function toNumber(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed === '' || trimmed === '.') return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

/** Empty, accepted, unusual (needs a confirmation) or impossible (rejected). */
export function checkValue(value: string, limits: ValueLimits): ValueStatus {
  if (value.trim() === '') return 'empty';
  const number = toNumber(value);
  if (number === null || number < limits.rejectBelow || number > limits.rejectAbove) return 'reject';
  if (limits.confirmBelow !== undefined && number < limits.confirmBelow) return 'confirm';
  if (limits.confirmAbove !== undefined && number > limits.confirmAbove) return 'confirm';
  return 'accept';
}

function range(low: number | undefined, high: number | undefined, unit: string | undefined): string {
  const suffix = unit ? ` ${unit}` : '';
  if (low === undefined) return `≤ ${high}${suffix}`;
  if (high === undefined) return `≥ ${low}${suffix}`;
  return `${low}–${high}${suffix}`;
}

/** The message shown next to a rejected or unusual value. */
export function describeStatus(status: ValueStatus, limits: ValueLimits, unit?: string): string {
  if (status === 'reject') {
    return `Valoare imposibilă — limite ${range(limits.rejectBelow, limits.rejectAbove, unit)}`;
  }
  if (status === 'confirm') {
    return `Valoare neobișnuită (uzual ${range(limits.confirmBelow, limits.confirmAbove, unit)})`;
  }
  return '';
}

// A Pmax should be close to 4·Vmax² (simplified Bernoulli, Vmax in m/s).
const PRESSURE_FROM_VELOCITY: ReadonlyArray<[MeasurementKey, MeasurementKey]> = [
  ['aorticPmax', 'aorticVmax'],
  ['tricuspidPmax', 'tricuspidVmax'],
  ['pulmonaryPmax', 'pulmonaryVmax'],
];

// "Close" means within 25 % of the expected value, and at least 5 mmHg.
const PRESSURE_TOLERANCE_RATIO = 0.25;
const PRESSURE_TOLERANCE_MIN_MMHG = 5;

/**
 * Consistency warnings between fields, keyed by the field that shows them.
 * They only warn: they never block the report.
 */
export function crossFieldWarnings(measurements: Measurements): Partial<Record<MeasurementKey, string>> {
  const warnings: Partial<Record<MeasurementKey, string>> = {};
  const value = (key: MeasurementKey) => toNumber(measurements[key]);
  const exceeds = (key: MeasurementKey, limitKey: MeasurementKey, message: string) => {
    const number = value(key);
    const limit = value(limitKey);
    if (number !== null && limit !== null && number > limit) warnings[key] = message;
  };

  exceeds('lvEndSystolicDiameter', 'lvEndDiastolicDiameter', 'Mai mare decât diametrul telediastolic');
  exceeds('lvEndSystolicVolume', 'lvEndDiastolicVolume', 'Mai mare decât volumul telediastolic');
  exceeds('aorticPmean', 'aorticPmax', 'Mai mare decât Pmax aortic');

  for (const [pressureKey, velocityKey] of PRESSURE_FROM_VELOCITY) {
    const pressure = value(pressureKey);
    const velocity = value(velocityKey);
    if (pressure === null || velocity === null || velocity <= 0) continue;
    const expected = 4 * (velocity / 100) ** 2;
    const tolerance = Math.max(PRESSURE_TOLERANCE_MIN_MMHG, expected * PRESSURE_TOLERANCE_RATIO);
    if (Math.abs(pressure - expected) > tolerance) {
      warnings[pressureKey] = `Diferă de 4·Vmax² ≈ ${Math.round(expected * 10) / 10} mmHg`;
    }
  }
  return warnings;
}

/** Field id → the value the doctor confirmed as correct despite being unusual. */
export type Confirmations = Record<string, string>;

// 'dictated': a dictated value with an unresolved warning under its field.
export type ReportIssue = { id: string; label: string; status: 'confirm' | 'reject' | 'dictated' };

// Fields whose dictated value still needs a doctor decision.
type PendingNotes = Readonly<Record<string, { warnings: readonly string[] } | undefined>>;

/** The input id of the conclusions textarea. */
export const CONCLUSIONS_FIELD_ID = 'report-conclusions';

const PATIENT_FIELD_LABELS: Record<PatientLimitKey, string> = {
  age: 'Vârstă',
  weight: 'Greutate',
  height: 'Înălțime',
};

/** The input id of a patient field with limits (also its confirmation key). */
export function patientFieldId(key: PatientLimitKey): string {
  return `patient-${key}`;
}

/**
 * Values that must be corrected (impossible), confirmed (unusual, not yet
 * confirmed) or decided (dictated with a warning) before the report can be
 * previewed and exported, in form order.
 */
export function findReportIssues(report: EchoReport, confirmed: Confirmations, notes: PendingNotes = {}): ReportIssue[] {
  const issues: ReportIssue[] = [];
  const add = (id: string, label: string, value: string, limits: ValueLimits | undefined) => {
    const status = limits ? checkValue(value, limits) : 'empty';
    if (status === 'reject' || (status === 'confirm' && confirmed[id] !== value)) {
      issues.push({ id, label, status });
    } else if ((notes[id]?.warnings.length ?? 0) > 0) {
      issues.push({ id, label, status: 'dictated' });
    }
  };
  for (const key of Object.keys(PATIENT_FIELD_LABELS) as PatientLimitKey[]) {
    add(patientFieldId(key), PATIENT_FIELD_LABELS[key], report.patient[key], PATIENT_LIMITS[key]);
  }
  for (const field of MEASUREMENT_SECTIONS.flatMap((section) => section.fields)) {
    add(field.key, MEASUREMENT_FIELDS[field.key].reviewLabel, report.measurements[field.key], MEASUREMENT_LIMITS[field.key]);
  }
  if ((notes['conclusions']?.warnings.length ?? 0) > 0) {
    issues.push({ id: CONCLUSIONS_FIELD_ID, label: 'Concluzii', status: 'dictated' });
  }
  return issues;
}
