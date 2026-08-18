export type UnitMatch = {
  unit: string;
  end: number;
};

type UnitPattern = [RegExp, string];

function normalized(text: string): string {
  return text
    .toLocaleLowerCase('ro-RO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't');
}

// Ordered longest-match first so that e.g. "milimetri pe secundă" wins over
// "milimetri", and "mmHg" over "mm".
const UNIT_PATTERNS: UnitPattern[] = [
  [/%|la\s+suta|procente?/, '%'],
  [/\bmilimetr[ui]?\s+(?:coloana\s+)?de\s+mercur\b|\bmm\s*hg\b|\bmmhg\b/, 'mmHg'],
  [/\bmilimetr[ui]?\s+pe\s+secunda\b|\bmm\s*\/\s*s\b/, 'mm/s'],
  [/\bcentimetr[ui]?\s+pe\s+secunda\b|\bcm\s*\/\s*s\b/, 'cm/s'],
  [/\bcentimetr[ui]?\s+patrati\b|\bcm\s*patrati\b|\bcm2\b|cm²/, 'cm²'],
  [/\bgram(?:a|e)?\s+pe\s+metru\s+patrat\b|\bg\s*\/\s*m2\b|\bg\s*\/\s*m²(?!\w)/, 'g/m²'],
  [/\bmilisecund(?:a|e)?\b|\bmsec\b|\bms\b/, 'msec'],
  [/\bmililitr[ui]?\b|\bml\b/, 'ml'],
  [/\bmilimetr[ui]?\b|\bmm\b/, 'mm'],
  [/\bcentimetr[ui]?\b|\bcm\b/, 'cm'],
];

/**
 * Finds the first known unit in a text and returns its canonical form plus the
 * end offset of the match, or null when no unit is present.
 */
export function findUnit(text: string): UnitMatch | null {
  const candidate = normalized(text);
  for (const [pattern, unit] of UNIT_PATTERNS) {
    const match = pattern.exec(candidate);
    if (match) {
      return { unit, end: match.index + match[0].length };
    }
  }
  return null;
}

/** Returns the canonical unit present in the text, or null when absent. */
export function normalizeUnit(text: string): string | null {
  return findUnit(text)?.unit ?? null;
}