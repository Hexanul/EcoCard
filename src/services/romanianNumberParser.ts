export type ParsedNumber = {
  value: string;
  start: number;
  end: number;
  sourceText: string;
};

const SINGLE_DIGITS: Record<string, number> = {
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

const TEENS: Record<string, number> = {
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

const TENS: Record<string, number> = {
  douazeci: 20,
  treizeci: 30,
  patruzeci: 40,
  cincizeci: 50,
  saizeci: 60,
  saptezeci: 70,
  optzeci: 80,
  nouazeci: 90,
};

const NUMBER_WORDS: Record<string, number> = {
  ...SINGLE_DIGITS,
  ...TEENS,
  ...TENS,
};

// "o", "un" and "una" are also articles ("are o valoare de 4,8"): they count
// as 1 only before "sută/sute" or inside a compound ("douăzeci și una").
const ARTICLE_ONES = new Set(['o', 'un', 'una']);

type Token = {
  value: string;
  start: number;
  end: number;
};

/** The normalization the number positions (`start`, `end`) refer to. */
export function normalizeNumberText(text: string): string {
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

function tokenize(text: string): Token[] {
  const normalized = normalizeNumberText(text);
  return [...normalized.matchAll(/\d+(?:[.,]\d+)?|[a-z]+/g)].map((match) => ({
    value: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

function parseInteger(tokens: Token[], start: number): { value: number; next: number } | null {
  let index = start;
  let total = 0;
  let current = 0;
  let consumed = false;

  while (index < tokens.length) {
    const token = tokens[index].value;

    if (token === 'si') {
      if (!consumed) break;
      index += 1;
      continue;
    }

    if (token === 'suta' || token === 'sute') {
      if (!consumed) break;
      total += (current || 1) * 100;
      current = 0;
      consumed = true;
      index += 1;
      continue;
    }

    const number = NUMBER_WORDS[token];
    if (number === undefined) break;
    if (ARTICLE_ONES.has(token) && !consumed && !/^sut[ae]$/.test(tokens[index + 1]?.value ?? '')) break;

    current += number;
    consumed = true;
    index += 1;
  }

  return consumed ? { value: total + current, next: index } : null;
}

function fractionText(tokens: Token[], start: number): { value: string; next: number } | null {
  const first = tokens[start];
  if (!first) return null;

  if (/^\d+(?:[.,]\d+)?$/.test(first.value)) {
    return { value: first.value.replace(/\D/g, ''), next: start + 1 };
  }

  const digitValues: number[] = [];
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

const isDecimalWord = (token: Token | undefined): boolean => token?.value === 'virgula' || token?.value === 'punct';

/**
 * Whisper writes some spoken compounds half in digits: "cincizeci și șapte"
 * as "50 și 7". A whole ten (20–90), "și" and a single digit are one number.
 */
function digitTensAndUnit(tokens: Token[], index: number): { value: string; next: number } | null {
  const tens = tokens[index]?.value;
  if (!tens || !/^[2-9]0$/.test(tens) || tokens[index + 1]?.value !== 'si') return null;
  const unitToken = tokens[index + 2]?.value ?? '';
  // After "și", "una"/"unu" can only be 1; "o"/"un" may be articles ("50 și o undă").
  const unit = /^[1-9]$/.test(unitToken)
    ? Number(unitToken)
    : unitToken === 'o' || unitToken === 'un' ? undefined : SINGLE_DIGITS[unitToken];
  if (unit === undefined || unit === 0) return null;
  return { value: String(Number(tens) + unit), next: index + 3 };
}

/**
 * Finds the first numeric expression in a Romanian phrase, including spoken
 * decimals ("patru virgulă opt", "4 virgulă 8") and already-digit forms
 * ("4,8", "4.8", "21"). A spoken "minus" keeps its sign, so the value is
 * flagged as impossible rather than silently made positive. Returns null when
 * the text contains no number.
 */
export function findRomanianNumber(text: string): ParsedNumber | null {
  const tokens = tokenize(text);

  for (let index = 0; index < tokens.length; index += 1) {
    const direct = tokens[index];
    let integerValue: string;
    let next: number;
    if (/^\d+(?:[.,]\d+)?$/.test(direct.value)) {
      const compound = digitTensAndUnit(tokens, index);
      integerValue = compound?.value ?? direct.value.replace(',', '.');
      next = compound?.next ?? index + 1;
    } else {
      const integer = parseInteger(tokens, index);
      if (!integer) continue;
      integerValue = String(integer.value);
      next = integer.next;
    }

    let endToken = tokens[next - 1];
    let value = integerValue;
    if (/^\d+$/.test(integerValue) && isDecimalWord(tokens[next])) {
      const fraction = fractionText(tokens, next + 1);
      if (fraction) {
        value = `${integerValue}.${fraction.value}`;
        endToken = tokens[fraction.next - 1];
      }
    }

    const minus = tokens[index - 1]?.value === 'minus';
    const start = minus ? tokens[index - 1].start : direct.start;
    return {
      value: minus ? `-${value}` : value,
      start,
      end: endToken.end,
      sourceText: text.slice(start, endToken.end),
    };
  }

  return null;
}

/**
 * Parses a Romanian number only when the supplied text contains one
 * unambiguous number. Returns null otherwise.
 */
export function parseRomanianNumber(text: string): string | null {
  return findRomanianNumber(text)?.value ?? null;
}