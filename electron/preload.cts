import { contextBridge, ipcRenderer } from 'electron';

// Sandboxed Electron preloads may only require Electron's limited built-ins.
// Keep the bridge self-contained: no local Node/CommonJS imports are allowed.
const IPC = {
  getPipelineStatus: 'echo-report:get-pipeline-status',
  transcribeAudio: 'echo-report:transcribe-audio',
} as const;

type PipelineStatus = {
  ffmpegFound: boolean;
  whisperCliFound: boolean;
  modelFound: boolean;
  model: 'large-v3-turbo';
  language: 'ro';
};

type TranscriptionResponse =
  | { success: true; transcript: string; original: unknown; converted: unknown }
  | { success: false; errorCode: string; message: string };

type SafeEchoReportApi = {
  readonly isAvailable: true;
  getPipelineStatus: () => Promise<PipelineStatus>;
  transcribeAudio: (audioBytes: Uint8Array, mimeType: string) => Promise<TranscriptionResponse>;
};

const echoReport: SafeEchoReportApi = {
  isAvailable: true,
  getPipelineStatus: () => ipcRenderer.invoke(IPC.getPipelineStatus),
  transcribeAudio: (audioBytes, mimeType) => ipcRenderer.invoke(IPC.transcribeAudio, { audioBytes, mimeType }),
};

contextBridge.exposeInMainWorld('echoReport', echoReport);
