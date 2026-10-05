// Converts a recording to the only format whisper-cli receives: WAV, PCM
// signed 16-bit, mono, 16 kHz. Decoding and resampling use Chromium's own
// codecs (Web Audio), so the app ships no ffmpeg.
//
// Self-contained on purpose (no imports): scripts/whisper-wav-harness.cjs
// loads the compiled module unchanged in a hidden Electron window, so the
// dictation tools convert audio exactly like the app does.

export const WHISPER_SAMPLE_RATE = 16000;

const WAV_HEADER_BYTES = 44;

/** Averages all channels into one; a single channel is returned as is. */
export function downmixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];
  const length = Math.min(...channels.map((channel) => channel.length));
  const mono = new Float32Array(length);
  for (const channel of channels) {
    for (let i = 0; i < length; i += 1) mono[i] += channel[i];
  }
  for (let i = 0; i < length; i += 1) mono[i] /= channels.length;
  return mono;
}

/** Encodes float samples (-1..1, clipped) as a mono PCM 16-bit WAV file. */
export function encodeWav16(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const bytes = new Uint8Array(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(bytes.buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, Number.isFinite(samples[i]) ? samples[i] : 0));
    view.setInt16(WAV_HEADER_BYTES + i * 2, Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff), true);
  }
  return bytes;
}

/**
 * Decodes any recording Chromium can play (WebM/Opus from MediaRecorder,
 * M4A/AAC, MP3, OGG, WAV) and returns a 16 kHz mono 16-bit WAV. Throws when
 * the audio cannot be decoded or contains no samples.
 */
export async function convertToWhisperWav(encoded: ArrayBuffer): Promise<Uint8Array> {
  // decodeAudioData resamples to the context's rate (Chromium's sinc resampler).
  const context = new OfflineAudioContext(1, 1, WHISPER_SAMPLE_RATE);
  const decoded = await context.decodeAudioData(encoded);
  if (decoded.length === 0) throw new Error('The recording contains no audio.');
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
  return encodeWav16(downmixToMono(channels), WHISPER_SAMPLE_RATE);
}
