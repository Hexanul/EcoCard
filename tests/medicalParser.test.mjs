import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEchoTranscript } from '../dist-parser-tests/src/services/medicalParser.js';
import { findRomanianNumber, parseRomanianNumber } from '../dist-parser-tests/src/services/romanianNumberParser.js';
import { normalizeUnit } from '../dist-parser-tests/src/services/unitNormalizer.js';

function parsed(transcript, field) {
  const found = parseEchoTranscript(transcript).measurements.find(
    (measurement) => measurement.field === field,
  );
  assert.ok(found, `Expected ${field} to be extracted from: ${transcript}`);
  return found;
}

test('parses VS telediastolic diameter with a spoken decimal and unit', () => {
  const result = parsed(
    'VS diametrul telediastolic patru virgulă opt centimetri',
    'lvEndDiastolicDiameter',
  );
  assert.deepEqual(
    { value: result.value, unit: result.unit, confidence: result.confidence },
    { value: '4.8', unit: 'cm', confidence: 'high' },
  );
});

test('parses VS telesistolic diameter with a spoken decimal', () => {
  const result = parsed(
    'VS diametrul telesistolic trei virgulă doi centimetri',
    'lvEndSystolicDiameter',
  );
  assert.equal(result.value, '3.2');
  assert.equal(result.unit, 'cm');
});

test('parses TAPSE in millimetres and preserves the source text', () => {
  const result = parsed('TAPSE douăzeci și unu de milimetri', 'tapse');
  assert.equal(result.value, '21');
  assert.equal(result.unit, 'mm');
  assert.equal(result.sourceText, 'TAPSE douăzeci și unu de milimetri');
});

test('parses LV ejection fraction with percent unit', () => {
  const result = parsed('fracția de ejecție șaizeci și doi la sută', 'lvEjectionFractionTeicholz');
  assert.equal(result.value, '62');
  assert.equal(result.unit, '%');
});

test('uses aortic flow context for Vmax with unit', () => {
  const result = parsed(
    'flux aortic Vmax o sută cincizeci centimetri pe secundă',
    'aorticVmax',
  );
  assert.equal(result.value, '150');
  assert.equal(result.unit, 'cm/s');
});

test('keeps mitral flow context across comma-separated clauses', () => {
  const data = parseEchoTranscript(
    'flux mitral unda E șaptezeci, unda A cincizeci, E/A unu virgulă patru',
  );
  assert.equal(data.measurements.find((item) => item.field === 'mitralE')?.value, '70');
  assert.equal(data.measurements.find((item) => item.field === 'mitralA')?.value, '50');
  assert.equal(data.measurements.find((item) => item.field === 'mitralEaRatio')?.value, '1.4');
});

test('keeps qualitative mitral regurgitation exactly as dictated', () => {
  const result = parsed('regurgitare mitrală ușoară', 'mitralRegurgitation');
  assert.equal(result.value, 'ușoară');
  assert.equal(result.kind, 'qualitative');
});

test('does not extract a measurement without a value', () => {
  assert.equal(parseEchoTranscript('TAPSE').measurements.length, 0);
});

test('does not guess a Vmax field without a flow context', () => {
  assert.equal(parseEchoTranscript('Vmax o sută cincizeci').measurements.length, 0);
});

test('extracts several independent measurements without filling absent fields', () => {
  const data = parseEchoTranscript(
    'TAPSE douăzeci și unu milimetri. VS diametrul telediastolic 4.8 cm. Flux tricuspidian Vmax două sute centimetri pe secundă. Regurgitare tricuspidiană moderată.',
  );
  assert.deepEqual(
    data.measurements.map((item) => item.field),
    ['tapse', 'lvEndDiastolicDiameter', 'tricuspidVmax', 'tricuspidRegurgitation'],
  );
  assert.equal(data.measurements.find((item) => item.field === 'tapse')?.value, '21');
  assert.equal(
    data.measurements.find((item) => item.field === 'lvEndDiastolicDiameter')?.value,
    '4.8',
  );
  assert.equal(data.measurements.find((item) => item.field === 'tricuspidVmax')?.value, '200');
  assert.equal(
    data.measurements.find((item) => item.field === 'tricuspidRegurgitation')?.value,
    'moderată',
  );
});

