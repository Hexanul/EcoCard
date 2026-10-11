import assert from 'node:assert/strict';
import test from 'node:test';
import { MEASUREMENT_SECTIONS } from '../dist-parser-tests/src/config/measurementFields.js';
import { MEASUREMENT_LIMITS, PATIENT_LIMITS } from '../dist-parser-tests/src/config/measurementLimits.js';
import { createEmptyEchoReport } from '../dist-parser-tests/src/types/echoReport.js';
import {
  checkValue,
  crossFieldWarnings,
  describeStatus,
  findReportIssues,
  sanitizeNumericInput,
} from '../dist-parser-tests/src/utils/valueChecks.js';

test('every numeric measurement has limits and no other field has any', () => {
  const fields = MEASUREMENT_SECTIONS.flatMap((section) => section.fields);
  const numeric = fields.filter((field) => field.type === undefined || field.type === 'numeric');
  assert.deepEqual(Object.keys(MEASUREMENT_LIMITS).sort(), numeric.map((field) => field.key).sort());
});

test('limits are ordered from reject to confirm and back', () => {
  for (const [key, limits] of Object.entries({ ...MEASUREMENT_LIMITS, ...PATIENT_LIMITS })) {
    const bounds = [limits.rejectBelow, limits.confirmBelow, limits.confirmAbove, limits.rejectAbove]
      .filter((bound) => bound !== undefined);
    for (let i = 1; i < bounds.length; i += 1) {
      assert.ok(bounds[i - 1] < bounds[i], `${key}: ${bounds.join(' < ')}`);
    }
    assert.ok(Number.isInteger(limits.maxDecimals) && limits.maxDecimals >= 0, key);
  }
});

test('a value equal to a limit is on the accepted side, as in the spreadsheet', () => {
  const lvedd = MEASUREMENT_LIMITS.lvEndDiastolicDiameter; // 0.8 | 2 | 8.5 | 14 cm
  assert.equal(checkValue('', lvedd), 'empty');
  assert.equal(checkValue('  ', lvedd), 'empty');
  assert.equal(checkValue('0.79', lvedd), 'reject');
  assert.equal(checkValue('0.8', lvedd), 'confirm');
  assert.equal(checkValue('1.99', lvedd), 'confirm');
  assert.equal(checkValue('2', lvedd), 'accept');
  assert.equal(checkValue('4,8', lvedd), 'accept');
  assert.equal(checkValue('8.5', lvedd), 'accept');
  assert.equal(checkValue('8.51', lvedd), 'confirm');
  assert.equal(checkValue('14', lvedd), 'confirm');
  assert.equal(checkValue('14.01', lvedd), 'reject');
  assert.equal(checkValue('abc', lvedd), 'reject');
  assert.equal(checkValue('.', lvedd), 'reject');
});

test('fields without a lower confirm limit only confirm high values', () => {
  const aorticPmax = MEASUREMENT_LIMITS.aorticPmax; // 0.5 | — | 170 | 330 mmHg
  assert.equal(checkValue('0.4', aorticPmax), 'reject');
  assert.equal(checkValue('0.5', aorticPmax), 'accept');
  assert.equal(checkValue('171', aorticPmax), 'confirm');
  assert.equal(checkValue('331', aorticPmax), 'reject');
  assert.equal(checkValue('101', PATIENT_LIMITS.age), 'confirm');
  assert.equal(checkValue('0', PATIENT_LIMITS.age), 'accept');
});

test('messages name the limits that apply', () => {
  const lvedd = MEASUREMENT_LIMITS.lvEndDiastolicDiameter;
  assert.equal(describeStatus('reject', lvedd, 'cm'), 'Valoare imposibilă — limite 0.8–14 cm');
  assert.equal(describeStatus('confirm', lvedd, 'cm'), 'Valoare neobișnuită (uzual 2–8.5 cm)');
  assert.equal(describeStatus('confirm', MEASUREMENT_LIMITS.aorticPmax, 'mmHg'), 'Valoare neobișnuită (uzual ≤ 170 mmHg)');
  assert.equal(describeStatus('accept', lvedd, 'cm'), '');
});

test('typing keeps digits and one decimal separator, with capped decimals', () => {
  assert.equal(sanitizeNumericInput('4,8', 2), '4.8');
  assert.equal(sanitizeNumericInput('4.85', 2), '4.85');
  assert.equal(sanitizeNumericInput('4.857', 2), '4.85');
  assert.equal(sanitizeNumericInput('4.8.5', 2), '4.85');
  assert.equal(sanitizeNumericInput('4,8,', 1), '4.8');
  assert.equal(sanitizeNumericInput(' 4 cm', 2), '4');
  assert.equal(sanitizeNumericInput('-3', 1), '3');
  assert.equal(sanitizeNumericInput('190', 0), '190');
  assert.equal(sanitizeNumericInput('190.5', 0), '190');
  assert.equal(sanitizeNumericInput('', 2), '');
  assert.equal(sanitizeNumericInput('.', 2), '.');
});

