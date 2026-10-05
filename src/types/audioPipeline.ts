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
  convertedAudio?: ConvertedAudioInfo;
};

export type PipelineStatus = {
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
  converted: ConvertedAudioInfo;
};

export type TranscriptionResponse = TranscriptionSuccess | TranscriptionFailure;