test('keeps flow context active without punctuation (digit values)', () => {
  const data = parseEchoTranscript(
    'flux aortic Vmax 150 Pmax 9 Pmediu 5 flux mitral unda E 70 unda A 50',
  );
  assert.equal(data.measurements.find((item) => item.field === 'aorticVmax')?.value, '150');
  assert.equal(data.measurements.find((item) => item.field === 'aorticPmax')?.value, '9');
  assert.equal(data.measurements.find((item) => item.field === 'aorticPmean')?.value, '5');
  assert.equal(data.measurements.find((item) => item.field === 'mitralE')?.value, '70');
  assert.equal(data.measurements.find((item) => item.field === 'mitralA')?.value, '50');
});

test('keeps flow context active without punctuation (spoken values)', () => {
  const data = parseEchoTranscript(
    'flux aortic Vmax o sută cincizeci Pmax nouă Pmediu cinci flux mitral unda E șaptezeci unda A cincizeci',
  );
  assert.equal(data.measurements.find((item) => item.field === 'aorticVmax')?.value, '150');
  assert.equal(data.measurements.find((item) => item.field === 'aorticPmax')?.value, '9');
  assert.equal(data.measurements.find((item) => item.field === 'aorticPmean')?.value, '5');
  assert.equal(data.measurements.find((item) => item.field === 'mitralE')?.value, '70');
  assert.equal(data.measurements.find((item) => item.field === 'mitralA')?.value, '50');
});

test('switches context back and forth explicitly', () => {
  const data = parseEchoTranscript('flux mitral unda E 70 flux aortic Vmax 150');
  assert.equal(data.measurements.find((item) => item.field === 'mitralE')?.value, '70');
  assert.equal(data.measurements.find((item) => item.field === 'aorticVmax')?.value, '150');
});

test('separates tricuspid Vmax from aortic Vmax by context', () => {
  const data = parseEchoTranscript('flux aortic Vmax 150 flux tricuspidian Vmax 200');
  assert.equal(data.measurements.find((item) => item.field === 'aorticVmax')?.value, '150');
  assert.equal(data.measurements.find((item) => item.field === 'tricuspidVmax')?.value, '200');
});

test('leaves the field empty when a window contains several values', () => {
  const data = parseEchoTranscript('TAPSE 21 35 de milimetri');
  assert.equal(data.measurements.length, 0);
});

test('leaves the field empty when no number follows the alias', () => {
  assert.equal(parseEchoTranscript('fracția de ejecție').measurements.length, 0);
});

test('marks explicitly uncertain values as low parsing certainty', () => {
  const result = parsed('probabil TAPSE douăzeci', 'tapse');
  assert.equal(result.value, '20');
  assert.equal(result.confidence, 'low');
});

test('marks approximate values as medium parsing certainty', () => {
  const result = parsed('TAPSE aproximativ douăzeci și unu', 'tapse');
  assert.equal(result.value, '21');
  assert.equal(result.confidence, 'medium');
});

test('marks "nu sunt sigur" as low parsing certainty', () => {
  const result = parsed('nu sunt sigur TAPSE 21', 'tapse');
  assert.equal(result.confidence, 'low');
});

test('parses digit variants and spoken Romanian numbers', () => {
  assert.equal(parseRomanianNumber('4,8'), '4.8');
  assert.equal(parseRomanianNumber('4.8'), '4.8');
  assert.equal(parseRomanianNumber('21'), '21');
  assert.equal(parseRomanianNumber('62'), '62');
  assert.equal(parseRomanianNumber('o sută douăzeci'), '120');
  assert.equal(parseRomanianNumber('zero virgulă nouă'), '0.9');
  assert.equal(parseRomanianNumber('douăzeci și unu'), '21');
  assert.equal(parseRomanianNumber('patruzeci și cinci'), '45');
});

test('normalizes spoken and written units', () => {
  assert.equal(normalizeUnit('centimetri'), 'cm');
  assert.equal(normalizeUnit('centimetru'), 'cm');
  assert.equal(normalizeUnit('milimetri'), 'mm');
  assert.equal(normalizeUnit('milimetru'), 'mm');
  assert.equal(normalizeUnit('milisecunde'), 'msec');
  assert.equal(normalizeUnit('msec'), 'msec');
  assert.equal(normalizeUnit('mililitri'), 'ml');
  assert.equal(normalizeUnit('milimetri pe secundă'), 'mm/s');
  assert.equal(normalizeUnit('centimetri pe secundă'), 'cm/s');
  assert.equal(normalizeUnit('milimetri de mercur'), 'mmHg');
  assert.equal(normalizeUnit('la sută'), '%');
  assert.equal(normalizeUnit('cm²'), 'cm²');
});