test('cross-field warnings only flag inconsistent pairs', () => {
  const measurements = createEmptyEchoReport().measurements;
  assert.deepEqual(crossFieldWarnings(measurements), {});
  assert.deepEqual(
    crossFieldWarnings({
      ...measurements,
      lvEndDiastolicDiameter: '4.8',
      lvEndSystolicDiameter: '5.1',
      lvEndDiastolicVolume: '100',
      lvEndSystolicVolume: '120',
      aorticPmax: '40',
      aorticPmean: '45',
    }),
    {
      lvEndSystolicDiameter: 'Mai mare decât diametrul telediastolic',
      lvEndSystolicVolume: 'Mai mare decât volumul telediastolic',
      aorticPmean: 'Mai mare decât Pmax aortic',
    },
  );
  assert.deepEqual(
    crossFieldWarnings({ ...measurements, lvEndDiastolicDiameter: '4.8', lvEndSystolicDiameter: '3.1' }),
    {},
  );
});

test('a Pmax far from 4 x Vmax squared is flagged', () => {
  const measurements = createEmptyEchoReport().measurements;
  // 300 cm/s -> 36 mmHg expected; 25 % tolerance = 9 mmHg.
  assert.deepEqual(crossFieldWarnings({ ...measurements, aorticVmax: '300', aorticPmax: '36' }), {});
  assert.deepEqual(crossFieldWarnings({ ...measurements, aorticVmax: '300', aorticPmax: '44' }), {});
  assert.deepEqual(crossFieldWarnings({ ...measurements, aorticVmax: '300', aorticPmax: '46' }), {
    aorticPmax: 'Diferă de 4·Vmax² ≈ 36 mmHg',
  });
  // Low velocities use the 5 mmHg minimum: 100 cm/s -> 4 mmHg.
  assert.deepEqual(crossFieldWarnings({ ...measurements, tricuspidVmax: '100', tricuspidPmax: '8' }), {});
  assert.deepEqual(crossFieldWarnings({ ...measurements, tricuspidVmax: '100', tricuspidPmax: '10' }), {
    tricuspidPmax: 'Diferă de 4·Vmax² ≈ 4 mmHg',
  });
  assert.deepEqual(crossFieldWarnings({ ...measurements, pulmonaryPmax: '10' }), {});
});

test('impossible and unconfirmed unusual values block the report', () => {
  const report = createEmptyEchoReport();
  assert.deepEqual(findReportIssues(report, {}), []);

  report.patient.age = '140';
  report.patient.weight = '20';
  report.measurements.lvEndDiastolicDiameter = '1.5';
  report.measurements.mitralTriv = '90';
  assert.deepEqual(findReportIssues(report, {}), [
    { id: 'patient-age', label: 'Vârstă', status: 'reject' },
    { id: 'patient-weight', label: 'Greutate', status: 'confirm' },
    { id: 'lvEndDiastolicDiameter', label: 'VS — diametrul telediastolic', status: 'confirm' },
  ]);

  const confirmed = { 'patient-weight': '20', lvEndDiastolicDiameter: '1.5', 'patient-age': '140' };
  assert.deepEqual(findReportIssues(report, confirmed), [
    { id: 'patient-age', label: 'Vârstă', status: 'reject' },
  ]);

  // A dictated value with a warning blocks until its note is resolved; a
  // note with information only does not.
  const notes = {
    mitralTriv: { warnings: ['Dictat ca nesigur — verificați valoarea.'], info: [] },
    tapse: { warnings: [], info: ['Convertit automat din cm în mm.'] },
    conclusions: { warnings: ['A înlocuit textul scris în formular.'], info: [] },
  };
  assert.deepEqual(findReportIssues(report, confirmed, notes), [
    { id: 'patient-age', label: 'Vârstă', status: 'reject' },
    { id: 'mitralTriv', label: 'Flux mitral — TRIV', status: 'dictated' },
    { id: 'report-conclusions', label: 'Concluzii', status: 'dictated' },
  ]);

  // A confirmation is for one value only.
  report.patient.age = '40';
  report.measurements.lvEndDiastolicDiameter = '1.6';
  assert.deepEqual(findReportIssues(report, confirmed), [
    { id: 'lvEndDiastolicDiameter', label: 'VS — diametrul telediastolic', status: 'confirm' },
  ]);
});
