import type { MeasurementKey } from '../types/echoReport.js';
import { MEASUREMENT_SECTIONS } from './measurementFields.js';

// Unit in which each numeric field is stored and printed (from the field
// registry). Fields without an entry are qualitative text or unitless ratios.
export const MEASUREMENT_UNITS: Partial<Record<MeasurementKey, string>> = Object.fromEntries(
  MEASUREMENT_SECTIONS.flatMap((section) => section.fields)
    .filter((field) => field.unit !== undefined)
    .map((field) => [field.key, field.unit]),
);

// Multiplier from a spoken unit to the stored unit, for safe linear conversions.
const CONVERSION_FACTORS: Record<string, Record<string, number>> = {
  cm: { mm: 0.1 },
  mm: { cm: 10 },
  'cm/s': { 'mm/s': 0.1, 'm/s': 100 },
};

/**
 * Converts a numeric value from the spoken unit to the field's stored unit.
 * Returns null when no safe conversion exists.
 */
export function convertUnit(value: string, from: string, to: string): string | null {
  const factor = CONVERSION_FACTORS[to]?.[from];
  const number = Number(value);
  if (factor === undefined || !Number.isFinite(number)) return null;
  return String(Math.round(number * factor * 10000) / 10000);
}
