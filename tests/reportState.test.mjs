import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyDetectedItems,
  buildDetectedItems,
  changedPatientFields,
  conflictingDuplicateFields,
  getFollowingCurrentNumber,
  mergeParsedPatient,
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

test('detected items include derived ratios computed with existing form values', () => {
  const existing = { ...createEmptyEchoReport().measurements, mitralA: '50' };
  const items = buildDetectedItems(
    { measurements: [numeric('mitralE', '100')], conclusions: '', patient: emptyPatient },
    existing,
  );
  assert.deepEqual(items.map((item) => [item.field, item.value]), [
    ['mitralE', '100'],
    ['mitralEaRatio', '2'],
  ]);
});

test('dictated derived ratios are replaced by calculated ones', () => {
  const items = buildDetectedItems(
    { measurements: [numeric('mitralEaRatio', '9')], conclusions: '', patient: emptyPatient },
    createEmptyEchoReport().measurements,
  );
  assert.deepEqual(items, []);
});

test('conclusions become a review item', () => {
  const items = buildDetectedItems(
    { measurements: [], conclusions: 'Fără modificări.', patient: emptyPatient },
    createEmptyEchoReport().measurements,
  );
  assert.deepEqual(items.map((item) => [item.field, item.value]), [['conclusions', 'Fără modificări.']]);
});

test('applying items merges values, conclusions, and recalculates ratios', () => {
  const report = createEmptyEchoReport();
  report.measurements.tricuspidA = '40';
  const next = applyDetectedItems(report, [
    numeric('tricuspidE', '60'),
    { field: 'conclusions', label: 'Concluzii', value: 'Normal.', kind: 'qualitative', confidence: 'high', sourceText: '' },
  ]);
  assert.equal(next.measurements.tricuspidE, '60');
  assert.equal(next.measurements.tricuspidEaRatio, '1.5');
  assert.equal(next.conclusions, 'Normal.');
  assert.equal(report.measurements.tricuspidE, '', 'input report is not mutated');
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

test('a field dictated twice with different values is a conflict and gets no derived ratio', () => {
  // Whisper heard "VD" as "VS": the VS field received two different values.
  const items = buildDetectedItems(
    {
      measurements: [
        numeric('lvLateromedialDiameter', '4.4'),
        numeric('lvLateromedialDiameter', '3.5'),
        numeric('mitralE', '80'),
        numeric('mitralE', '64'),
        numeric('mitralA', '50'),
      ],
      conclusions: '',
      patient: emptyPatient,
    },
    createEmptyEchoReport().measurements,
  );
  assert.deepEqual(items.map((item) => [item.field, item.value]), [
    ['lvLateromedialDiameter', '4.4'],
    ['lvLateromedialDiameter', '3.5'],
    ['mitralE', '80'],
    ['mitralE', '64'],
    ['mitralA', '50'],
  ]);
  assert.deepEqual([...conflictingDuplicateFields(items)].sort(), ['lvLateromedialDiameter', 'mitralE']);
});

test('a field repeated with the same value is shown once and is not a conflict', () => {
  const items = buildDetectedItems(
    {
      measurements: [numeric('mitralE', '80'), numeric('mitralE', '80'), numeric('mitralA', '64')],
      conclusions: '',
      patient: emptyPatient,
    },
    createEmptyEchoReport().measurements,
  );
  assert.deepEqual(items.map((item) => [item.field, item.value]), [
    ['mitralE', '80'],
    ['mitralA', '64'],
    ['mitralEaRatio', '1.25'],
  ]);
  assert.equal(conflictingDuplicateFields(items).size, 0);
});
