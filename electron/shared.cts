export const IPC = {
  getPipelineStatus: 'echo-report:get-pipeline-status',
  transcribeAudio: 'echo-report:transcribe-audio',
  exportPdf: 'echo-report:export-pdf',
} as const;

export type TranscriptionFailure = {
  success: false;
  errorCode: 'INVALID_AUDIO' | 'NO_SPEECH' | 'WHISPER_CLI_NOT_FOUND' | 'WHISPER_MODEL_NOT_FOUND' | 'WHISPER_PROCESS_FAILED' | 'WHISPER_BLOCKED_BY_WINDOWS' | 'PROCESS_TIMEOUT' | 'TEMPORARY_STORAGE_ERROR' | 'UNTRUSTED_SENDER' | 'UNKNOWN_ERROR';
  message: string;
};
export type TranscriptionSuccess = { success: true; transcript: string };
export type TranscriptionResponse = TranscriptionSuccess | TranscriptionFailure;
export type PipelineStatus = { whisperCliFound: boolean; modelFound: boolean; model: string };

export type ExportPdfErrorCode = 'CANCELED' | 'REPORT_NOT_READY_FOR_PDF' | 'PDF_GENERATION_FAILED' | 'PDF_SAVE_FAILED' | 'UNEXPECTED_ERROR';
export type ExportPdfResponse =
  | { success: true }
  | { success: false; errorCode: ExportPdfErrorCode; message: string };
