import { contextBridge, ipcRenderer } from 'electron';
// Type-only import: erased at compile time, so the sandboxed preload still
// requires nothing but Electron's built-ins at runtime.
import type { ExportPdfResponse, PipelineStatus, TranscriptionResponse } from './shared.cjs';

// Sandboxed Electron preloads may only require Electron's limited built-ins.
// Keep the bridge self-contained: no local Node/CommonJS runtime imports are
// allowed, which is why the channel names are repeated from shared.cts.
const IPC = {
  getPipelineStatus: 'echo-report:get-pipeline-status',
  transcribeAudio: 'echo-report:transcribe-audio',
  exportPdf: 'echo-report:export-pdf',
} as const;

type SafeEchoReportApi = {
  readonly isAvailable: true;
  getPipelineStatus: () => Promise<PipelineStatus>;
  transcribeAudio: (audioBytes: Uint8Array, mimeType: string) => Promise<TranscriptionResponse>;
  // Generates an A4 PDF of the rendered report via the main process and the
  // native Windows Save As dialog. No data leaves the machine.
  exportPdf: (suggestedName?: string) => Promise<ExportPdfResponse>;
};

const echoReport: SafeEchoReportApi = {
  isAvailable: true,
  getPipelineStatus: () => ipcRenderer.invoke(IPC.getPipelineStatus),
  transcribeAudio: (audioBytes, mimeType) => ipcRenderer.invoke(IPC.transcribeAudio, { audioBytes, mimeType }),
  exportPdf: (suggestedName) => ipcRenderer.invoke(IPC.exportPdf, { suggestedName }),
};

contextBridge.exposeInMainWorld('echoReport', echoReport);