test('does not assign a Simpson fraction to the Teicholz field', () => {
  const data = parseEchoTranscript('fracția de ejecție Simpson șaizeci');
  assert.equal(
    data.measurements.find((item) => item.field === 'lvEjectionFractionSimpson')?.value,
    '60',
  );
  assert.equal(
    data.measurements.some((item) => item.field === 'lvEjectionFractionTeicholz'),
    false,
  );
});

test('parses digit-form decimals without splitting on the dot', () => {
  const result = parsed('VS diametrul telediastolic 4.8 cm', 'lvEndDiastolicDiameter');
  assert.equal(result.value, '4.8');
  assert.equal(result.unit, 'cm');
});

test('parses septal tissue Doppler waves', () => {
  const data = parseEchoTranscript('doppler tisular sept unda E prim 6 unda A prim 5');
  assert.equal(data.measurements.find((item) => item.field === 'septalEPrime')?.value, '6');
  assert.equal(data.measurements.find((item) => item.field === 'septalAPrime')?.value, '5');
});

test('bounds qualitative values at the next context keyword', () => {
  const data = parseEchoTranscript('regurgitare mitrală ușoară flux aortic Vmax 150');
  assert.equal(
    data.measurements.find((item) => item.field === 'mitralRegurgitation')?.value,
    'ușoară',
  );
  assert.equal(data.measurements.find((item) => item.field === 'aorticVmax')?.value, '150');
});

test('keeps every dictated occurrence of the same field', () => {
  const data = parseEchoTranscript('TAPSE 21 de milimetri. TAPSE 22 de milimetri.');
  const values = data.measurements
    .filter((item) => item.field === 'tapse')
    .map((item) => item.value);
  assert.deepEqual(values, ['21', '22']);
});

test('does not bind a number that appears before the alias', () => {
  const data = parseEchoTranscript('150 Vmax');
  assert.equal(data.measurements.length, 0);
});

test('reports the raw transcript span as source text for every extraction', () => {
  const data = parseEchoTranscript('TAPSE douăzeci și unu de milimetri. VS diametrul telediastolic 4.8 cm.');
  for (const item of data.measurements) {
    assert.ok(item.sourceText.length > 0);
    assert.equal(parseEchoTranscript(item.sourceText).measurements.length >= 1, true);
  }
});

test('findRomanianNumber returns offsets into the input', () => {
  const found = findRomanianNumber('patru virgulă opt centimetri');
  assert.equal(found?.value, '4.8');
  assert.equal(found?.sourceText, 'patru virgulă opt');
  assert.equal(found?.start, 0);
  assert.equal(found?.end, 'patru virgulă opt'.length);
});

test('parses the realistic comma-rich transcript end to end', () => {
  const transcript =
    'Vs, diametrul telediastolic, 5,3 cm. Ps, diametrul telesistolic, 4,4 cm. ' +
    'Siv, diametrul diastolic, 8 cm. Perete posterior, diametrul diastolic, 3 cm. ' +
    'Fracție de ejecție, Vs, tai ciolți, 30%. Fracție de scurtare, 80%. ' +
    'Masa Vs, 5 grame pe metru pătrat. Aorta la inel, 2 cm. Aorta ascendentă, 4 cm. ' +
    'As, diametrul antero-posterior, 3 cm. Aorta la nivelul crossei, 4,85 cm. ' +
    'Artera pulmonară, 4,44 cm.';
  const data = parseEchoTranscript(transcript);
  const expected = [
    ['lvEndDiastolicDiameter', '5.3', 'cm'],
    ['lvEndSystolicDiameter', '4.4', 'cm'],
    ['ivsDiastolicDiameter', '8', 'cm'],
    ['posteriorWallDiastolicDiameter', '3', 'cm'],
    ['lvEjectionFractionTeicholz', '30', '%'],
    ['shorteningFraction', '80', '%'],
    ['lvMass', '5', 'g/m²'],
    ['aortaAnnulus', '2', 'cm'],
    ['ascendingAorta', '4', 'cm'],
    ['laAnteroposteriorDiameter', '3', 'cm'],
    ['aortaAtArch', '4.85', 'cm'],
    ['pulmonaryArtery', '4.44', 'cm'],
  ];
  assert.deepEqual(
    data.measurements.map((item) => [item.field, item.value, item.unit ?? null]),
    expected,
  );
});

