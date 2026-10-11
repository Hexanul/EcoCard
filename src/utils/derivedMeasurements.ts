import type { MeasurementKey, Measurements } from '../types/echoReport.js';

// Each calculated ratio and its [numerator, denominator] fields.
export const DERIVED_SOURCES: ReadonlyArray<[MeasurementKey, MeasurementKey, MeasurementKey]> = [
  ['mitralEaRatio', 'mitralE', 'mitralA'],
  ['tricuspidEaRatio', 'tricuspidE', 'tricuspidA'],
  ['septalEaPrimeRatio', 'septalEPrime', 'septalAPrime'],
  ['eePrimeRatio', 'mitralE', 'septalEPrime'],
];

function divideValues(numerator: string, denominator: string): string {
  const parsedNumerator = Number(numerator.trim().replace(',', '.'));
  const parsedDenominator = Number(denominator.trim().replace(',', '.'));

  if (
    numerator.trim() === '' ||
    denominator.trim() === '' ||
    !Number.isFinite(parsedNumerator) ||
    !Number.isFinite(parsedDenominator) ||
    parsedDenominator === 0
  ) {
    return '';
  }

  return (parsedNumerator / parsedDenominator).toFixed(2).replace(/\.00$|(?<=\.[0-9])0$/, '');
}

export function calculateDerivedMeasurements(measurements: Measurements): Measurements {
  const result = { ...measurements };
  for (const [ratio, numerator, denominator] of DERIVED_SOURCES) {
    result[ratio] = divideValues(measurements[numerator], measurements[denominator]);
  }
  return result;
}
