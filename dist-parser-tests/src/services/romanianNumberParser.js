const SINGLE_DIGITS = {
    zero: 0,
    un: 1,
    unu: 1,
    una: 1,
    o: 1,
    doi: 2,
    doua: 2,
    trei: 3,
    patru: 4,
    cinci: 5,
    sase: 6,
    sapte: 7,
    opt: 8,
    noua: 9,
};
const TEENS = {
    zece: 10,
    unsprezece: 11,
    doisprezece: 12,
    treisprezece: 13,
    paisprezece: 14,
    cincisprezece: 15,
    saisprezece: 16,
    saptesprezece: 17,
    optsprezece: 18,
    nouasprezece: 19,
};
const TENS = {
    douazeci: 20,
    treizeci: 30,
    patruzeci: 40,
    cincizeci: 50,
    saizeci: 60,
    saptezeci: 70,
    optzeci: 80,
    nouazeci: 90,
};
const NUMBER_WORDS = {
    ...SINGLE_DIGITS,
    ...TEENS,
    ...TENS,
};
function normalize(text) {
    return text
        .toLocaleLowerCase('ro-RO')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[șş]/g, 's')
        .replace(/[țţ]/g, 't')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function tokenize(text) {
    const normalized = normalize(text);
    return [...normalized.matchAll(/\d+(?:[.,]\d+)?|[a-z]+/g)].map((match) => ({
        value: match[0],
        start: match.index ?? 0,
        end: (match.index ?? 0) + match[0].length,
    }));
}
function parseInteger(tokens, start) {
    let index = start;
    let total = 0;
    let current = 0;
    let consumed = false;
    while (index < tokens.length) {
        const token = tokens[index].value;
        if (token === 'si') {
            if (!consumed)
                break;
            index += 1;
            continue;
        }
        if (token === 'suta' || token === 'sute') {
            if (!consumed)
                break;
            total += (current || 1) * 100;
            current = 0;
            consumed = true;
            index += 1;
            continue;
        }
        const number = NUMBER_WORDS[token];
        if (number === undefined)
            break;
        current += number;
        consumed = true;
        index += 1;
    }
    return consumed ? { value: total + current, next: index } : null;
}
function fractionText(tokens, start) {
    const first = tokens[start];
    if (!first)
        return null;
    if (/^\d+(?:[.,]\d+)?$/.test(first.value)) {
        return { value: first.value.replace(/\D/g, ''), next: start + 1 };
    }
    const digitValues = [];
    let index = start;
    while (index < tokens.length && SINGLE_DIGITS[tokens[index].value] !== undefined) {
        digitValues.push(SINGLE_DIGITS[tokens[index].value]);
        index += 1;
    }
    if (digitValues.length > 0) {
        return { value: digitValues.join(''), next: index };
    }
    const integer = parseInteger(tokens, start);
    return integer ? { value: String(integer.value), next: integer.next } : null;
}
/**
 * Finds the first numeric expression in a Romanian phrase, including spoken
 * decimals ("patru virgulă opt") and already-digit forms ("4,8", "4.8", "21").
 * Returns null when the text contains no number.
 */
export function findRomanianNumber(text) {
    const tokens = tokenize(text);
    for (let index = 0; index < tokens.length; index += 1) {
        const direct = tokens[index];
        if (/^\d+(?:[.,]\d+)?$/.test(direct.value)) {
            return {
                value: direct.value.replace(',', '.'),
                start: direct.start,
                end: direct.end,
                sourceText: text.slice(direct.start, direct.end),
            };
        }
        const integer = parseInteger(tokens, index);
        if (!integer)
            continue;
        let endToken = tokens[integer.next - 1];
        let value = String(integer.value);
        if (tokens[integer.next]?.value === 'virgula' || tokens[integer.next]?.value === 'punct') {
            const fraction = fractionText(tokens, integer.next + 1);
            if (fraction) {
                value = `${integer.value}.${fraction.value}`;
                endToken = tokens[fraction.next - 1];
            }
        }
        return {
            value,
            start: tokens[index].start,
            end: endToken.end,
            sourceText: text.slice(tokens[index].start, endToken.end),
        };
    }
    return null;
}
/**
 * Parses a Romanian number only when the supplied text contains one
 * unambiguous number. Returns null otherwise.
 */
export function parseRomanianNumber(text) {
    return findRomanianNumber(text)?.value ?? null;
}
