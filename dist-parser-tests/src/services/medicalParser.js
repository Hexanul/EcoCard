import { findRomanianNumber } from './romanianNumberParser.js';
import { normalizeUnit } from './unitNormalizer.js';
function normalized(text) {
    return text
        .toLocaleLowerCase('ro-RO')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[șş]/g, 's')
        .replace(/[țţ]/g, 't')
        .replace(/\s+/g, ' ')
        .trim();
}
const fields = [
    { field: 'lvEndDiastolicDiameter', label: 'VS diametrul telediastolic', aliases: ['vs diametrul telediastolic', 'ventricul stang diametrul telediastolic'] },
    { field: 'lvEndSystolicDiameter', label: 'VS diametrul telesistolic', aliases: ['vs diametrul telesistolic', 'ventricul stang diametrul telesistolic'] },
    { field: 'ivsDiastolicDiameter', label: 'SIV diametrul diastolic', aliases: ['siv diametrul diastolic', 'sept interventricular diametrul diastolic'] },
    { field: 'posteriorWallDiastolicDiameter', label: 'Perete posterior diametrul diastolic', aliases: ['perete posterior diametrul diastolic', 'perete posterior diametru diastolic'] },
    { field: 'lvEjectionFractionSimpson', label: 'Fracție de ejecție Simpson', aliases: ['fractie de ejectie simpson', 'fe simpson'] },
    { field: 'lvEjectionFractionTeicholz', label: 'Fracție de ejecție VS Teicholz', aliases: ['fractie de ejectie vs teicholz', 'fractie de ejectie teicholz', 'fractie de ejectie vs', 'fractie de ejectie'] },
    { field: 'shorteningFraction', label: 'Fracție de scurtare', aliases: ['fractie de scurtare'] },
    { field: 'lvMass', label: 'Masă VS', aliases: ['masa vs', 'masa ventricul stang'] },
    { field: 'aortaAnnulus', label: 'Aortă la inel', aliases: ['aorta la inel'] },
    { field: 'ascendingAorta', label: 'Aortă ascendentă', aliases: ['aorta ascendenta'] },
    { field: 'laAnteroposteriorDiameter', label: 'AS diametrul antero-posterior', aliases: ['as diametrul antero posterior', 'as diametrul anteroposterior'] },
    { field: 'aortaAtArch', label: 'Aortă la nivelul croșei', aliases: ['aorta la nivelul crosei'] },
    { field: 'pulmonaryArtery', label: 'Arteră pulmonară', aliases: ['artera pulmonara'] },
    { field: 'lvLateromedialDiameter', label: 'VS diametrul latero-median', aliases: ['vs diametrul latero median'] },
    { field: 'rvLateromedialDiameter', label: 'VD diametrul latero-median', aliases: ['vd diametrul latero median'] },
    { field: 'laLateromedialDiameter', label: 'AS diametrul latero-median', aliases: ['as diametrul latero median'] },
    { field: 'raLateromedialDiameter', label: 'AD diametrul latero-median', aliases: ['ad diametrul latero median'] },
    { field: 'mapse', label: 'MAPSE', aliases: ['mapse'] },
    { field: 'tapse', label: 'TAPSE', aliases: ['tapse'] },
    { field: 'laArea', label: 'Aria AS', aliases: ['aria as'] },
    { field: 'raArea', label: 'Aria AD', aliases: ['aria ad'] },
    { field: 'lvEndDiastolicVolume', label: 'Volum telediastolic VS', aliases: ['volum telediastolic vs'] },
    { field: 'lvEndSystolicVolume', label: 'Volum telesistolic VS', aliases: ['volum telesistolic vs'] },
    { field: 'aorticValveArea', label: 'Aria valvei aortice', aliases: ['aria valvei aortice'] },
    { field: 'mitralValveArea', label: 'Aria valvei mitrale', aliases: ['aria valvei mitrale'] },
    { field: 'mitralDecelerationTime', label: 'TDE', aliases: ['tde'] },
    { field: 'mitralTriv', label: 'TRIV', aliases: ['triv'] },
    { field: 'psvd', label: 'PSVD', aliases: ['psvd'] },
];
const qualitativeFields = [
    { field: 'aorticRegurgitation', label: 'Regurgitare aortică', aliases: ['regurgitare aortica'] },
    { field: 'mitralRegurgitation', label: 'Regurgitare mitrală', aliases: ['regurgitare mitrala'] },
    { field: 'tricuspidRegurgitation', label: 'Regurgitare tricuspidiană', aliases: ['regurgitare tricuspidiana'] },
    { field: 'pulmonaryRegurgitation', label: 'Regurgitare pulmonară', aliases: ['regurgitare pulmonara'] },
    { field: 'pericardialFluid', label: 'Lichid pericardic', aliases: ['lichid pericardic'] },
];
const contexts = [
    { context: 'aortic', aliases: ['flux aortic'] },
    { context: 'lvot', aliases: ['flux lvot', 'tract de ejectie'] },
    { context: 'mitral', aliases: ['flux mitral'] },
    { context: 'tricuspid', aliases: ['flux tricuspidian'] },
    { context: 'pulmonary', aliases: ['flux pulmonar'] },
    { context: 'septal', aliases: ['doppler tisular sept', 'doppler tisular septal'] },
];
const flowFields = {
    aortic: [
        { field: 'aorticVmax', label: 'Flux aortic Vmax', aliases: ['vmax'] },
        { field: 'aorticPmax', label: 'Flux aortic Pmax', aliases: ['pmax'] },
        { field: 'aorticPmean', label: 'Flux aortic Pmediu', aliases: ['pmediu', 'p mediu'] },
    ],
    lvot: [
        { field: 'lvotVmax', label: 'Flux LVOT Vmax', aliases: ['vmax'] },
        { field: 'lvotPmax', label: 'Flux LVOT Pmax', aliases: ['pmax'] },
        { field: 'lvotVti', label: 'Flux LVOT VTI', aliases: ['vti'] },
    ],
    mitral: [
        { field: 'mitralE', label: 'Flux mitral Unda E', aliases: ['unda e'] },
        { field: 'mitralA', label: 'Flux mitral Unda A', aliases: ['unda a'] },
        { field: 'mitralEaRatio', label: 'Flux mitral E/A', aliases: ['e/a', 'e a'] },
    ],
    tricuspid: [
        { field: 'tricuspidVmax', label: 'Flux tricuspidian Vmax', aliases: ['vmax'] },
        { field: 'tricuspidPmax', label: 'Flux tricuspidian Pmax', aliases: ['pmax'] },
        { field: 'psvd', label: 'Flux tricuspidian PSVD', aliases: ['psvd'] },
        { field: 'tricuspidE', label: 'Flux tricuspidian Unda E', aliases: ['unda e'] },
        { field: 'tricuspidA', label: 'Flux tricuspidian Unda A', aliases: ['unda a'] },
        { field: 'tricuspidEaRatio', label: 'Flux tricuspidian E/A', aliases: ['e/a', 'e a'] },
    ],
    pulmonary: [
        { field: 'pulmonaryVmax', label: 'Flux pulmonar Vmax', aliases: ['vmax'] },
        { field: 'pulmonaryPmax', label: 'Flux pulmonar Pmax', aliases: ['pmax'] },
        { field: 'pulmonaryVti', label: 'Flux pulmonar VTI', aliases: ['vti'] },
    ],
    septal: [
        { field: 'septalEPrime', label: "Doppler tisular sept Unda E'", aliases: ["unda e'", 'unda e prim', 'unda e prime'] },
        { field: 'septalAPrime', label: "Doppler tisular sept Unda A'", aliases: ["unda a'", 'unda a prim', 'unda a prime'] },
        { field: 'septalEaPrimeRatio', label: "Doppler tisular sept E'/A'", aliases: ["e'/a'", 'e prim a prim'] },
        { field: 'eePrimeRatio', label: "Doppler tisular sept E/E'", aliases: ["e/e'", 'e e prim'] },
        { field: 'septalS', label: 'Doppler tisular sept Unda S', aliases: ['unda s'] },
    ],
};
function confidenceFor(segment) {
    const value = normalized(segment);
    if (/\b(probabil|posibil|nu sunt sigur|nesigur)\b/.test(value))
        return 'low';
    if (/\b(aproximativ|circa|cam)\b/.test(value))
        return 'medium';
    return 'high';
}
function aliasIn(text, aliases) {
    for (const alias of aliases) {
        const index = text.indexOf(alias);
        if (index >= 0)
            return { alias, index };
    }
    return null;
}
function numericFromDefinition(definition, rawSegment) {
    const segment = normalized(rawSegment);
    if (definition.field === 'lvEjectionFractionTeicholz' && segment.includes('simpson'))
        return null;
    const matched = aliasIn(segment, definition.aliases);
    if (!matched)
        return null;
    const afterAlias = segment.slice(matched.index + matched.alias.length);
    const number = findRomanianNumber(afterAlias);
    if (!number)
        return null;
    return {
        field: definition.field,
        label: definition.label,
        value: number.value,
        unit: normalizeUnit(afterAlias.slice(number.end)),
        confidence: confidenceFor(rawSegment),
        sourceText: rawSegment.trim(),
        kind: 'numeric',
    };
}
function exactTextAfterAlias(rawSegment, aliases) {
    const rawWords = [...rawSegment.matchAll(/[\p{L}\d]+/gu)].map((match) => match[0]);
    const words = rawWords.map(normalized);
    for (const alias of aliases) {
        const aliasWords = alias.split(' ');
        for (let start = 0; start <= words.length - aliasWords.length; start += 1) {
            if (aliasWords.every((word, index) => words[start + index] === word)) {
                const value = rawWords.slice(start + aliasWords.length).join(' ').trim();
                return value || null;
            }
        }
    }
    return null;
}
function qualitativeFromDefinition(definition, rawSegment) {
    const value = exactTextAfterAlias(rawSegment, definition.aliases);
    if (!value)
        return null;
    return {
        field: definition.field,
        label: definition.label,
        value,
        confidence: confidenceFor(rawSegment),
        sourceText: rawSegment.trim(),
        kind: 'qualitative',
    };
}
function contextIn(segment) {
    const value = normalized(segment);
    return contexts.find(({ aliases }) => aliasIn(value, aliases))?.context ?? null;
}
function parseSegment(rawSegment, activeContext) {
    const result = [];
    for (const definition of fields) {
        const measurement = numericFromDefinition(definition, rawSegment);
        if (measurement)
            result.push(measurement);
    }
    if (activeContext) {
        for (const definition of flowFields[activeContext]) {
            const measurement = numericFromDefinition(definition, rawSegment);
            if (measurement)
                result.push(measurement);
        }
    }
    for (const definition of qualitativeFields) {
        const measurement = qualitativeFromDefinition(definition, rawSegment);
        if (measurement)
            result.push(measurement);
    }
    return result;
}
/**
 * Deterministically extracts only explicitly spoken Echo measurements. It does not
 * calculate, interpret, diagnose, convert units, or infer a missing value/context.
 */
export function parseEchoTranscript(transcript) {
    const measurements = [];
    for (const sentence of transcript.split(/[.!?\n]+/)) {
        let activeContext = null;
        for (const segment of sentence.split(/[;,]+/)) {
            const trimmed = segment.trim();
            if (!trimmed)
                continue;
            activeContext = contextIn(trimmed) ?? activeContext;
            measurements.push(...parseSegment(trimmed, activeContext));
        }
    }
    return { measurements };
}
