import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPipelineStatus } from './config.mjs';
import { convertRecording, processRecording } from './pipeline.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function mapErrorMessage(error) {
  if (!error || typeof error !== 'object') {
    return 'Transcrierea locală a eșuat.';
  }

  return error.message || 'Transcrierea locală a eșuat.';
}

app.whenReady().then(() => {
  ipcMain.handle('echo-report:get-pipeline-status', async () => getPipelineStatus());

  ipcMain.handle('echo-report:convert-audio', async (_event, payload) => {
    try {
      const { audioBytes, mimeType } = payload;
      if (!audioBytes || typeof mimeType !== 'string') {
        throw new Error('Date audio invalide.');
      }

      return await convertRecording(audioBytes, mimeType);
    } catch (error) {
      console.error('[Echo Report] Conversion error:', error);
      throw new Error(mapErrorMessage(error));
    }
  });

  ipcMain.handle('echo-report:process-recording', async (_event, payload) => {
    try {
      const { audioBytes, mimeType } = payload;
      if (!audioBytes || typeof mimeType !== 'string') {
        throw new Error('Date audio invalide.');
      }

      return await processRecording(audioBytes, mimeType);
    } catch (error) {
      console.error('[Echo Report] Pipeline error:', error);
      throw new Error(mapErrorMessage(error));
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