test('parses decimal commas as decimal separators', () => {
  assert.equal(parseRomanianNumber('5,3'), '5.3');
  assert.equal(parseRomanianNumber('4,85'), '4.85');
  assert.equal(parseRomanianNumber('4,44'), '4.44');
  assert.equal(parseRomanianNumber('0,9'), '0.9');
  assert.equal(parseRomanianNumber('1,4'), '1.4');
});

test('parses a comma-separated field dictation with a decimal comma value', () => {
  const result = parsed('VS, diametrul telediastolic, 5,3 cm', 'lvEndDiastolicDiameter');
  assert.equal(result.value, '5.3');
  assert.equal(result.unit, 'cm');
  assert.equal(result.sourceText, 'VS, diametrul telediastolic, 5,3 cm');
});

test('parses a comma-separated field dictation with a decimal point value', () => {
  const result = parsed('VS, diametrul telediastolic, 5.3 cm', 'lvEndDiastolicDiameter');
  assert.equal(result.value, '5.3');
  assert.equal(result.unit, 'cm');
});

test('keeps a comma between the field name and its value', () => {
  const result = parsed('TAPSE, 21 de milimetri', 'tapse');
  assert.equal(result.value, '21');
  assert.equal(result.unit, 'mm');
});

test('parses comma-separated flow dictation', () => {
  const data = parseEchoTranscript('Flux aortic, Vmax, 150 cm/s, Pmax, 9 mmHg');
  assert.equal(data.measurements.find((item) => item.field === 'aorticVmax')?.value, '150');
  assert.equal(data.measurements.find((item) => item.field === 'aorticVmax')?.unit, 'cm/s');
  assert.equal(data.measurements.find((item) => item.field === 'aorticPmax')?.value, '9');
  assert.equal(data.measurements.find((item) => item.field === 'aorticPmax')?.unit, 'mmHg');
});

test('parses a spoken decimal with two fraction digits', () => {
  assert.equal(parseRomanianNumber('patru virgulă opt cinci'), '4.85');
});

test('parses the "tai ciolți" Whisper variation as the Teicholz fraction', () => {
  const result = parsed('fracție de ejecție tai ciolți 30%', 'lvEjectionFractionTeicholz');
  assert.equal(result.value, '30');
  assert.equal(result.unit, '%');
});

test('parses the "taiciolți" and "teicholtz" variations as the Teicholz fraction', () => {
  const taiciolti = parseEchoTranscript('fracția de ejecție taiciolți 30%');
  assert.equal(
    taiciolti.measurements.find((item) => item.field === 'lvEjectionFractionTeicholz')?.value,
    '30',
  );
  const teicholtz = parseEchoTranscript('fracția de ejecție teicholtz 30%');
  assert.equal(
    teicholtz.measurements.find((item) => item.field === 'lvEjectionFractionTeicholz')?.value,
    '30',
  );
});

test('normalizes gram per square metre variants', () => {
  assert.equal(normalizeUnit('gram pe metru pătrat'), 'g/m²');
  assert.equal(normalizeUnit('grame pe metru pătrat'), 'g/m²');
  assert.equal(normalizeUnit('g/m2'), 'g/m²');
  assert.equal(normalizeUnit('g/m²'), 'g/m²');
  assert.equal(normalizeUnit('gram'), null);
});

test('parses SIV diastolic diameter from comma-separated dictation', () => {
  const result = parsed('SIV, diametrul diastolic, 1,1 cm', 'ivsDiastolicDiameter');
  assert.equal(result.value, '1.1');
  assert.equal(result.unit, 'cm');
});

test('parses the "siastolic" Whisper variant of SIV with commas', () => {
  const result = parsed('Siv, diametrul siastolic, 1,1 cm', 'ivsDiastolicDiameter');
  assert.equal(result.value, '1.1');
  assert.equal(result.unit, 'cm');
});

test('parses the "siastolic" Whisper variant of SIV without commas', () => {
  const result = parsed('Siv diametrul siastolic 1,1 cm', 'ivsDiastolicDiameter');
  assert.equal(result.value, '1.1');
  assert.equal(result.unit, 'cm');
});

test('parses the "diasolic" Whisper variant of SIV', () => {
  const result = parsed('Siv diametrul diasolic 1,1 cm', 'ivsDiastolicDiameter');
  assert.equal(result.value, '1.1');
});

test('parses the abbreviated "SIV diam. diastolic"', () => {
  const result = parsed('SIV diam. diastolic 1,1 cm', 'ivsDiastolicDiameter');
  assert.equal(result.value, '1.1');
  assert.equal(result.unit, 'cm');
});

