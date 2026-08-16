export type AudioBlobSummary = {
  mimeType: string;
  sizeBytes: number;
  sizeFormatted: string;
};

export type ConvertedAudioInfo = {
  format: string;
  codec: string;
  channels: number;
  sampleRate: number;
  bitDepth: number;
  sizeBytes: number;
  sizeFormatted: string;
};

export type TranscriptionResult = {
  text: string;
  isMock: boolean;
  originalAudio?: AudioBlobSummary;
  convertedAudio?: ConvertedAudioInfo;
};

export type PipelineStatus = {
  ffmpegFound: boolean;
  whisperCliFound: boolean;
  modelFound: boolean;
  ffmpegPath: string;
  whisperCliPath: string;
  modelPath: string;
  model: string;
  language: string;
};
