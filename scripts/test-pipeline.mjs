import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { transcribeAudio } from '../dist-electron/transcription.js';

const testAudioPath = process.env.ECHOREPORT_TEST_AUDIO;

if (!testAudioPath) {
  console.error('Set ECHOREPORT_TEST_AUDIO to a local WAV, WebM, OGG, M4A, or MP3 test recording.');
  process.exitCode = 1;
} else if (!existsSync(testAudioPath)) {
  console.error(`Test audio was not found: ${testAudioPath}`);
  process.exitCode = 1;
} else {
  const extension = testAudioPath.split('.').pop()?.toLowerCase();
  const mimeTypes = {
    wav: 'audio/wav', webm: 'audio/webm', ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg',
  };
  const mimeType = mimeTypes[extension] ?? 'application/octet-stream';
  const result = await transcribeAudio(new Uint8Array(await readFile(testAudioPath)), mimeType);
  if (!result.success) {
    console.error(`${result.errorCode}: ${result.message}`);
    process.exitCode = 1;
  } else {
    console.log('Conversion:', result.converted);
    console.log('Romanian transcript:', result.transcript);
  }
}
