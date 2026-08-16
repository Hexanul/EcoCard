export const IPC = {
  getPipelineStatus: 'echo-report:get-pipeline-status',
  transcribeAudio: 'echo-report:transcribe-audio',
} as const;

export type AudioSummary = {
  mimeType: string;
  sizeBytes: number;
  sizeFormatted: string;
};

export type ConvertedAudio = {
  format: 'WAV';
  codec: 'PCM signed 16-bit';
  channels: 1;
  sampleRate: 16000;
  bitDepth: 16;
  sizeBytes: number;
  sizeFormatted: string;
};

export type TranscriptionSuccess = {
  success: true;
  transcript: string;
  original: AudioSummary;
  converted: ConvertedAudio;
};

export type TranscriptionFailure = {
  success: false;
  errorCode:
    | 'INVALID_AUDIO'
    | 'FFMPEG_NOT_FOUND'
    | 'WHISPER_CLI_NOT_FOUND'
    | 'WHISPER_MODEL_NOT_FOUND'
    | 'FFMPEG_CONVERSION_FAILED'
    | 'WHISPER_PROCESS_FAILED'
    | 'PROCESS_TIMEOUT'
    | 'TEMPORARY_STORAGE_ERROR'
    | 'UNKNOWN_ERROR';
  message: string;
};

export type TranscriptionResponse = TranscriptionSuccess | TranscriptionFailure;

export type PipelineStatus = {
  ffmpegFound: boolean;
  whisperCliFound: boolean;
  modelFound: boolean;
  model: 'large-v3-turbo';
  language: 'ro';
};
