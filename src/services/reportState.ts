import type {
  ParsedDetectedItem,
  ParsedEchoData,
  ParsedMeasurement,
  ParsedPatientInfo,
} from './medicalParser.js';
import type { EchoReport, MeasurementKey, Measurements, PatientInfo } from '../types/echoReport.js';
import { DERIVED_MEASUREMENT_KEYS, MEASUREMENT_FIELDS } from '../config/measurementFields.js';
import { calculateBmi } from '../utils/bmi.js';
import { calculateDerivedMeasurements } from '../utils/derivedMeasurements.js';

// Pure report-state logic shared by App.tsx; kept free of React and browser
// APIs so it can be unit tested with node:test.

// Derived ratio -> [explanation shown as source text, source fields]; labels
// come from the field registry.
const DERIVED_DEFINITIONS: ReadonlyArray<[MeasurementKey, string, MeasurementKey[]]> = [
  ['mitralEaRatio', 'Calculat automat: Undă E / Undă A', ['mitralE', 'mitralA']],
  ['tricuspidEaRatio', 'Calculat automat: Undă E / Undă A', ['tricuspidE', 'tricuspidA']],
  ['septalEaPrimeRatio', "Calculat automat: Undă E' / Undă A'", ['septalEPrime', 'septalAPrime']],
  ['eePrimeRatio', "Calculat automat: Undă E mitrală / Undă E'", ['mitralE', 'septalEPrime']],
];

/** Returns the number that follows a valid positive integer, or null. */
export function getFollowingCurrentNumber(value: string): number | null {
  const currentNumber = Number(value.trim());
  return Number.isInteger(currentNumber) && currentNumber > 0 ? currentNumber + 1 : null;
}

function addCalculatedMeasurements(
  parsedMeasurements: ParsedMeasurement[],
  existing: Measurements,
): ParsedMeasurement[] {
  const values = { ...existing };
  const parsedFields = new Set(parsedMeasurements.map((item) => item.field));
  for (const item of parsedMeasurements) {
    values[item.field] = item.value;
  }

  const calculated = calculateDerivedMeasurements(values);
  const detected = parsedMeasurements.filter(
    (item) => !DERIVED_MEASUREMENT_KEYS.includes(item.field),
  );

  for (const [field, sourceText, sourceFields] of DERIVED_DEFINITIONS) {
    if (sourceFields.some((sourceField) => parsedFields.has(sourceField)) && calculated[field] !== '') {
      detected.push({
        field,
        label: MEASUREMENT_FIELDS[field].reviewLabel,
        value: calculated[field],
        kind: 'numeric',
        confidence: 'high',
        sourceText,
      });
    }
  }

  return detected;
}

/** Builds the review list (measurements, derived ratios, conclusions) for a parse. */
export function buildDetectedItems(data: ParsedEchoData, existing: Measurements): ParsedDetectedItem[] {
  const detected: ParsedDetectedItem[] = addCalculatedMeasurements(data.measurements, existing);
  if (data.conclusions) {
    detected.push({
      field: 'conclusions',
      label: 'Concluzii',
      value: data.conclusions,
      kind: 'qualitative',
      confidence: 'high',
      sourceText: data.conclusions,
    });
  }
  return detected;
}

/** Merges the doctor-approved review items into the report. */
export function applyDetectedItems(report: EchoReport, selected: ParsedDetectedItem[]): EchoReport {
  const measurements = { ...report.measurements };
  let conclusions = report.conclusions;
  for (const item of selected) {
    if (item.field === 'conclusions') {
      conclusions = item.value;
    } else {
      measurements[item.field] = item.value;
    }
  }
  return { ...report, measurements: calculateDerivedMeasurements(measurements), conclusions };
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
  const changed: ParsedPatientInfo = { lastName: '', firstName: '', age: '', weight: '', height: '' };
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
