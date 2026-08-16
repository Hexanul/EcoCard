import type {
  AudioBlobSummary,
  ConvertedAudioInfo,
  PipelineStatus,
} from './audioPipeline';

export type EchoReportAPI = {
  isAvailable: true;
  getPipelineStatus: () => Promise<PipelineStatus>;
  convertAudio: (
    audioBytes: Uint8Array,
    mimeType: string,
  ) => Promise<{
    original: AudioBlobSummary;
    converted: ConvertedAudioInfo;
    wavBytes: Uint8Array;
  }>;
  processRecording: (
    audioBytes: Uint8Array,
    mimeType: string,
  ) => Promise<{
    transcript: string;
    original: AudioBlobSummary;
    converted: ConvertedAudioInfo;
  }>;
};

declare global {
  interface Window {
    echoReport?: EchoReportAPI;
  }
}

export {};
