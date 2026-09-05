import type { TranscriptionResult } from '../types/audioPipeline';
import { getEchoReportApi } from './electronBridge';

export class TranscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

/**
 * Transcribes a locally recorded audio Blob using offline whisper.cpp.
 *
 * Pipeline (Electron main process):
 *   recorded audio → ffmpeg → WAV PCM 16-bit / 16 kHz / mono
 *   → whisper-cli.exe → large-v3-turbo → Romanian transcript
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

  const audioBytes = new Uint8Array(await audio.arrayBuffer());

  try {
    const result = await api.transcribeAudio(
      audioBytes,
      audio.type || 'audio/webm',
    );

    if (!result.success) {
      throw new TranscriptionError(result.message);
    }

    return {
      text: result.transcript,
      isMock: false,
      originalAudio: result.original,
      convertedAudio: result.converted,
    };
  } catch (error) {
    if (error instanceof TranscriptionError) throw error;
    const message =
      error instanceof Error
        ? error.message
        : 'Transcrierea locală a eșuat.';
    throw new TranscriptionError(message);
  }
}