test('parses the Simpson ejection fraction', () => {
  const result = parsed('Fracție de ejecție Simpson, 55%', 'lvEjectionFractionSimpson');
  assert.equal(result.value, '55');
  assert.equal(result.unit, '%');
});

test('parses "Fracția de ejecție Simpson" with a low value', () => {
  const result = parsed('Fracția de ejecție Simpson, 5%', 'lvEjectionFractionSimpson');
  assert.equal(result.value, '5');
  assert.equal(result.unit, '%');
});

test('parses "FE Simpson" and "fractie ejectie simpson" variants', () => {
  assert.equal(
    parseEchoTranscript('FE Simpson 55%')
      .measurements.find((item) => item.field === 'lvEjectionFractionSimpson')?.value,
    '55',
  );
  assert.equal(
    parseEchoTranscript('fractie ejectie simpson 55%')
      .measurements.find((item) => item.field === 'lvEjectionFractionSimpson')?.value,
    '55',
  );
});

test('keeps Teicholz separate and never fills Simpson', () => {
  const data = parseEchoTranscript('Fracție de ejecție Teicholz, 60%');
  assert.equal(
    data.measurements.find((item) => item.field === 'lvEjectionFractionTeicholz')?.value,
    '60',
  );
  assert.equal(
    data.measurements.some((item) => item.field === 'lvEjectionFractionSimpson'),
    false,
  );
});

test('parses "Pericard, lichid pericardic absent" as a qualitative value', () => {
  const result = parsed('Pericard, lichid pericardic absent', 'pericardialFluid');
  assert.equal(result.value, 'absent');
  assert.equal(result.kind, 'qualitative');
});

test('parses "Lichid pericardic prezent" as a qualitative value', () => {
  const result = parsed('Lichid pericardic prezent', 'pericardialFluid');
  assert.equal(result.value, 'prezent');
  assert.equal(result.kind, 'qualitative');
});

test('parses the remaining pericard dictation variants', () => {
  for (const [transcript, expected] of [
    ['Pericard lichid pericardic absent', 'absent'],
    ['pericard lichid pericardic prezent', 'prezent'],
    ['lichid pericardic absent', 'absent'],
  ]) {
    const result = parsed(transcript, 'pericardialFluid');
    assert.equal(result.value, expected);
  }
});

test('parses the imperfect Whisper transcript with digit-ending sentences', () => {
  const data = parseEchoTranscript(
    'Siv, diametrul diastolic, 2,2. Perete posterior, diametrul distolic, 4, Aorta inel, 8. Aorta ascendentă, 5. Diametrul anteroposterior, 8',
  );
  assert.deepEqual(
    data.measurements.map((item) => [item.field, item.value]),
    [
      ['ivsDiastolicDiameter', '2.2'],
      ['posteriorWallDiastolicDiameter', '4'],
      ['aortaAnnulus', '8'],
      ['ascendingAorta', '5'],
      ['laAnteroposteriorDiameter', '8'],
    ],
  );
});

test('treats a sentence-ending period after a digit as a boundary', () => {
  const data = parseEchoTranscript('Siv, diametrul diastolic, 2,2. TAPSE 21.');
  assert.equal(data.measurements.find((item) => item.field === 'ivsDiastolicDiameter')?.value, '2.2');
  assert.equal(data.measurements.find((item) => item.field === 'tapse')?.value, '21');
});

test('does not duplicate the AS diameter when the prefix is present', () => {
  const data = parseEchoTranscript('As, diametrul antero-posterior, 3 cm.');
  const matches = data.measurements.filter((item) => item.field === 'laAnteroposteriorDiameter');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].value, '3');
});

test('maps a bare latero-median diameter to VS inside APICAL 4C (dot decimal)', () => {
  const result = parsed('APICAL 4C. Diametrul lateromedian 3.3.', 'lvLateromedialDiameter');
  assert.equal(result.value, '3.3');
});

test('maps a bare latero-median diameter to VS inside APICAL 4C (comma decimal)', () => {
  const result = parsed('APICAL 4C. Diametrul lateromedian 3,3.', 'lvLateromedialDiameter');
  assert.equal(result.value, '3.3');
});

test('parses the VD latero-median diameter with its prefix', () => {
  const result = parsed('APICAL 4C. VD diametrul lateromedian 4.5.', 'rvLateromedialDiameter');
  assert.equal(result.value, '4.5');
});

test('parses the AS latero-median diameter with its prefix', () => {
  const result = parsed('APICAL 4C. AS diametrul lateromedian 3.8.', 'laLateromedialDiameter');
  assert.equal(result.value, '3.8');
});

