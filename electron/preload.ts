import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type PipelineStatus, type TranscriptionResponse } from './shared.js';

type SafeEchoReportApi = {
  readonly isAvailable: true;
  getPipelineStatus: () => Promise<PipelineStatus>;
  transcribeAudio: (audioBytes: Uint8Array, mimeType: string) => Promise<TranscriptionResponse>;
};

const echoReport: SafeEchoReportApi = {
  isAvailable: true,
  getPipelineStatus: () => ipcRenderer.invoke(IPC.getPipelineStatus),
  transcribeAudio: (audioBytes, mimeType) =>
    ipcRenderer.invoke(IPC.transcribeAudio, { audioBytes, mimeType }),
};

// Intentionally exposes only the two fixed IPC operations above. No Node.js,
// shell, process, filesystem, or generic command execution is reachable here.
contextBridge.exposeInMainWorld('echoReport', echoReport);
