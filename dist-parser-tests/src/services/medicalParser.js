import { MEASUREMENT_FIELDS } from '../config/measurementFields.js';
import { convertUnit, MEASUREMENT_UNITS } from '../config/measurementUnits.js';
import { ABBREVIATION_REPLACEMENTS, CONTEXT_ALIASES, KNOWN_QUALITATIVE_VALUES, NUMERIC_FIELDS, QUALITATIVE_FIELDS, TYPO_REPLACEMENTS, UNASSIGNED_FIELD_ALIASES, } from './parserAliases.js';
import { findRomanianNumber, normalizeNumberText } from './romanianNumberParser.js';
import { findUnit } from './unitNormalizer.js';
const LOW_CONFIDENCE_PATTERNS = [
    /\b(?:probabil|posibil|nesigur|banuiesc)\b/,
    /\bnu\s+sunt\s+sigur\b/,
    /\bnu\s+stiu\b/,
];
const MEDIUM_CONFIDENCE_PATTERNS = [
    /\b(?:aproximativ|aprox|circa|cam)\b/,
    /\bin\s+jur\s+de\b/,
];
const QUALITATIVE_CONNECTORS = /\b(?:este|e|sunt|are|cu|de|se|un|o)\s+/;
// A punctuation mark ends a value window unless it sits between two digits
// and is therefore a decimal separator ("4.8"). A sentence-ending period
// after a number ("2,2. Următoarea…") still ends the window. A period
// directly after a field label ("Aorta la inel. 2") is treated as a
// field-separator when a number follows, so it must NOT end the window.
const PUNCTUATION_BOUNDARY = /(?<!\d)[.!?;…\n](?!\s*\d)|(?<=\d)[.!?;…\n](?!\d)/;
function isSpace(ch) {
    return /\s/.test(ch);
}
function normalizeChar(ch) {
    const lower = ch.toLocaleLowerCase('ro-RO');
    const decomposed = lower.normalize('NFD');
    let out = '';
    for (const part of decomposed) {
        if (/\p{M}/u.test(part))
            continue;
        out += part;
    }
    return out.replace(/[șş]/g, 's').replace(/[țţ]/g, 't');
}
// Raw indices for a typo rewrite: characters the match and its replacement
// share at the start and at the end keep their own index, and the changed
// middle maps onto the matched middle in order (repeating its last index when
// the replacement is longer). "ejenctie" → "ejectie" thus drops the index of
// the "n", and the map always stays monotonic.
function mapRewriteIndices(matched, target, indices) {
    let prefix = 0;
    while (prefix < matched.length && prefix < target.length && matched[prefix] === target[prefix])
        prefix += 1;
    let suffix = 0;
    while (suffix < matched.length - prefix &&
        suffix < target.length - prefix &&
        matched[matched.length - 1 - suffix] === target[target.length - 1 - suffix])
        suffix += 1;
    const middle = indices.slice(prefix, matched.length - suffix);
    const fallback = indices[Math.max(0, prefix - 1)];
    const mappedMiddle = Array.from({ length: target.length - prefix - suffix }, (_, k) => middle.length > 0 ? middle[Math.min(k, middle.length - 1)] : fallback);
    return [...indices.slice(0, prefix), ...mappedMiddle, ...indices.slice(matched.length - suffix)];
}
function normalize(text) {
    return normalizeWithIndex(text).text;
}
// Collapses whitespace/hyphens and records the raw position of every
// normalized character so that spans can be mapped back to the transcript.
// Also protects decimal commas, including Whisper's "4, 5" with a space,
// while keeping rawIndex accurate (removed spaces don't get an entry).
function normalizeWithIndex(raw) {
    let text = '';
    const rawIndex = [];
    for (let i = 0; i < raw.length; i += 1) {
        const ch = raw[i];
        if (isSpace(ch) || ch === '-') {
            if (text.length > 0 && text[text.length - 1] !== ' ') {
                text += ' ';
                rawIndex.push(i);
            }
            continue;
        }
        const normalized = normalizeChar(ch);
        text += normalized;
        for (let k = 0; k < normalized.length; k += 1)
            rawIndex.push(i);
    }
    const trimmed = text.trim();
    // Trim start: drop leading rawIndex entries corresponding to leading spaces
    const leadingSpaces = text.length - text.trimStart().length;
    let trimmedRawIndex = rawIndex.slice(leadingSpaces);
    // Trim end: if original had trailing space, last char was ' ' and already trimmed
    if (trimmed.length < trimmedRawIndex.length) {
        trimmedRawIndex = trimmedRawIndex.slice(0, trimmed.length);
    }
    // Protect decimal commas "4,5" and Whisper "4, 5" -> "4.5"
    // When a space follows the comma between digits, drop it and its rawIndex.
    let out = '';
    let outRawIndex = [];
    for (let i = 0; i < trimmed.length; i += 1) {
        const ch = trimmed[i];
        if (ch === ',' &&
            i > 0 &&
            i + 1 < trimmed.length &&
            /\d/.test(trimmed[i - 1]) &&
            /\d/.test(trimmed[i + 1])) {
            out += '.';
            outRawIndex.push(trimmedRawIndex[i]);
            continue;
        }
        if (ch === ' ' &&
            i > 1 &&
            trimmed[i - 1] === ',' &&
            /\d/.test(trimmed[i - 2]) &&
            i + 1 < trimmed.length &&
            /\d/.test(trimmed[i + 1])) {
            // Space inside decimal "4, 5" -> skip it (already converted comma to dot)
            continue;
        }
        out += ch;
        outRawIndex.push(trimmedRawIndex[i]);
    }
    // Normalize dotted abbreviations "V.S." / "V S" / "V, S" -> "vs" etc., keeping rawIndex
    // aligned by preserving only the letter positions (dots/spaces/commas are dropped).
    // This ensures "Masa V.S. 5" and "V, S, daimetru ..." match alias "masa vs" / "vs diametru".
    for (const { pattern, target } of ABBREVIATION_REPLACEMENTS) {
        // Reset regex state for each iteration after mutation
        let match;
        // Use while loop with manual index tracking because we mutate out
        pattern.lastIndex = 0;
        while ((match = pattern.exec(out)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            // Collect raw indices of letters a-z in the matched substring to map to target
            const letterIndices = [];
            for (let k = start; k < end; k += 1) {
                if (/[a-z]/.test(out[k]))
                    letterIndices.push(outRawIndex[k]);
            }
            // Fallback: if letter extraction failed, just use first N indices
            const mappedRaw = letterIndices.slice(0, target.length);
            while (mappedRaw.length < target.length)
                mappedRaw.push(outRawIndex[start]);
            const newOut = out.slice(0, start) + target + out.slice(end);
            const newRaw = [...outRawIndex.slice(0, start), ...mappedRaw, ...outRawIndex.slice(end)];
            out = newOut;
            outRawIndex = newRaw;
            pattern.lastIndex = start + target.length;
            // For patterns like "v s" that could overlap, restart from start
            // to avoid missing consecutive abbreviations after replacement.
            if (pattern.lastIndex > out.length)
                break;
        }
    }
    // Typo rewrites (parserAliases.ts) may change the length; mapRewriteIndices
    // keeps rawIndex aligned for any rule, so a rule is pure data.
    for (const { pattern, target } of TYPO_REPLACEMENTS) {
        pattern.lastIndex = 0;
        let m;
        while ((m = pattern.exec(out)) !== null) {
            const s = m.index;
            const e = s + m[0].length;
            const mapped = mapRewriteIndices(m[0], target, outRawIndex.slice(s, e));
            out = out.slice(0, s) + target + out.slice(e);
            outRawIndex = [...outRawIndex.slice(0, s), ...mapped, ...outRawIndex.slice(e)];
            pattern.lastIndex = s + target.length;
            if (pattern.lastIndex > out.length)
                break;
        }
    }
    return { text: out, rawIndex: outRawIndex };
}
function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// Field aliases are matched word by word, tolerating comma or semicolon
// separators between the words ("vs, diametrul telediastolic") exactly as
// Whisper dictates them. The trailing boundary allows a digit to follow the
// alias immediately so Whisper attachments like "E4", "EA1.2", "TDE9" still
// match the label and leave the number in the value window ("e"+"4", "ea"+"1.2").
// A following letter still ends the match, so "area" never matches bare "a".
function aliasPattern(alias) {
    const words = alias.split(' ').map((word) => escapeRegExp(word));
    return new RegExp(`(?<![a-z0-9])${words.join('[\\s,;]+')}(?![a-z])`, 'g');
}
// Qualitative aliases additionally allow a known value word to be attached
// with no space ("valve mitralesuple" → alias ends before "suple"). The known
// value is only looked ahead, never consumed, so it stays in the value window.
function qualitativeAliasPattern(alias) {
    const words = alias.split(' ').map((word) => escapeRegExp(word));
    const body = words.join('[\\s,;]+');
    const known = KNOWN_QUALITATIVE_VALUES.map((value) => escapeRegExp(value)).join('|');
    return new RegExp(`(?<![a-z0-9])${body}(?:(?![a-z])|(?=(?:${known})(?![a-z])))`, 'g');
}
// Compiled once: the transcript is re-parsed on every keystroke.
let aliasMatchers = null;
function getAliasMatchers() {
    if (aliasMatchers)
        return aliasMatchers;
    const matchers = [];
    for (const [context, aliases] of Object.entries(CONTEXT_ALIASES)) {
        for (const alias of aliases) {
            matchers.push({ kind: 'context', context, pattern: aliasPattern(alias) });
        }
    }
    for (const def of NUMERIC_FIELDS) {
        for (const alias of def.aliases) {
            matchers.push({ kind: 'field', def, pattern: aliasPattern(alias) });
        }
    }
    for (const alias of UNASSIGNED_FIELD_ALIASES) {
        matchers.push({ kind: 'boundary', pattern: aliasPattern(alias) });
    }
    for (const def of QUALITATIVE_FIELDS) {
        for (const alias of def.aliases) {
            matchers.push({ kind: 'qualitative', def, pattern: qualitativeAliasPattern(alias) });
        }
    }
    aliasMatchers = matchers;
    return matchers;
}
function collectMatches(normalizedText) {
    const matches = [];
    for (const { pattern, ...matcher } of getAliasMatchers()) {
        // matchAll() iterates a copy of the regex, so the shared pattern's
        // lastIndex is never touched.
        for (const match of normalizedText.matchAll(pattern)) {
            const start = match.index ?? 0;
            matches.push({ ...matcher, start, end: start + match[0].length });
        }
    }
    matches.sort((a, b) => a.start - b.start || b.end - a.end);
    return matches;
}
function countNumericValues(text) {
    let count = 0;
    let rest = text;
    for (;;) {
        const found = findRomanianNumber(rest);
        if (!found)
            break;
        count += 1;
        // The "2" of Whisper's "cm2" belongs to the unit, not to a second value.
        rest = rest.slice(found.end).replace(/^\s*c?m2(?![a-z0-9])/, '');
    }
    return count;
}
// Returns the normalized index of the start of the Nth word before `from`,
// without crossing the end of a sentence: a hedge that ends the previous
// sentence ("2,2 nu sunt sigur. VS …") belongs to the previous value.
function lookbackStart(text, from, wordCount) {
    let pos = from;
    let seen = 0;
    while (pos > 0 && seen < wordCount) {
        let i = pos - 1;
        while (i >= 0 && /\s/.test(text[i]))
            i -= 1;
        if (i < 0 || /[.!?;…]/.test(text[i]))
            break;
        while (i >= 0 && !/\s/.test(text[i]))
            i -= 1;
        pos = i + 1;
        seen += 1;
    }
    return pos;
}
function confidenceFor(text) {
    for (const pattern of LOW_CONFIDENCE_PATTERNS) {
        if (pattern.test(text))
            return 'low';
    }
    for (const pattern of MEDIUM_CONFIDENCE_PATTERNS) {
        if (pattern.test(text))
            return 'medium';
    }
    return 'high';
}
// Strips leading connective words ("este", "de", ...) from a qualitative value
// and returns the raw transcript text of the value. A leading field-separator
// comma after the alias ("lichid pericardic, absent") is not part of the value.
function qualitativeValue(rawWindow) {
    const { text, rawIndex } = normalizeWithIndex(rawWindow);
    let pos = 0;
    let rest = text;
    for (;;) {
        const match = QUALITATIVE_CONNECTORS.exec(rest);
        if (match && match.index === 0) {
            pos += match[0].length;
            rest = rest.slice(match[0].length);
            continue;
        }
        break;
    }
    if (pos >= rawIndex.length)
        return null;
    const value = rawWindow
        .slice(rawIndex[pos])
        .replace(/^[\s,;]+/, '')
        .replace(/[\s,;]+$/g, '')
        .trim();
    return value || null;
}
function findNextPunctuation(raw, from, limit) {
    const match = PUNCTUATION_BOUNDARY.exec(raw.slice(from, limit));
    return match ? from + (match.index ?? 0) : null;
}
// "Concluzii", "Concluzie", "Concluzia", "Concluziile", and Whisper's
// "CONCLUZI," with the last letter dropped.
const CONCLUSIONS_MARKER = /\bconcluzi(?:ile|i|e|a)?\b\s*[:.,-]?\s*/i;
function extractConclusions(transcript) {
    const match = CONCLUSIONS_MARKER.exec(transcript);
    if (!match)
        return '';
    return transcript.slice(match.index + match[0].length).trim();
}
function beforeConclusions(transcript) {
    const match = CONCLUSIONS_MARKER.exec(transcript);
    return match ? transcript.slice(0, match.index) : transcript;
}
// ---------------------------------------------------------------------------
// Patient data extraction ("Nume Popescu, prenume Ion, vârsta 65 de ani, ...")
// ---------------------------------------------------------------------------
const ROMANIAN_LETTER_CLASS = 'a-zA-ZăâîșțşţĂÂÎȘȚŞŢ';
const NO_LETTER_BEFORE = `(?<![${ROMANIAN_LETTER_CLASS}])`;
const NO_LETTER_AFTER = `(?![${ROMANIAN_LETTER_CLASS}])`;
// Words that terminate a dictated name: the next field label, a unit, or a
// connector. They are never part of a patient's name.
const PATIENT_NAME_STOP_WORDS = new Set([
    'si', 'și', 'de', 'cu', 'la',
    'nume', 'numele', 'prenume', 'prenumele', 'pranume', 'prânume', 'familie',
    'pacient', 'pacientul', 'pacienta', 'pacientului', 'pacientei',
    'varsta', 'vârsta', 'vârstă', 'varstă', 'an', 'ani',
    'greutate', 'greutatea', 'reutate', 'reutatea', 'kg', 'kilograme', 'kilogramele',
    'inaltime', 'inaltimea', 'înălțime', 'înălțimea', 'înălţime', 'înălţimea',
    'intime', 'intimea', 'înțime', 'înțimea', 'ințime', 'ințimea', 'înţime', 'înţimea',
    'inţime', 'inţimea',
    'cm', 'centimetri',
    'data', 'examinare', 'examinarea', 'examinarii', 'examinării',
    'numar', 'număr', 'numărul', 'curent', 'curentul', 'concluzii',
]);
// A label may be followed by "este" / "e" ("Numele pacientului este Popescu",
// "vârsta este de 54 de ani"); neither is part of the value.
const LABEL_CONNECTOR = '\\s*[:.,-]?\\s*(?:(?:este|e)\\s+)?';
function patientLabelRegex(source) {
    return new RegExp(`${NO_LETTER_BEFORE}${source}${NO_LETTER_AFTER}${LABEL_CONNECTOR}(?:de\\s+)?`, 'i');
}
const COMBINED_NAME_LABEL = new RegExp(`${NO_LETTER_BEFORE}nume[\\s,]+(?:și|si)[\\s,]+prenume${NO_LETTER_AFTER}${LABEL_CONNECTOR}`, 'i');
const LAST_NAME_LABEL = patientLabelRegex('nume(?:le)?(?:\\s+de\\s+familie)?(?:\\s+pacientului|\\s+pacientei|\\s+pacienta|\\s+pacientul)?');
// Whisper sometimes writes "prânume".
const FIRST_NAME_LABEL = patientLabelRegex('pr[eâa]nume(?:le)?(?:\\s+pacientului|\\s+pacientei|\\s+pacienta|\\s+pacientul)?');
const AGE_LABEL = patientLabelRegex('v[âa]rst[aă]');
const WEIGHT_LABEL = patientLabelRegex('(?:g)?reutate[aă]?');
// Whisper drops the middle "ăl" ("Înțime" for "Înălțime").
const HEIGHT_LABEL = patientLabelRegex('[îi]n(?:[ăaâ]l)?[tțţ]ime[aă]?');
// Units after an age number that are not years.
const AGE_NOT_IN_YEARS = /^\s*(?:de\s+)?(?:luni|luna|zile|zi|saptamani|saptamana)\b/;
// Punctuation that separates clauses; a comma or period between two digits
// is a decimal separator.
const CLAUSE_BREAK = /(?<!\d)[.,;:!?\n]|[.,;:!?\n](?!\d)/;
/**
 * An age dictated without the "vârsta" label, as its own clause:
 * "Ionescu Maria, 54 de ani, …". The clause must be only a number and "ani",
 * so "cunoscut cu HTA de 10 ani" is not taken as the age.
 */
function unlabeledAge(scope) {
    for (const clause of scope.split(CLAUSE_BREAK)) {
        const text = normalizeNumberText(clause);
        const match = /^(.+?)\s+(?:de\s+)?ani$/.exec(text);
        if (!match)
            continue;
        const found = findRomanianNumber(match[1]);
        if (found && found.start === 0 && found.end === match[1].length && /^\d+$/.test(found.value)) {
            return found.value;
        }
    }
    return '';
}
function captureNameWords(raw, from, maxWords) {
    const wordPattern = new RegExp(`[${ROMANIAN_LETTER_CLASS}]+(?:-[${ROMANIAN_LETTER_CLASS}]+)*`, 'g');
    wordPattern.lastIndex = from;
    const words = [];
    const limit = Math.min(raw.length, from + 80);
    while (words.length < maxWords) {
        const match = wordPattern.exec(raw);
        if (!match || match.index >= limit)
            break;
        if (PATIENT_NAME_STOP_WORDS.has(match[0].toLocaleLowerCase('ro-RO')))
            break;
        words.push(match[0]);
    }
    return words;
}
function capitalizeName(name) {
    return name.replace(new RegExp(`(^|[\\s-])([${ROMANIAN_LETTER_CLASS}])`, 'g'), (_match, sep, letter) => sep + letter.toLocaleUpperCase('ro-RO'));
}
/**
 * Extracts explicitly dictated patient data. Only the text before the
 * "Concluzii" marker is scanned: conclusions routinely mention the patient's
 * age ("pacient în vârstă de ...") and must not overwrite the form fields.
 */
function extractPatientInfo(transcript) {
    const patient = {
        lastName: '',
        firstName: '',
        age: '',
        weight: '',
        height: '',
    };
    const conclusionsMatch = CONCLUSIONS_MARKER.exec(transcript);
    const scope = conclusionsMatch ? transcript.slice(0, conclusionsMatch.index) : transcript;
    if (!scope.trim())
        return patient;
    // "Nume și prenume Popescu Ion" — first word is the family name.
    const combined = COMBINED_NAME_LABEL.exec(scope);
    if (combined) {
        const words = captureNameWords(scope, combined.index + combined[0].length, 3);
        if (words.length > 0)
            patient.lastName = capitalizeName(words[0]);
        if (words.length > 1)
            patient.firstName = capitalizeName(words.slice(1).join(' '));
    }
    if (!patient.lastName) {
        const match = LAST_NAME_LABEL.exec(scope);
        if (match) {
            const words = captureNameWords(scope, match.index + match[0].length, 2);
            if (words.length > 0)
                patient.lastName = capitalizeName(words.join(' '));
        }
    }
    if (!patient.firstName) {
        const match = FIRST_NAME_LABEL.exec(scope);
        if (match) {
            const words = captureNameWords(scope, match.index + match[0].length, 2);
            if (words.length > 0)
                patient.firstName = capitalizeName(words.join(' '));
        }
    }
    const assignNumber = (label, key) => {
        const match = label.exec(scope);
        if (!match)
            return;
        const start = match.index + match[0].length;
        const window = scope.slice(start, start + 60);
        const found = findRomanianNumber(window);
        if (!found)
            return;
        // The age field is in years: "vârsta 7 luni" is left for the doctor.
        if (key === 'age' && AGE_NOT_IN_YEARS.test(normalizeNumberText(window).slice(found.end)))
            return;
        // Height is stored in centimeters; "1,75" (meters) becomes "175".
        const meters = Number(found.value);
        patient[key] = key === 'height' && meters > 0 && meters < 3
            ? String(Math.round(meters * 100))
            : found.value;
    };
    assignNumber(AGE_LABEL, 'age');
    if (!patient.age && !AGE_LABEL.test(scope))
        patient.age = unlabeledAge(scope);
    assignNumber(WEIGHT_LABEL, 'weight');
    assignNumber(HEIGHT_LABEL, 'height');
    return patient;
}
/**
 * Deterministically extracts only explicitly spoken Echo measurements.
 *
 * The parser never diagnoses, interprets, infers, or invents medical data:
 * a value is extracted only when a known field alias is followed by an
 * unambiguous number (or, for qualitative fields, by dictated text). Numbers
 * that cannot be bound to a field are left untouched for manual review.
 */
export function parseEchoTranscript(transcript) {
    const measurements = [];
    const conclusions = extractConclusions(transcript);
    const patient = extractPatientInfo(transcript);
    const raw = beforeConclusions(transcript);
    const { text, rawIndex } = normalizeWithIndex(raw);
    if (text.length === 0) {
        return { measurements, conclusions, patient };
    }
    const matches = collectMatches(text);
    const toRaw = (index) => index >= text.length ? raw.length : rawIndex[index];
    let activeContext = null;
    // Aliases that start inside an already-consumed alias span are skipped:
    // they are sub-phrases of the longer alias that won at that position
    // (e.g. "diametrul anteroposterior" inside "as diametrul anteroposterior").
    let consumedUntil = -1;
    let i = 0;
    while (i < matches.length) {
        const start = matches[i].start;
        let j = i;
        while (j < matches.length && matches[j].start === start)
            j += 1;
        const group = matches.slice(i, j);
        i = j;
        const end = group[0].end;
        if (start < consumedUntil)
            continue;
        consumedUntil = end;
        // The value window ends at the first match starting at or after this
        // alias ends — a nested sub-phrase alias must never cut the window.
        let k = i;
        while (k < matches.length && matches[k].start < end)
            k += 1;
        const windowEnd = k < matches.length ? matches[k].start : text.length;
        // The longest alias wins at a position ("unda e'" over "unda e"); when
        // several field definitions share that alias ("vmax" exists in several
        // flow sections), the one matching the active flow context is chosen.
        const longest = group.filter((m) => m.end === end);
        const contextMatch = longest.find((m) => m.kind === 'context');
        if (contextMatch) {
            activeContext = contextMatch.context ?? null;
            // A context alias may coincide with a field alias (e.g.
            // "regurgitare tricuspidiana" both names the tricuspid section and is
            // itself a qualitative field). When that happens we fall through and
            // extract the field as well; a pure section heading has no field
            // alias at the same span and is skipped below.
        }
        const defMatch = longest.find((m) => {
            if (m.kind === 'context' || m.kind === 'boundary' || m.def === undefined)
                return false;
            if ('context' in m.def) {
                if (m.def.context !== undefined && m.def.context !== activeContext)
                    return false;
            }
            const excluded = 'excludeContexts' in m.def ? m.def.excludeContexts : undefined;
            if (excluded !== undefined && activeContext !== null && excluded.includes(activeContext)) {
                return false;
            }
            return true;
        });
        if (!defMatch || !defMatch.def)
            continue;
        const def = defMatch.def;
        const rawStart = toRaw(start);
        const rawWindowStart = toRaw(end);
        const rawWindowEnd = toRaw(windowEnd);
        const punctuation = findNextPunctuation(raw, rawWindowStart, rawWindowEnd);
        const bound = punctuation ?? rawWindowEnd;
        const rawWindow = raw.slice(rawWindowStart, bound);
        const normWindow = normalize(rawWindow);
        const sourceText = raw.slice(rawStart, bound).trim();
        const hedgeText = text.slice(lookbackStart(text, start, 5), windowEnd);
        const confidence = confidenceFor(hedgeText);
        if (defMatch.kind === 'qualitative') {
            const value = qualitativeValue(rawWindow);
            // Bare labels like "Pericard, lichid pericardic" are valid diagnoses by
            // themselves; in that case the value is the field name itself.
            const bareLabelValue = def.field === 'pericardialFluid' ? 'lichid pericardic' : null;
            const resolvedValue = value ?? (rawWindow.trim() ? null : bareLabelValue);
            if (!resolvedValue)
                continue;
            // Drop a trailing field separator before the next known field
            // ("Valve mitralesuple, valve tricuspide..." → source ends at "suple").
            const qualitativeSource = sourceText.replace(/[\s,;]+$/g, '');
            measurements.push({
                field: def.field,
                label: MEASUREMENT_FIELDS[def.field].reviewLabel,
                value: resolvedValue,
                kind: 'qualitative',
                confidence,
                sourceText: qualitativeSource || sourceText,
            });
            continue;
        }
        const numericDef = def;
        if (numericDef.context && numericDef.context !== activeContext)
            continue;
        if (numericDef.excludeContexts &&
            activeContext !== null &&
            numericDef.excludeContexts.includes(activeContext)) {
            continue;
        }
        const valueCount = countNumericValues(normWindow);
        if (valueCount === 0)
            continue;
        const ambiguous = valueCount > 1;
        const number = findRomanianNumber(normWindow);
        if (!number)
            continue;
        if (numericDef.field === 'lvEjectionFractionTeicholz' && normWindow.includes('simpson'))
            continue;
        const spokenUnit = findUnit(normWindow.slice(number.end))?.unit;
        const expectedUnit = MEASUREMENT_UNITS[numericDef.field];
        let value = number.value;
        let unit = spokenUnit;
        let convertedFrom;
        let unitMismatch;
        if (spokenUnit && expectedUnit && spokenUnit !== expectedUnit) {
            const converted = convertUnit(number.value, spokenUnit, expectedUnit);
            if (converted !== null) {
                value = converted;
                unit = expectedUnit;
                convertedFrom = spokenUnit;
            }
            else {
                unitMismatch = true;
            }
        }
        measurements.push({
            field: numericDef.field,
            label: MEASUREMENT_FIELDS[numericDef.field].reviewLabel,
            value,
            unit,
            kind: 'numeric',
            confidence: ambiguous ? 'low' : confidence,
            sourceText,
            ...(ambiguous ? { ambiguousValue: true } : {}),
            ...(convertedFrom ? { convertedFrom } : {}),
            ...(unitMismatch ? { unitMismatch } : {}),
        });
    }
    return { measurements, conclusions, patient };
}
