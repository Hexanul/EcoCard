import { convertToWhisperWav } from '../audio/whisperWav';
import type { TranscriptionResult } from '../types/audioPipeline';
import { getEchoReportApi } from './electronBridge';

// Failures where transcribing the same recording again can succeed (whisper
// crashed, ran out of time or could not write its files). Unusable audio,
// silence or a missing whisper install fail the same way every time.
const RETRYABLE_ERROR_CODES = new Set(['WHISPER_PROCESS_FAILED', 'PROCESS_TIMEOUT', 'TEMPORARY_STORAGE_ERROR', 'UNKNOWN_ERROR']);

export class TranscriptionError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable = false) {
    super(message);
    this.name = 'TranscriptionError';
    this.retryable = retryable;
  }
}

/**
 * Transcribes a locally recorded audio Blob using offline whisper.cpp.
 *
 * Pipeline:
 *   recorded audio → Chromium decoder (renderer, src/audio/whisperWav.ts)
 *   → WAV PCM 16-bit / 16 kHz / mono → Electron main process
 *   → whisper-cli.exe → Romanian transcript
 *
 * The UI must not know how whisper.cpp works — it only calls this function.
 *
 * Browser-only Vite dev mode cannot execute whisper-cli.exe.
 * Use `npm run electron:dev` for local transcription testing.
 *
 * No network requests. No cloud APIs. Audio and transcript stay local.
 */
export async function transcribeAudio(audio: Blob): Promise<TranscriptionResult> {
  const api = getEchoReportApi();
  if (!api) {
    throw new TranscriptionError(
      'Transcrierea locală necesită aplicația desktop Raport Eco (Electron). whisper.cpp nu poate rula în browser.',
    );
  }

  let wav: Uint8Array;
  try {
    wav = await convertToWhisperWav(await audio.arrayBuffer());
  } catch {
    throw new TranscriptionError('Înregistrarea audio nu a putut fi convertită local. Încercați din nou.');
  }

  try {
    const result = await api.transcribeAudio(wav, 'audio/wav');

    if (!result.success) {
      throw new TranscriptionError(result.message, RETRYABLE_ERROR_CODES.has(result.errorCode));
    }

    return { text: result.transcript };
  } catch (error) {
    if (error instanceof TranscriptionError) throw error;
    // The IPC call itself failed; the main process may be fine on a retry.
    throw new TranscriptionError('Transcrierea locală a eșuat.', true);
  }
}
