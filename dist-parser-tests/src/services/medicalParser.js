import { findRomanianNumber } from './romanianNumberParser.js';
import { findUnit } from './unitNormalizer.js';
const CONTEXT_ALIASES = {
    aortic: ['flux aortic', 'fluxul aortic'],
    lvot: ['flux lvot', 'fluxul lvot', 'tract de ejectie', 'tractul de ejectie'],
    mitral: ['flux mitral', 'fluxul mitral'],
    tricuspid: ['flux tricuspidian', 'fluxul tricuspidian'],
    pulmonary: ['flux pulmonar', 'fluxul pulmonar'],
    septal: ['doppler tisular sept', 'doppler tisular', 'dopplerul tisular'],
    apical4c: ['apical 4c', 'apical 4 camere', 'apicala 4 camere'],
};
const NUMERIC_FIELDS = [
    // Secțiune longitudinală parasternală
    {
        field: 'lvEndDiastolicDiameter',
        label: 'VS — diametrul telediastolic',
        aliases: [
            'vs diametrul telediastolic',
            // Whisper splits "telediastolic" into "tele diastolic" (with or
            // without a comma between the two words).
            'vs diametrul tele diastolic',
            'vs diametru tele diastolic',
            'vs telediastolic',
            'ventricul stang diametrul telediastolic',
            'ps diametrul telediastolic',
            'ps telediastolic',
        ],
    },
    {
        field: 'lvEndSystolicDiameter',
        label: 'VS — diametrul telesistolic',
        aliases: [
            'vs diametrul telesistolic',
            // Whisper splits "telesistolic" into "tele sistolic" (with or
            // without a comma between the two words).
            'vs diametrul tele sistolic',
            'vs diametru tele sistolic',
            'vs telesistolic',
            'ventricul stang diametrul telesistolic',
            'ps diametrul telesistolic',
            'ps telesistolic',
        ],
    },
    {
        field: 'ivsDiastolicDiameter',
        label: 'SIV — diametrul diastolic',
        aliases: [
            'siv diametrul diastolic',
            // Shorter spoken form without the "-l" article.
            'siv diametru diastolic',
            'siv diam diastolic',
            'siv diam. diastolic',
            'siv diastolic',
            // Known Whisper transcription variants of "diastolic".
            'siv diametrul siastolic',
            'siv diam siastolic',
            'siv diametrul diasolic',
            'siv diam diasolic',
            'sept interventricular diametrul diastolic',
        ],
    },
    {
        field: 'posteriorWallDiastolicDiameter',
        label: 'Perete posterior — diametrul diastolic',
        aliases: [
            'perete posterior diametrul diastolic',
            'perete posterior diametru diastolic',
            // Known Whisper transcription variant of "diastolic".
            'perete posterior diametrul distolic',
            'perete posterior distolic',
            // Dictated shorthand: the doctor may omit "diametru diastolic"
            // entirely because the form context identifies this field.
            'perete posterior',
            'peretele posterior',
        ],
    },
    {
        field: 'lvEjectionFractionTeicholz',
        label: 'Fracție de ejecție VS (Teicholz)',
        aliases: [
            'fractie de ejectie vs teicholz',
            'fractie de ejectie teicholz',
            'fractie de ejectie vs teicholtz',
            'fractie de ejectie teicholtz',
            'fractie de ejectie vs tai ciolti',
            'fractie de ejectie tai ciolti',
            'fractie de ejectie vs taiciolti',
            'fractie de ejectie taiciolti',
            'fractie de ejectie vs',
            'fractia de ejectie vs',
            // Whisper/colloquial plural and abbreviated forms.
            'fractii de ejectie vs',
            'fractiile de ejectie vs',
            'fe vs',
            'fe ventricul stang',
            'fractie de ejectie',
            'fractia de ejectie',
        ],
    },
    {
        field: 'shorteningFraction',
        label: 'Fracție de scurtare',
        aliases: ['fractie de scurtare', 'fractia de scurtare'],
    },
    {
        field: 'lvMass',
        label: 'Masă VS',
        aliases: ['masa vs', 'masa ventricul stang'],
    },
    {
        field: 'aortaAnnulus',
        label: 'Aortă la inel',
        aliases: ['aorta la inel', 'aorta la inelul', 'aorta inel'],
    },
    {
        field: 'ascendingAorta',
        label: 'Aortă ascendentă',
        aliases: ['aorta ascendenta'],
    },
    {
        field: 'laAnteroposteriorDiameter',
        label: 'AS — diametrul antero-posterior',
        aliases: [
            'as diametrul antero posterior',
            'as diametrul anteroposterior',
            // Shorter spoken forms without the "-l" article.
            'as diametru antero posterior',
            'as diametru anteroposterior',
            'atriul stang diametrul antero posterior',
            // Dictated without the "AS" prefix ("Diametrul anteroposterior, 3 cm").
            'diametrul anteroposterior',
            'diametrul antero posterior',
        ],
    },
    {
        field: 'aortaAtArch',
        label: 'Aortă la nivelul croșei',
        aliases: ['aorta la nivelul crosei', 'aorta la nivelul crossei', 'aorta la crosa'],
    },
    {
        field: 'pulmonaryArtery',
        label: 'Arteră pulmonară',
        aliases: ['artera pulmonara'],
    },
    // Apical 4C
    {
        field: 'lvLateromedialDiameter',
        label: 'VS — diametrul latero-median',
        aliases: [
            'vs diametrul latero median',
            'vs diametrul lateromedian',
            'vs diam latero median',
            'vs diam lateromedian',
        ],
    },
    {
        field: 'rvLateromedialDiameter',
        label: 'VD — diametrul latero-median',
        aliases: [
            'vd diametrul latero median',
            'vd diametrul lateromedian',
            'vd diam latero median',
            'vd diam lateromedian',
        ],
    },
    {
        field: 'laLateromedialDiameter',
        label: 'AS — diametrul latero-median',
        aliases: [
            'as diametrul latero median',
            'as diametrul lateromedian',
            'as diam latero median',
            'as diam lateromedian',
        ],
    },
    {
        field: 'raLateromedialDiameter',
        label: 'AD — diametrul latero-median',
        aliases: [
            'ad diametrul latero median',
            'ad diametrul lateromedian',
            'ad diam latero median',
            'ad diam lateromedian',
        ],
    },
    // In APICAL 4C dictation the first bare "diametrul latero-median" is
    // conventionally the VS one (the form order is VS, VD, AS, AD). The bare
    // phrase maps to VS only inside the apical 4C context; outside it the
    // phrase stays unparsed rather than guessed.
    {
        field: 'lvLateromedialDiameter',
        label: 'VS — diametrul latero-median',
        aliases: ['diametrul latero median', 'diametrul lateromedian', 'diam latero median', 'diam lateromedian'],
        context: 'apical4c',
    },
    {
        field: 'mapse',
        label: 'MAPSE',
        aliases: ['mapse'],
    },
    {
        field: 'tapse',
        label: 'TAPSE',
        aliases: ['tapse'],
    },
    // Alte măsurători
    {
        field: 'laArea',
        label: 'Aria AS',
        aliases: ['aria as', 'aria atriului stang'],
    },
    {
        field: 'raArea',
        label: 'Aria AD',
        aliases: ['aria ad', 'aria atriului drept'],
    },
    {
        field: 'lvEndDiastolicVolume',
        label: 'Volum telediastolic VS',
        aliases: ['volum telediastolic vs', 'volumul telediastolic vs', 'volum telediastolic'],
    },
    {
        field: 'lvEndSystolicVolume',
        label: 'Volum telesistolic VS',
        aliases: ['volum telesistolic vs', 'volumul telesistolic vs', 'volum telesistolic'],
    },
    {
        field: 'lvEjectionFractionSimpson',
        label: 'Fracție de ejecție Simpson',
        aliases: [
            'fractie de ejectie simpson',
            'fractia de ejectie simpson',
            'fractie ejectie simpson',
            'fractia ejectie simpson',
            'fe simpson',
        ],
    },
    {
        field: 'aorticValveArea',
        label: 'Aria valvei aortice',
        aliases: ['aria valvei aortice', 'aria valvulei aortice'],
    },
    {
        field: 'mitralValveArea',
        label: 'Aria valvei mitrale',
        aliases: ['aria valvei mitrale', 'aria valvulei mitrale'],
    },
    // Doppler — flux aortic
    { field: 'aorticVmax', label: 'Flux aortic — Vmax', aliases: ['vmax', 'v max'], context: 'aortic' },
    { field: 'aorticPmax', label: 'Flux aortic — Pmax', aliases: ['pmax', 'p max'], context: 'aortic' },
    { field: 'aorticPmean', label: 'Flux aortic — Pmediu', aliases: ['pmediu', 'p mediu'], context: 'aortic' },
    // Doppler — flux LVOT
    { field: 'lvotVmax', label: 'Flux LVOT — Vmax', aliases: ['vmax', 'v max'], context: 'lvot' },
    { field: 'lvotPmax', label: 'Flux LVOT — Pmax', aliases: ['pmax', 'p max'], context: 'lvot' },
    { field: 'lvotVti', label: 'Flux LVOT — VTI', aliases: ['vti'], context: 'lvot' },
    // Doppler — flux mitral
    { field: 'mitralE', label: 'Flux mitral — Undă E', aliases: ['unda e'], context: 'mitral' },
    { field: 'mitralA', label: 'Flux mitral — Undă A', aliases: ['unda a'], context: 'mitral' },
    { field: 'mitralEaRatio', label: 'Flux mitral — E/A', aliases: ['e/a', 'e a'], context: 'mitral' },
    { field: 'mitralDecelerationTime', label: 'Flux mitral — TDE', aliases: ['tde', 'timp de deceleratie'], context: 'mitral' },
    { field: 'mitralTriv', label: 'Flux mitral — TRIV', aliases: ['triv'], context: 'mitral' },
    // Doppler — flux tricuspidian
    { field: 'tricuspidVmax', label: 'Flux tricuspidian — Vmax', aliases: ['vmax', 'v max'], context: 'tricuspid' },
    { field: 'tricuspidPmax', label: 'Flux tricuspidian — Pmax', aliases: ['pmax', 'p max'], context: 'tricuspid' },
    { field: 'psvd', label: 'Flux tricuspidian — PSVD', aliases: ['psvd'], context: 'tricuspid' },
    { field: 'tricuspidE', label: 'Flux tricuspidian — Undă E', aliases: ['unda e'], context: 'tricuspid' },
    { field: 'tricuspidA', label: 'Flux tricuspidian — Undă A', aliases: ['unda a'], context: 'tricuspid' },
    { field: 'tricuspidEaRatio', label: 'Flux tricuspidian — E/A', aliases: ['e/a', 'e a'], context: 'tricuspid' },
    // Doppler — flux pulmonar
    { field: 'pulmonaryVmax', label: 'Flux pulmonar — Vmax', aliases: ['vmax', 'v max'], context: 'pulmonary' },
    { field: 'pulmonaryPmax', label: 'Flux pulmonar — Pmax', aliases: ['pmax', 'p max'], context: 'pulmonary' },
    { field: 'pulmonaryVti', label: 'Flux pulmonar — VTI', aliases: ['vti'], context: 'pulmonary' },
    // Doppler tisular (sept)
    { field: 'septalEPrime', label: "Doppler tisular — Undă E'", aliases: ["unda e'", 'unda e prim', 'unda e prime'], context: 'septal' },
    { field: 'septalAPrime', label: "Doppler tisular — Undă A'", aliases: ["unda a'", 'unda a prim', 'unda a prime'], context: 'septal' },
    { field: 'septalEaPrimeRatio', label: "Doppler tisular — E'/A'", aliases: ["e'/a'", 'e prim a prim', 'e prim pe a prim'], context: 'septal' },
    { field: 'eePrimeRatio', label: "Doppler tisular — E/E'", aliases: ["e/e'", 'e e prim', 'e pe e prim'], context: 'septal' },
    { field: 'septalS', label: 'Doppler tisular — Undă S', aliases: ['unda s'], context: 'septal' },
];
const QUALITATIVE_FIELDS = [
    { field: 'aorticRegurgitation', label: 'Regurgitare aortică', aliases: ['regurgitare aortica'] },
    { field: 'mitralRegurgitation', label: 'Regurgitare mitrală', aliases: ['regurgitare mitrala'] },
    { field: 'tricuspidRegurgitation', label: 'Regurgitare tricuspidiană', aliases: ['regurgitare tricuspidiana'] },
    { field: 'pulmonaryRegurgitation', label: 'Regurgitare pulmonară', aliases: ['regurgitare pulmonara'] },
    {
        field: 'pericardialFluid',
        label: 'Lichid pericardic',
        aliases: [
            'lichid pericardic',
            // Whisper concatenation of "pericard, lichid pericardic".
            'pericardichid pericardic',
        ],
    },
    { field: 'wallMotion', label: 'Cinetică parietală', aliases: ['cinetica parietala'] },
    { field: 'aorticValves', label: 'Valve aortice', aliases: ['valve aortice'] },
    { field: 'mitralValves', label: 'Valve mitrale', aliases: ['valve mitrale'] },
];
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
// after a number ("2,2. Următoarea…") still ends the window.
const PUNCTUATION_BOUNDARY = /(?<!\d)[.!?;…\n]|(?<=\d)[.!?;…\n](?!\d)/;
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
// Protects decimal commas ("5,3", "4,85") from ever being treated as
// separators by replacing them with a decimal point. The replacement is
// 1:1 (comma to dot), so character positions and the rawIndex mapping
// stay valid. Field-separator commas ("," between words) are untouched.
function protectDecimalCommas(text) {
    return text.replace(/(\d),(\d)/g, '$1.$2');
}
function normalize(text) {
    let out = '';
    for (const ch of text) {
        if (isSpace(ch) || ch === '-') {
            if (out.length > 0 && out[out.length - 1] !== ' ')
                out += ' ';
            continue;
        }
        out += normalizeChar(ch);
    }
    return protectDecimalCommas(out.trim());
}
// Collapses whitespace/hyphens and records the raw position of every
// normalized character so that spans can be mapped back to the transcript.
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
        text += normalizeChar(ch);
        rawIndex.push(i);
    }
    return { text: protectDecimalCommas(text.trim()), rawIndex };
}
function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// Field aliases are matched word by word, tolerating comma or semicolon
// separators between the words ("vs, diametrul telediastolic") exactly as
// Whisper dictates them, while decimal commas are already protected above.
function aliasPattern(alias) {
    const words = alias.split(' ').map((word) => escapeRegExp(word));
    return new RegExp(`(?<![a-z0-9])${words.join('[\\s,;]+')}(?![a-z0-9])`, 'g');
}
function collectMatches(normalizedText) {
    const matches = [];
    for (const [context, aliases] of Object.entries(CONTEXT_ALIASES)) {
        for (const alias of aliases) {
            const pattern = aliasPattern(alias);
            for (const match of normalizedText.matchAll(pattern)) {
                matches.push({
                    kind: 'context',
                    start: match.index ?? 0,
                    end: (match.index ?? 0) + match[0].length,
                    context,
                });
            }
        }
    }
    for (const def of NUMERIC_FIELDS) {
        for (const alias of def.aliases) {
            const pattern = aliasPattern(alias);
            for (const match of normalizedText.matchAll(pattern)) {
                matches.push({
                    kind: 'field',
                    start: match.index ?? 0,
                    end: (match.index ?? 0) + match[0].length,
                    def,
                });
            }
        }
    }
    for (const def of QUALITATIVE_FIELDS) {
        for (const alias of def.aliases) {
            const pattern = aliasPattern(alias);
            for (const match of normalizedText.matchAll(pattern)) {
                matches.push({
                    kind: 'qualitative',
                    start: match.index ?? 0,
                    end: (match.index ?? 0) + match[0].length,
                    def,
                });
            }
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
        rest = rest.slice(found.end);
    }
    return count;
}
// Returns the normalized index of the start of the Nth word before `from`.
function lookbackStart(text, from, wordCount) {
    let pos = from;
    let seen = 0;
    while (pos > 0 && seen < wordCount) {
        let i = pos - 1;
        while (i >= 0 && /\s/.test(text[i]))
            i -= 1;
        if (i < 0)
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
    const value = rawWindow
        .slice(rawIndex[pos])
        .replace(/^[\s,;]+/, '')
        .trim();
    return value || null;
}
function findNextPunctuation(raw, from, limit) {
    const match = PUNCTUATION_BOUNDARY.exec(raw.slice(from, limit));
    return match ? from + (match.index ?? 0) : null;
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
    const raw = transcript;
    const { text, rawIndex } = normalizeWithIndex(raw);
    if (text.length === 0) {
        return { measurements };
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
            continue;
        }
        const defMatch = longest.find((m) => {
            if (m.kind === 'context' || m.def === undefined)
                return false;
            if ('context' in m.def) {
                return m.def.context === undefined || m.def.context === activeContext;
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
            if (!value)
                continue;
            measurements.push({
                field: def.field,
                label: def.label,
                value,
                kind: 'qualitative',
                confidence,
                sourceText,
            });
            continue;
        }
        const numericDef = def;
        if (numericDef.context && numericDef.context !== activeContext)
            continue;
        const valueCount = countNumericValues(normWindow);
        if (valueCount === 0)
            continue;
        if (valueCount > 1)
            continue;
        const number = findRomanianNumber(normWindow);
        if (!number)
            continue;
        if (numericDef.field === 'lvEjectionFractionTeicholz' && normWindow.includes('simpson'))
            continue;
        const unitMatch = findUnit(normWindow.slice(number.end));
        measurements.push({
            field: numericDef.field,
            label: numericDef.label,
            value: number.value,
            unit: unitMatch?.unit,
            kind: 'numeric',
            confidence,
            sourceText,
        });
    }
    return { measurements };
}