test('parses the AD latero-median diameter with its prefix', () => {
  const result = parsed('APICAL 4C. AD diametrul lateromedian 4.1.', 'raLateromedialDiameter');
  assert.equal(result.value, '4.1');
});

test('parses the full sequential APICAL 4C dictation', () => {
  const data = parseEchoTranscript(
    'APICAL 4C. Diametrul lateromedian 3.3. VD diametrul lateromedian 4.5. AS diametrul lateromedian 3.8. AD diametrul lateromedian 4.1.',
  );
  assert.deepEqual(
    data.measurements.map((item) => [item.field, item.value]),
    [
      ['lvLateromedialDiameter', '3.3'],
      ['rvLateromedialDiameter', '4.5'],
      ['laLateromedialDiameter', '3.8'],
      ['raLateromedialDiameter', '4.1'],
    ],
  );
});

test('does not map a bare latero-median diameter to VS outside APICAL 4C', () => {
  assert.equal(parseEchoTranscript('Diametrul lateromedian 3.3.').measurements.length, 0);
});

test('parses the mixed-comma APICAL 4C dictation', () => {
  const data = parseEchoTranscript(
    'APICAL 4C, diametrul lateromedian, 3,3 cm, VD diametrul lateromedian, 4,5 cm, AS diametrul lateromedian, 3,8 cm, AD diametrul lateromedian, 4,1 cm',
  );
  assert.deepEqual(
    data.measurements.map((item) => [item.field, item.value, item.unit ?? null]),
    [
      ['lvLateromedialDiameter', '3.3', 'cm'],
      ['rvLateromedialDiameter', '4.5', 'cm'],
      ['laLateromedialDiameter', '3.8', 'cm'],
      ['raLateromedialDiameter', '4.1', 'cm'],
    ],
  );
});

test('parses "Vs, diametrul tele, diastolic, 5,3"', () => {
  const result = parsed('Vs, diametrul tele, diastolic, 5,3', 'lvEndDiastolicDiameter');
  assert.equal(result.value, '5.3');
  assert.equal(result.unit, undefined);
});

test('parses "Vs, diametrul tele, sistolic, 8,4"', () => {
  const result = parsed('Vs, diametrul tele, sistolic, 8,4', 'lvEndSystolicDiameter');
  assert.equal(result.value, '8.4');
  assert.equal(result.unit, undefined);
});

test('parses both tele-separated VS diameters with units', () => {
  const data = parseEchoTranscript(
    'Vs, diametrul tele, diastolic, 5,3 cm. Vs, diametrul tele, sistolic, 8,4 cm',
  );
  const diastolic = data.measurements.find((item) => item.field === 'lvEndDiastolicDiameter');
  const systolic = data.measurements.find((item) => item.field === 'lvEndSystolicDiameter');
  assert.equal(diastolic?.value, '5.3');
  assert.equal(diastolic?.unit, 'cm');
  assert.equal(systolic?.value, '8.4');
  assert.equal(systolic?.unit, 'cm');
});

test('parses all tele-separated VS diameter dictation variants', () => {
  const diastolicForms = [
    'VS diametrul tele diastolic 5.3',
    'VS diametrul tele, diastolic, 5.3',
    'Vs diametrul tele diastolic 5.3',
    'Vs diametrul tele, diastolic, 5.3',
    'VS diametrul telediastolic 5.3',
    'VS diametru tele diastolic 5.3',
  ];
  for (const transcript of diastolicForms) {
    assert.ok(
      parseEchoTranscript(transcript).measurements.some(
        (item) => item.field === 'lvEndDiastolicDiameter' && item.value === '5.3',
      ),
      transcript,
    );
  }
  const systolicForms = [
    'VS diametrul tele sistolic 8.4',
    'VS diametrul tele, sistolic, 8.4',
    'Vs diametrul tele sistolic 8.4',
    'Vs diametrul tele, sistolic, 8.4',
    'VS diametrul telesistolic 8.4',
    'VS diametru tele sistolic 8.4',
  ];
  for (const transcript of systolicForms) {
    assert.ok(
      parseEchoTranscript(transcript).measurements.some(
        (item) => item.field === 'lvEndSystolicDiameter' && item.value === '8.4',
      ),
      transcript,
    );
  }
});

test('parses "Pericardichid, pericardic absent"', () => {
  const result = parsed('Pericardichid, pericardic absent', 'pericardialFluid');
  assert.equal(result.value, 'absent');
  assert.equal(result.kind, 'qualitative');
});

