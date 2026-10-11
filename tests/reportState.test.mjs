import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyDictation,
  changedDictation,
  changedPatientFields,
  createReportForm,
  editField,
  getFollowingCurrentNumber,
  hasWarnings,
  mergeParsedPatient,
  resolveNote,
} from '../dist-parser-tests/src/services/reportState.js';
import { createEmptyEchoReport, createEmptyPatient } from '../dist-parser-tests/src/types/echoReport.js';
import { calculateBmi } from '../dist-parser-tests/src/utils/bmi.js';
import { calculateDerivedMeasurements } from '../dist-parser-tests/src/utils/derivedMeasurements.js';

const emptyPatient = { lastName: '', firstName: '', age: '', weight: '', height: '' };

function numeric(field, value) {
  return { field, label: field, value, kind: 'numeric', confidence: 'high', sourceText: value };
}

test('current number advances only from a positive integer', () => {
  assert.equal(getFollowingCurrentNumber('41'), 42);
  assert.equal(getFollowingCurrentNumber(' 7 '), 8);
  assert.equal(getFollowingCurrentNumber(''), null);
  assert.equal(getFollowingCurrentNumber('0'), null);
  assert.equal(getFollowingCurrentNumber('12a'), null);
  assert.equal(getFollowingCurrentNumber('3.5'), null);
});

function parse(measurements, conclusions = '') {
  return { measurements, conclusions, patient: emptyPatient };
}

// The form after dictating `data` into `form` (an empty report by default).
function dictate(data, form = createReportForm(createEmptyEchoReport()), previous = null) {
  const changes = changedDictation(previous, data);
  return changes ? applyDictation(form, changes) : form;
}

test('dictated values go straight into the form and ratios are calculated', () => {
  const form = dictate(parse([numeric('mitralE', '100'), numeric('mitralA', '50')], 'Fără modificări.'));
  assert.equal(form.report.measurements.mitralE, '100');
  assert.equal(form.report.measurements.mitralA, '50');
  assert.equal(form.report.measurements.mitralEaRatio, '2');
  assert.equal(form.report.conclusions, 'Fără modificări.');
  assert.deepEqual(form.notes, {});
});

test('dictated ratios are ignored: the form calculates them', () => {
  const form = dictate(parse([numeric('mitralEaRatio', '9')]));
  assert.equal(form.report.measurements.mitralEaRatio, '');
  assert.equal(changedDictation(null, parse([numeric('mitralEaRatio', '9')])), null);
});

test('uncertain dictated values are applied with a warning under the field', () => {
  const form = dictate(parse([
    { ...numeric('mitralE', '80'), ambiguousValue: true, confidence: 'low' },
    { ...numeric('mitralA', '50'), confidence: 'low' },
    { ...numeric('tricuspidE', '60'), unitMismatch: true, unit: 'mmHg' },
    { ...numeric('lvEndDiastolicDiameter', '4.8'), unit: 'cm', convertedFrom: 'mm' },
    { ...numeric('septalS', '9'), confidence: 'medium' },
  ]));
  assert.equal(form.report.measurements.mitralE, '80');
  assert.deepEqual(form.notes.mitralE.warnings, ['Mai multe numere dictate pentru acest câmp — a fost propus primul.']);
  assert.deepEqual(form.notes.mitralA.warnings, ['Dictat ca nesigur — verificați valoarea.']);
  assert.deepEqual(form.notes.tricuspidE.warnings, ['Unitate dictată (mmHg) diferită de unitatea câmpului — verificați valoarea.']);
  // Conversions and approximate values are only shown.
  assert.deepEqual(form.notes.lvEndDiastolicDiameter, {
    warnings: [], info: ['Convertit automat din mm în cm.'], sourceText: '4.8',
  });
  assert.deepEqual(form.notes.septalS.warnings, []);
  assert.equal(hasWarnings(form.notes.mitralE), true);
  assert.equal(hasWarnings(form.notes.septalS), false);
});

test('a field dictated with different values keeps the first and offers the others', () => {
  // Whisper heard "VD" as "VS": the VS field received two different values.
  const form = dictate(parse([
    numeric('lvLateromedialDiameter', '4.4'),
    numeric('lvLateromedialDiameter', '3.5'),
    numeric('mitralE', '80'),
    numeric('mitralE', '80'),
  ]));
  assert.equal(form.report.measurements.lvLateromedialDiameter, '4.4');
  assert.deepEqual(form.notes.lvLateromedialDiameter.alternatives, ['4.4', '3.5']);
  assert.equal(hasWarnings(form.notes.lvLateromedialDiameter), true);
  // The same value twice is one finding.
  assert.equal(form.notes.mitralE, undefined);

  const chosen = resolveNote(form, 'lvLateromedialDiameter', '3.5');
  assert.equal(chosen.report.measurements.lvLateromedialDiameter, '3.5');
  assert.equal(chosen.notes.lvLateromedialDiameter, undefined);
});

test('a dictated value replacing one the doctor typed can be reverted', () => {
  let form = createReportForm(createEmptyEchoReport());
  form = editField(form, 'mitralE', '75');
  form = dictate(parse([numeric('mitralE', '80')]), form);
  assert.equal(form.report.measurements.mitralE, '80');
  assert.equal(form.notes.mitralE.previousValue, '75');
  assert.deepEqual(form.notes.mitralE.warnings, ['A înlocuit valoarea din formular: 75.']);

  const reverted = resolveNote(form, 'mitralE', '75');
  assert.equal(reverted.report.measurements.mitralE, '75');
  assert.equal(reverted.notes.mitralE, undefined);
  const kept = resolveNote(form, 'mitralE');
  assert.equal(kept.report.measurements.mitralE, '80');
  assert.equal(kept.notes.mitralE, undefined);
});

