export type AudioBlobInfo = {
  mimeType: string;
  sizeBytes: number;
  sizeFormatted: string;
};

const RECORDING_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
] as const;

export function getSupportedRecordingMimeTypes(): string[] {
  if (typeof MediaRecorder === 'undefined') {
    return [];
  }
  return RECORDING_MIME_CANDIDATES.filter((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

export function getPreferredRecordingMimeType(): string {
  return getSupportedRecordingMimeTypes()[0] ?? '';
}

export function getAudioBlobInfo(blob: Blob): AudioBlobInfo {
  return {
    mimeType: blob.type || 'unknown',
    sizeBytes: blob.size,
    sizeFormatted: formatBytes(blob.size),
  };
}

export function formatAudioBlobInfo(blob: Blob): string {
  const info = getAudioBlobInfo(blob);
  return `MIME: ${info.mimeType} | Dimensiune: ${info.sizeFormatted}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
