export type TranscriptionResult = {
  text: string;
};

export type PipelineStatus = {
  whisperCliFound: boolean;
  modelFound: boolean;
  model: string;
};

export type TranscriptionFailure = {
  success: false;
  errorCode: string;
  message: string;
};

export type TranscriptionSuccess = {
  success: true;
  transcript: string;
};

export type TranscriptionResponse = TranscriptionSuccess | TranscriptionFailure;
