import type { ConvertedAudioInfo, AudioBlobSummary } from '../types/audioPipeline';
import { getEchoReportApi } from './electronBridge';

/**
 * Converts browser-recorded audio into a Whisper-compatible format (PCM/WAV).
 *
 * MediaRecorder typically produces WebM/Opus or similar containers.
 * whisper.cpp works best with 16-bit PCM WAV at 16 kHz mono.
 *
 * Conversion runs in the Electron main process via ffmpeg.exe.
 * Browser React code cannot execute ffmpeg directly.
 */
export class AudioConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioConversionError';
  }
}

export type WhisperAudioConversionResult = {
  wavBlob: Blob;
  original: AudioBlobSummary;
  converted: ConvertedAudioInfo;
};

export async function convertToWhisperAudio(
  audio: Blob,
): Promise<WhisperAudioConversionResult> {
  const api = getEchoReportApi();
  if (!api) {
    throw new AudioConversionError(
      'Conversia audio necesită aplicația desktop Echo Report (Electron). FFmpeg nu poate rula în browser.',
    );
  }

  const audioBytes = new Uint8Array(await audio.arrayBuffer());

  try {
    const result = await api.convertAudio(audioBytes, audio.type || 'audio/webm');

    return {
      wavBlob: new Blob([Uint8Array.from(result.wavBytes)], { type: 'audio/wav' }),
      original: result.original,
      converted: result.converted,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Conversia audio a eșuat.';
    throw new AudioConversionError(message);
  }
}

/** @deprecated Use convertToWhisperAudio */
export async function convertToWhisperFormat(audio: Blob): Promise<Blob> {
  const result = await convertToWhisperAudio(audio);
  return result.wavBlob;
}
