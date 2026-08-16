import type { PipelineStatus, TranscriptionResponse } from './audioPipeline';

export type EchoReportAPI = {
  isAvailable: true;
  getPipelineStatus: () => Promise<PipelineStatus>;
  transcribeAudio: (
    audioBytes: Uint8Array,
    mimeType: string,
  ) => Promise<TranscriptionResponse>;
};

declare global {
  interface Window {
    echoReport?: EchoReportAPI;
  }
}

export {};
