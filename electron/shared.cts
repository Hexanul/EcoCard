export const IPC = {
  getPipelineStatus: 'echo-report:get-pipeline-status',
  transcribeAudio: 'echo-report:transcribe-audio',
  exportPdf: 'echo-report:export-pdf',
} as const;

export type ConvertedAudio = {
  format: 'WAV'; codec: 'PCM signed 16-bit'; channels: 1; sampleRate: 16000; bitDepth: 16; sizeBytes: number; sizeFormatted: string;
};
export type TranscriptionFailure = {
  success: false;
  errorCode: 'INVALID_AUDIO' | 'WHISPER_CLI_NOT_FOUND' | 'WHISPER_MODEL_NOT_FOUND' | 'WHISPER_PROCESS_FAILED' | 'WHISPER_BLOCKED_BY_WINDOWS' | 'PROCESS_TIMEOUT' | 'TEMPORARY_STORAGE_ERROR' | 'NO_SPEECH' | 'UNKNOWN_ERROR';
  message: string;
};
export type TranscriptionSuccess = { success: true; transcript: string; converted: ConvertedAudio };
export type TranscriptionResponse = TranscriptionSuccess | TranscriptionFailure;
export type PipelineStatus = { whisperCliFound: boolean; modelFound: boolean; model: string; language: 'ro' };

export type ExportPdfErrorCode = 'CANCELED' | 'REPORT_NOT_READY_FOR_PDF' | 'PDF_GENERATION_FAILED' | 'PDF_SAVE_FAILED' | 'UNEXPECTED_ERROR';
export type ExportPdfResponse =
  | { success: true }
  | { success: false; errorCode: ExportPdfErrorCode; message: string };
