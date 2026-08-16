import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipelineStatus } from './config.js';
import { IPC, type TranscriptionFailure, type TranscriptionResponse } from './shared.js';
import { transcribeAudio } from './transcription.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const devServerUrl = process.env.ECHOREPORT_DEV_SERVER_URL;

function isTrustedRendererUrl(url: string): boolean {
  return url.startsWith('file:') || (devServerUrl !== undefined && url.startsWith(devServerUrl));
}

function failure(errorCode: TranscriptionFailure['errorCode'], message: string): TranscriptionFailure {
  return { success: false, errorCode, message };
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      preload: path.join(currentDirectory, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(currentDirectory, '../dist/index.html'));
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.getPipelineStatus, (): ReturnType<typeof pipelineStatus> => pipelineStatus());

  ipcMain.handle(IPC.transcribeAudio, async (_event, payload: unknown): Promise<TranscriptionResponse> => {
    if (!payload || typeof payload !== 'object') {
      return failure('INVALID_AUDIO', 'Înregistrarea audio este invalidă.');
    }

    const { audioBytes, mimeType } = payload as { audioBytes?: unknown; mimeType?: unknown };
    if (!(audioBytes instanceof Uint8Array) || audioBytes.byteLength === 0 || audioBytes.byteLength > 256 * 1024 * 1024 || typeof mimeType !== 'string') {
      return failure('INVALID_AUDIO', 'Înregistrarea audio este invalidă.');
    }

    try {
      return await transcribeAudio(audioBytes, mimeType);
    } catch (error) {
      console.error('[Echo Report] Unexpected transcription error:', error);
      return failure('UNKNOWN_ERROR', 'Transcrierea locală a eșuat.');
    }
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'media' && isTrustedRendererUrl(webContents.getURL()));
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) =>
    permission === 'media' && webContents !== null && isTrustedRendererUrl(webContents.getURL()),
  );
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