test('editing a field settles its note and never touches the others', () => {
  let form = dictate(parse([{ ...numeric('mitralE', '80'), confidence: 'low' }, { ...numeric('mitralA', '50'), confidence: 'low' }]));
  form = editField(form, 'mitralE', '82');
  assert.equal(form.report.measurements.mitralE, '82');
  assert.equal(form.report.measurements.mitralEaRatio, '1.64');
  assert.equal(form.notes.mitralE, undefined);
  assert.notEqual(form.notes.mitralA, undefined);
});

test('only dictated fields that changed since the previous parse are applied', () => {
  const first = parse([numeric('mitralE', '80'), numeric('mitralA', '50')], 'Normal.');
  let form = dictate(first);
  // The doctor corrects E; editing another part of the transcript keeps the correction.
  form = editField(form, 'mitralE', '82');
  const edited = parse([{ ...numeric('mitralE', '80'), sourceText: 'unda E 80' }, numeric('mitralA', '55')], 'Normal.');
  assert.deepEqual(changedDictation(first, edited), { measurements: [numeric('mitralA', '55')], conclusions: null });
  form = dictate(edited, form, first);
  assert.equal(form.report.measurements.mitralE, '82');
  assert.equal(form.report.measurements.mitralA, '55');
  // A value that dictation itself put there is replaced without a note.
  assert.equal(form.notes.mitralA, undefined);
  assert.equal(changedDictation(edited, edited), null);
});

test('dictated conclusions replace text the doctor wrote only with a note', () => {
  let form = dictate(parse([], 'Normal.'));
  form = dictate(parse([], 'Normal, fără lichid.'), form, parse([], 'Normal.'));
  assert.equal(form.report.conclusions, 'Normal, fără lichid.');
  assert.equal(form.notes.conclusions, undefined);

  form = editField(form, 'conclusions', 'Scris de medic.');
  form = dictate(parse([], 'Altceva.'), form, parse([], 'Normal, fără lichid.'));
  assert.equal(form.report.conclusions, 'Altceva.');
  assert.equal(form.notes.conclusions.previousValue, 'Scris de medic.');
  assert.equal(resolveNote(form, 'conclusions', 'Scris de medic.').report.conclusions, 'Scris de medic.');
});

test('only patient fields that changed since the previous parse are reported', () => {
  const first = { ...emptyPatient, lastName: 'Popescu', age: '65' };
  assert.deepEqual(changedPatientFields(null, first), first);
  assert.equal(changedPatientFields(first, { ...first }), null);
  assert.deepEqual(
    changedPatientFields(first, { ...first, weight: '80' }),
    { ...emptyPatient, weight: '80' },
  );
  assert.equal(changedPatientFields(first, { ...first, lastName: '' }), null);
});

test('merging dictated patient data keeps untouched fields and updates BMI', () => {
  const current = { ...createEmptyPatient(), lastName: 'Ionescu', firstName: 'Ana', height: '170' };
  const merged = mergeParsedPatient(current, { ...emptyPatient, weight: '72,25' });
  assert.equal(merged.lastName, 'Ionescu');
  assert.equal(merged.firstName, 'Ana');
  assert.equal(merged.weight, '72,25');
  assert.equal(merged.bmi, '25.0');
});

test('BMI accepts height in centimeters or meters', () => {
  assert.equal(calculateBmi('80', '180'), '24.7');
  assert.equal(calculateBmi('80', '1,80'), '24.7');
  assert.equal(calculateBmi('', '180'), '');
  assert.equal(calculateBmi('80', '0'), '');
});

test('derived ratios handle decimal commas and empty or zero denominators', () => {
  const measurements = {
    ...createEmptyEchoReport().measurements,
    mitralE: '0,9',
    mitralA: '0,6',
    tricuspidE: '50',
    tricuspidA: '0',
  };
  const result = calculateDerivedMeasurements(measurements);
  assert.equal(result.mitralEaRatio, '1.5');
  assert.equal(result.tricuspidEaRatio, '');
  assert.equal(result.septalEaPrimeRatio, '');
});

test('the default examination date is the local calendar date', () => {
  const now = new Date();
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  assert.equal(createEmptyPatient().examinationDate, expected);
});

test('the field registry covers every measurement exactly once', async () => {
  const { MEASUREMENT_SECTIONS, MEASUREMENT_FIELDS, DERIVED_MEASUREMENT_KEYS } = await import(
    '../dist-parser-tests/src/config/measurementFields.js'
  );
  const keys = MEASUREMENT_SECTIONS.flatMap((section) => section.fields.map((field) => field.key));
  assert.deepEqual([...keys].sort(), Object.keys(createEmptyEchoReport().measurements).sort());
  assert.equal(new Set(keys).size, keys.length, 'no duplicate fields');
  assert.deepEqual([...DERIVED_MEASUREMENT_KEYS].sort(), ['eePrimeRatio', 'mitralEaRatio', 'septalEaPrimeRatio', 'tricuspidEaRatio']);
  assert.equal(MEASUREMENT_FIELDS.aorticVmax.reviewLabel, 'Flux aortic — Vmax');
  assert.equal(MEASUREMENT_FIELDS.aorticRegurgitation.reviewLabel, 'Regurgitare aortică');
  assert.equal(MEASUREMENT_FIELDS.mitralE.reportLabel, 'Unda E');
});