test('parses "Lichid pericardic absent"', () => {
  const result = parsed('Lichid pericardic absent', 'pericardialFluid');
  assert.equal(result.value, 'absent');
});

test('parses the pericard Whisper combination variants', () => {
  for (const [transcript, expected] of [
    ['pericardichid pericardic absent', 'absent'],
    ['pericardichid pericardic prezent', 'prezent'],
    ['pericard lichid pericardic absent', 'absent'],
    ['pericard lichid pericardic, absent', 'absent'],
    ['lichid pericardic, absent', 'absent'],
  ]) {
    const result = parsed(transcript, 'pericardialFluid');
    assert.equal(result.value, expected);
  }
});

test('parses "Fracții de ejecție Vs, 4%"', () => {
  const result = parsed('Fracții de ejecție Vs, 4%', 'lvEjectionFractionTeicholz');
  assert.equal(result.value, '4');
  assert.equal(result.unit, '%');
});

test('parses the ejection fraction plural and FE variants', () => {
  for (const transcript of [
    'fracție de ejecție VS 4%',
    'fracția de ejecție VS 4%',
    'fracții de ejecție VS 4%',
    'fractie de ejectie VS 4%',
    'fractiile de ejectie VS 4%',
    'FE VS 4%',
    'FE ventricul stâng 4%',
  ]) {
    assert.ok(
      parseEchoTranscript(transcript).measurements.some(
        (item) => item.field === 'lvEjectionFractionTeicholz' && item.value === '4',
      ),
      transcript,
    );
  }
});

test('keeps the Simpson fraction away from the Teicholz field', () => {
  const data = parseEchoTranscript('Fracție de ejecție Simpson, 55%');
  assert.equal(
    data.measurements.find((item) => item.field === 'lvEjectionFractionSimpson')?.value,
    '55',
  );
  assert.equal(
    data.measurements.some((item) => item.field === 'lvEjectionFractionTeicholz'),
    false,
  );
});

test('parses Teicholz and Simpson in the same dictation', () => {
  const data = parseEchoTranscript(
    'Fracție de ejecție VS, 60%. Fracție de ejecție Simpson, 55%',
  );
  assert.equal(
    data.measurements.find((item) => item.field === 'lvEjectionFractionTeicholz')?.value,
    '60',
  );
  assert.equal(
    data.measurements.find((item) => item.field === 'lvEjectionFractionSimpson')?.value,
    '55',
  );
});

test('parses the realistic combined Whisper transcript', () => {
  const data = parseEchoTranscript(
    'Vs, diametrul tele, diastolic, 5,3. Vs, diametrul tele, sistolic, 8,4. Pericardichid, pericardic absent. Fracții de ejecție Vs, 4%.',
  );
  assert.deepEqual(
    data.measurements.map((item) => [item.field, item.value, item.unit ?? null]),
    [
      ['lvEndDiastolicDiameter', '5.3', null],
      ['lvEndSystolicDiameter', '8.4', null],
      ['pericardialFluid', 'absent', null],
      ['lvEjectionFractionTeicholz', '4', '%'],
    ],
  );
  const diastolic = data.measurements.find((item) => item.field === 'lvEndDiastolicDiameter');
  assert.ok(diastolic.sourceText.includes('Vs, diametrul tele, diastolic, 5,3'));
});

test('parses the new decimal and percent number forms', () => {
  assert.equal(parseRomanianNumber('8,4'), '8.4');
  assert.equal(parseRomanianNumber('4%'), '4');
});

test('parses "Siv, diametru diastolic, 5,5"', () => {
  const result = parsed('Siv, diametru diastolic, 5,5', 'ivsDiastolicDiameter');
  assert.equal(result.value, '5.5');
});

test('parses the SIV diametru/diametrul dictation variants', () => {
  for (const transcript of [
    'SIV diametru diastolic 5.5',
    'Siv diametru diastolic 5.5',
    'SIV, diametru diastolic, 5,5',
    'Siv, diametru diastolic, 5,5',
    'SIV diametrul diastolic 5.5',
    'Siv diametrul diastolic 5.5',
    'SIV, diametrul diastolic, 5,5',
  ]) {
    assert.ok(
      parseEchoTranscript(transcript).measurements.some(
        (item) => item.field === 'ivsDiastolicDiameter' && item.value === '5.5',
      ),
      transcript,
    );
  }
});

