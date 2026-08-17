function normalized(text) {
    return text.toLocaleLowerCase('ro-RO').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
const unitPatterns = [
    [/\bla\suta\b|%/, '%'],
    [/\bmilimetri?\s+pe\s+secunda\b|\bmm\s*\/\s*s\b/, 'mm/s'],
    [/\bcentimetri?\s+pe\s+secunda\b|\bcm\s*\/\s*s\b/, 'cm/s'],
    [/\bmilimetri?\s*(?:hg)?\b|\bmmhg\b/, 'mmHg'],
    [/\bcentimetri?\s+patrati\b|\bcm2\b|cm²/, 'cm²'],
    [/\bgrame?\s+pe\s+metru\s+patrat\b|\bg\s*\/\s*m2\b/, 'g/m²'],
    [/\bmilisecunde?\b|\bmsec\b|\bms\b/, 'msec'],
    [/\bmililitri?\b|\bml\b/, 'ml'],
    [/\bmilimetri?\b|\bmm\b/, 'mm'],
    [/\bcentimetri?\b|\bcm\b/, 'cm'],
];
export function normalizeUnit(text) {
    const candidate = normalized(text);
    return unitPatterns.find(([pattern]) => pattern.test(candidate))?.[1];
}
