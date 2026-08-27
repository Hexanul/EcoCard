import type { Measurements } from '../types/echoReport';

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
  return {
    ...measurements,
    mitralEaRatio: divideValues(measurements.mitralE, measurements.mitralA),
    tricuspidEaRatio: divideValues(measurements.tricuspidE, measurements.tricuspidA),
    septalEaPrimeRatio: divideValues(measurements.septalEPrime, measurements.septalAPrime),
    eePrimeRatio: divideValues(measurements.mitralE, measurements.septalEPrime),
  };
}