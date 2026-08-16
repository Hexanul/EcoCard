import { contextBridge, ipcRenderer } from 'electron';

/**
 * Safe Electron IPC bridge exposed to the React renderer.
 * The renderer cannot execute shell commands or choose binary paths.
 */
contextBridge.exposeInMainWorld('echoReport', {
  isAvailable: true,

  getPipelineStatus: () => ipcRenderer.invoke('echo-report:get-pipeline-status'),

  convertAudio: (audioBytes, mimeType) =>
    ipcRenderer.invoke('echo-report:convert-audio', { audioBytes, mimeType }),

  processRecording: (audioBytes, mimeType) =>
    ipcRenderer.invoke('echo-report:process-recording', { audioBytes, mimeType }),
});
