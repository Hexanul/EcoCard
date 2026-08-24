import type { PipelineStatus, TranscriptionResponse } from './audioPipeline';

export type ExportPdfErrorCode =
  | 'CANCELED'
  | 'REPORT_NOT_READY_FOR_PDF'
  | 'PDF_GENERATION_FAILED'
  | 'PDF_SAVE_FAILED'
  | 'UNEXPECTED_ERROR';

export type ExportPdfResponse =
  | { success: true }
  | { success: false; errorCode: ExportPdfErrorCode; message: string };

export type EchoReportAPI = {
  isAvailable: true;
  getPipelineStatus: () => Promise<PipelineStatus>;
  transcribeAudio: (
    audioBytes: Uint8Array,
    mimeType: string,
  ) => Promise<TranscriptionResponse>;
  exportPdf: (suggestedName?: string) => Promise<ExportPdfResponse>;
};

declare global {
  interface Window {
    echoReport?: EchoReportAPI;
  }
}

export {};
