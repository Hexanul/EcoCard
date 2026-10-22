import { WHISPER_SAMPLE_RATE, decodeToWhisperSamples, encodeWav16 } from '../audio/whisperWav';
import { getEchoReportApi } from './electronBridge';

export class TranscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

export const NO_SPEECH_MESSAGE = 'Nu s-a detectat vorbire în înregistrare.';

/*
 * Offline transcription of locally recorded audio with whisper.cpp.
 *
 * Pipeline:
 *   recorded audio → Chromium decoder (renderer, src/audio/whisperWav.ts)
 *   → 16 kHz mono samples → WAV PCM 16-bit → Electron main process
 *   → whisper-cli.exe → Romanian transcript
 *
 * The recording is decoded and transcribed in two steps so that the part
 * recorded before a pause can be transcribed while the doctor is paused
 * (services/segmentedTranscription.ts). The UI must not know how whisper.cpp
 * works — it only calls these functions.
 *
 * Browser-only Vite dev mode cannot execute whisper-cli.exe.
 * Use `npm run dev` for local transcription testing.
 *
 * No network requests. No cloud APIs. Audio and transcript stay local.
 */

/** Decodes a recording (or a paused recording's chunks so far) into whisper's 16 kHz mono samples. */
export async function decodeRecording(audio: Blob): Promise<Float32Array> {
  try {
    return await decodeToWhisperSamples(await audio.arrayBuffer());
  } catch {
    throw new TranscriptionError('Înregistrarea audio nu a putut fi convertită local. Încercați din nou.');
  }
}

/** Transcribes 16 kHz mono samples; returns '' when whisper heard no speech. */
export async function transcribeSamples(samples: Float32Array): Promise<string> {
  const api = getEchoReportApi();
  if (!api) {
    throw new TranscriptionError(
      'Transcrierea locală necesită aplicația desktop Raport Eco (Electron). whisper.cpp nu poate rula în browser.',
    );
  }

  try {
    const result = await api.transcribeAudio(encodeWav16(samples, WHISPER_SAMPLE_RATE), 'audio/wav');
    if (!result.success) {
      if (result.errorCode === 'NO_SPEECH') return '';
      throw new TranscriptionError(result.message);
    }
    return result.transcript;
  } catch (error) {
    if (error instanceof TranscriptionError) throw error;
    const message =
      error instanceof Error
        ? error.message
        : 'Transcrierea locală a eșuat.';
    throw new TranscriptionError(message);
  }
}