test('parses "Perete posterior, 8,3" without the diameter phrase', () => {
  const result = parsed('Perete posterior, 8,3', 'posteriorWallDiastolicDiameter');
  assert.equal(result.value, '8.3');
  assert.equal(result.sourceText, 'Perete posterior, 8,3');
});

test('parses the posterior wall shorthand variants', () => {
  for (const transcript of [
    'Perete posterior, 8,3',
    'Perete posterior 8,3',
    'Peretele posterior, 8,3',
    'Peretele posterior 8,3',
    'Perete posterior, diametrul diastolic, 8,3',
  ]) {
    assert.ok(
      parseEchoTranscript(transcript).measurements.some(
        (item) => item.field === 'posteriorWallDiastolicDiameter' && item.value === '8.3',
      ),
      transcript,
    );
  }
});

test('parses "AS, diametru antero-posterior, 43"', () => {
  const result = parsed('AS, diametru antero-posterior, 43', 'laAnteroposteriorDiameter');
  assert.equal(result.value, '43');
  assert.equal(result.unit, undefined);
});

test('parses the AS antero-posterior diametru/diametrul variants', () => {
  for (const transcript of [
    'AS diametru antero-posterior 43',
    'AS, diametru antero-posterior, 43',
    'AS diametrul antero-posterior 43',
    'AS, diametrul antero-posterior, 43',
    'AS diametru anteroposterior 43',
    'AS diametrul anteroposterior 43',
  ]) {
    assert.ok(
      parseEchoTranscript(transcript).measurements.some(
        (item) => item.field === 'laAnteroposteriorDiameter' && item.value === '43',
      ),
      transcript,
    );
  }
});

test('parses "Cinetica parietală, normală" as qualitative wall motion', () => {
  const result = parsed('Cinetica parietală, normală', 'wallMotion');
  assert.equal(result.value, 'normală');
  assert.equal(result.kind, 'qualitative');
  assert.equal(result.confidence, 'high');
  assert.equal(result.sourceText, 'Cinetica parietală, normală');
});

test('parses qualitative wall motion values verbatim', () => {
  for (const [transcript, expected] of [
    ['Cinetica parietala normala', 'normala'],
    ['Cinetica parietală, hipokinetică', 'hipokinetică'],
    ['Cinetica parietală, akinetică', 'akinetică'],
    ['Cinetica parietală, diskinezie', 'diskinezie'],
  ]) {
    const result = parsed(transcript, 'wallMotion');
    assert.equal(result.value, expected);
    assert.equal(result.kind, 'qualitative');
  }
});

test('parses "Valve aortice, îngroșate" as a qualitative value', () => {
  const result = parsed('Valve aortice, îngroșate', 'aorticValves');
  assert.equal(result.value, 'îngroșate');
  assert.equal(result.kind, 'qualitative');
  assert.equal(result.sourceText, 'Valve aortice, îngroșate');
});

test('parses aortic and mitral valve qualitative values verbatim', () => {
  for (const [transcript, field, expected] of [
    ['Valve aortice îngroșate', 'aorticValves', 'îngroșate'],
    ['Valve aortice, normale', 'aorticValves', 'normale'],
    ['Valve aortice normale', 'aorticValves', 'normale'],
    ['Valve mitrale, normale', 'mitralValves', 'normale'],
    ['Valve mitrale normale', 'mitralValves', 'normale'],
    ['Valve mitrale îngroșate', 'mitralValves', 'îngroșate'],
  ]) {
    const result = parsed(transcript, field);
    assert.equal(result.value, expected);
    assert.equal(result.kind, 'qualitative');
  }
});

test('parses the combined realistic shorthand transcript', () => {
  const data = parseEchoTranscript(
    'Siv, diametru diastolic, 5,5. Perete posterior, 8,3, As, diametru antero-posterior, 43, Cinetica parietală, normală. Valve aortice, îngroșate. Valve mitrale, normale',
  );
  assert.deepEqual(
    data.measurements.map((item) => [item.field, item.value, item.unit ?? null]),
    [
      ['ivsDiastolicDiameter', '5.5', null],
      ['posteriorWallDiastolicDiameter', '8.3', null],
      ['laAnteroposteriorDiameter', '43', null],
      ['wallMotion', 'normală', null],
      ['aorticValves', 'îngroșate', null],
      ['mitralValves', 'normale', null],
    ],
  );
  const aortic = data.measurements.find((item) => item.field === 'aorticValves');
  assert.equal(aortic.sourceText, 'Valve aortice, îngroșate');
});