import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isClinicSettingsEmpty,
  parseClinicSettings,
} from '../dist-parser-tests/src/config/clinicSettings.js';

const empty = { name: '', address: '' };

test('clinic settings start empty when nothing valid is stored', () => {
  assert.deepEqual(parseClinicSettings(null), empty);
  assert.deepEqual(parseClinicSettings(''), empty);
  assert.deepEqual(parseClinicSettings('{not json'), empty);
  assert.deepEqual(parseClinicSettings('null'), empty);
  assert.deepEqual(parseClinicSettings('"text"'), empty);
  assert.deepEqual(parseClinicSettings(JSON.stringify({ name: 5, address: null })), empty);
  assert.equal(isClinicSettingsEmpty(parseClinicSettings(null)), true);
});

test('clinic settings keep stored values, trimmed', () => {
  const settings = parseClinicSettings(
    JSON.stringify({ name: '  CMI DR. POPESCU ', address: ' Str. Mare nr. 1, Cluj ' }),
  );
  assert.deepEqual(settings, { name: 'CMI DR. POPESCU', address: 'Str. Mare nr. 1, Cluj' });
  assert.equal(isClinicSettingsEmpty(settings), false);
});

test('a partially filled header keeps the missing field empty', () => {
  assert.deepEqual(parseClinicSettings(JSON.stringify({ name: 'CMI X' })), { name: 'CMI X', address: '' });
  assert.equal(isClinicSettingsEmpty({ name: '  ', address: '' }), true);
});
