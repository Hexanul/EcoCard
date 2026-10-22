import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MIN_SEGMENT_SAMPLES,
  createSegmentedTranscription,
} from '../dist-parser-tests/src/services/segmentedTranscription.js';

// The fake "recording" is its length in samples; sample i decodes to i, so
// every transcribed piece shows exactly which samples it covered.
function fakeWhisper({ texts = [], fail = [], delayMs = 0, onStart = () => {} } = {}) {
  const pieces = [];
  let running = 0;
  let maxRunning = 0;
  const deps = {
    decode: async (length) => Float32Array.from({ length }, (_, i) => i),
    transcribe: async (samples) => {
      const index = pieces.length;
      pieces.push({ start: samples[0], length: samples.length });
      onStart();
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      running -= 1;
      if (fail.includes(index)) throw new Error('whisper failed');
      return texts[index] ?? `piece ${index + 1}`;
    },
  };
  return { deps, pieces, maxRunning: () => maxRunning };
}

test('without a pause the whole recording is transcribed once', async () => {
  const whisper = fakeWhisper();
  const transcription = createSegmentedTranscription(whisper.deps);
  assert.equal(await transcription.finish(48000), 'piece 1');
  assert.deepEqual(whisper.pieces, [{ start: 0, length: 48000 }]);
});

test('a pause transcribes the audio so far and stop only the rest, joined in order', async () => {
  const whisper = fakeWhisper();
  const transcription = createSegmentedTranscription(whisper.deps);
  assert.equal(await transcription.transcribeUpTo(32000), 'piece 1');
  assert.equal(await transcription.finish(80000), 'piece 1\npiece 2');
  assert.deepEqual(whisper.pieces, [
    { start: 0, length: 32000 },
    { start: 32000, length: 48000 },
  ]);
});

test('quick pauses run one whisper at a time, without gaps or overlaps', async () => {
  const whisper = fakeWhisper({ delayMs: 5 });
  const transcription = createSegmentedTranscription(whisper.deps);
  const first = transcription.transcribeUpTo(20000);
  const second = transcription.transcribeUpTo(36000);
  const text = await transcription.finish(50000);
  assert.equal(await first, 'piece 1');
  assert.equal(await second, 'piece 1\npiece 2');
  assert.equal(text, 'piece 1\npiece 2\npiece 3');
  assert.equal(whisper.maxRunning(), 1);
  assert.deepEqual(whisper.pieces, [
    { start: 0, length: 20000 },
    { start: 20000, length: 16000 },
    { start: 36000, length: 14000 },
  ]);
});

test('a piece without speech is left out of the text', async () => {
  const whisper = fakeWhisper({ texts: ['', ' Flux mitral. '] });
  const transcription = createSegmentedTranscription(whisper.deps);
  assert.equal(await transcription.transcribeUpTo(16000), '');
  assert.equal(await transcription.finish(40000), 'Flux mitral.');
});

test('a piece shorter than 0.1 s is never sent; at a pause it waits for the next piece', async () => {
  const whisper = fakeWhisper();
  const transcription = createSegmentedTranscription(whisper.deps);
  await transcription.transcribeUpTo(MIN_SEGMENT_SAMPLES - 1);
  await transcription.transcribeUpTo(30000);
  assert.equal(await transcription.finish(30000 + MIN_SEGMENT_SAMPLES - 1), 'piece 1');
  assert.deepEqual(whisper.pieces, [{ start: 0, length: 30000 }]);
});

test('after a failed piece, stop transcribes the whole recording again', async () => {
  const whisper = fakeWhisper({ fail: [0] });
  const transcription = createSegmentedTranscription(whisper.deps);
  assert.equal(await transcription.transcribeUpTo(32000), '');
  await transcription.transcribeUpTo(48000);
  assert.equal(await transcription.finish(80000), 'piece 2');
  assert.deepEqual(whisper.pieces, [
    { start: 0, length: 32000 },
    { start: 0, length: 80000 },
  ]);
});

test('a failure at stop is reported', async () => {
  const whisper = fakeWhisper({ fail: [1] });
  const transcription = createSegmentedTranscription(whisper.deps);
  await transcription.transcribeUpTo(32000);
  await assert.rejects(transcription.finish(80000), /whisper failed/);
});

test('a pause arriving after stop is ignored', async () => {
  const whisper = fakeWhisper();
  const transcription = createSegmentedTranscription(whisper.deps);
  const text = transcription.finish(50000);
  await transcription.transcribeUpTo(30000);
  assert.equal(await text, 'piece 1');
  assert.deepEqual(whisper.pieces, [{ start: 0, length: 50000 }]);
});

test('cancel drops the running piece and skips the rest', async () => {
  let transcription;
  const whisper = fakeWhisper({ delayMs: 5, onStart: () => transcription.cancel() });
  transcription = createSegmentedTranscription(whisper.deps);
  assert.equal(await transcription.transcribeUpTo(32000), '');
  await transcription.transcribeUpTo(48000);
  assert.equal(await transcription.finish(80000), '');
  assert.equal(whisper.pieces.length, 1);
});
