import { existsSync } from 'node:fs';
import { transcribeAudio } from '../dist-electron/transcription.cjs';
import { convertFilesToWhisperWav } from './whisper-wav.mjs';

// End-to-end check of the real pipeline: the renderer's Chromium-based WAV
// conversion (run in a hidden Electron window) and the main process's
// whisper-cli invocation.
const testAudioPath = process.env.ECHOREPORT_TEST_AUDIO;

if (!testAudioPath) {
  console.error('Set ECHOREPORT_TEST_AUDIO to a local WAV, WebM, OGG, M4A, or MP3 test recording (never patient audio).');
  process.exitCode = 1;
} else if (!existsSync(testAudioPath)) {
  console.error(`Test audio was not found: ${testAudioPath}`);
  process.exitCode = 1;
} else {
  const [wav] = await convertFilesToWhisperWav([testAudioPath]);
  const result = await transcribeAudio(wav, 'audio/wav');
  if (!result.success) {
    console.error(`${result.errorCode}: ${result.message}`);
    process.exitCode = 1;
  } else {
    console.log('Conversion:', result.converted);
    console.log('Romanian transcript:', result.transcript);
  }
}
