import assert from 'node:assert/strict';
import test from 'node:test';
import { WHISPER_SAMPLE_RATE, downmixToMono, encodeWav16 } from '../dist-audio/whisperWav.js';

function header(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset) => String.fromCharCode(...bytes.slice(offset, offset + 4));
  return {
    riff: ascii(0), riffSize: view.getUint32(4, true), wave: ascii(8), fmt: ascii(12),
    fmtSize: view.getUint32(16, true), format: view.getUint16(20, true), channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true), byteRate: view.getUint32(28, true), blockAlign: view.getUint16(32, true),
    bitDepth: view.getUint16(34, true), data: ascii(36), dataSize: view.getUint32(40, true),
  };
}

function samples(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from({ length: (bytes.length - 44) / 2 }, (_, i) => view.getInt16(44 + i * 2, true));
}

test('whisper WAV has the canonical 16 kHz mono PCM 16-bit header the main process accepts', () => {
  const wav = encodeWav16(new Float32Array(10), WHISPER_SAMPLE_RATE);
  assert.equal(wav.length, 44 + 20);
  assert.deepEqual(header(wav), {
    riff: 'RIFF', riffSize: 36 + 20, wave: 'WAVE', fmt: 'fmt ', fmtSize: 16, format: 1, channels: 1,
    sampleRate: 16000, byteRate: 32000, blockAlign: 2, bitDepth: 16, data: 'data', dataSize: 20,
  });
});

test('samples are rounded to 16 bits and clipped at full scale; NaN becomes silence', () => {
  const wav = encodeWav16(new Float32Array([0, 1, -1, 0.5, -0.5, 2, -3, Number.NaN]), 16000);
  assert.deepEqual(samples(wav), [0, 32767, -32768, 16384, -16384, 32767, -32768, 0]);
});

test('channels are averaged into mono; one channel is kept as is', () => {
  assert.deepEqual(Array.from(downmixToMono([new Float32Array([1, 0.5, -1]), new Float32Array([0, 0.5, 1])])), [0.5, 0.5, 0]);
  const single = new Float32Array([0.25]);
  assert.equal(downmixToMono([single]), single);
  assert.equal(downmixToMono([]).length, 0);
});
