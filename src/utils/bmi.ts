export function calculateBmi(weightKg: string, heightCm: string): string {
  const weight = parseFloat(weightKg.replace(',', '.'));
  const height = parseFloat(heightCm.replace(',', '.'));
  if (!weight || !height || height <= 0) return '';
  const heightM = height / 100;
  return (weight / (heightM * heightM)).toFixed(1);
}
