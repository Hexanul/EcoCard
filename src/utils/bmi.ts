export function calculateBmi(weightKg: string, heightCm: string): string {
  const weight = parseFloat(weightKg.replace(',', '.'));
  const height = parseFloat(heightCm.replace(',', '.'));
  if (!weight || !height || height <= 0) return '';
  // Heights below 3 are taken as meters ("1,75"), the rest as centimeters.
  const heightM = height < 3 ? height : height / 100;
  return (weight / (heightM * heightM)).toFixed(1);
}
