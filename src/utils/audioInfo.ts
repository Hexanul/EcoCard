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
