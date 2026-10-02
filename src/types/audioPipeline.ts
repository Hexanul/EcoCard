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
  originalAudio?: AudioBlobSummary;
  convertedAudio?: ConvertedAudioInfo;
};

export type PipelineStatus = {
  ffmpegFound: boolean;
  whisperCliFound: boolean;
  modelFound: boolean;
  model: string;
  language: string;
};

export type TranscriptionFailure = {
  success: false;
  errorCode: string;
  message: string;
};

export type TranscriptionSuccess = {
  success: true;
  transcript: string;
  original: AudioBlobSummary;
  converted: ConvertedAudioInfo;
};

export type TranscriptionResponse = TranscriptionSuccess | TranscriptionFailure;
