import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { pipelineStatus } from './config.cjs';
import { exportReportPdf } from './pdf.cjs';
import { IPC, type ExportPdfResponse, type TranscriptionFailure, type TranscriptionResponse } from './shared.cjs';
import { transcribeAudio } from './transcription.cjs';

const devServerUrl = process.env.ECHOREPORT_DEV_SERVER_URL;
const rendererIndexPath = path.join(__dirname, '../dist/index.html');
const rendererFileUrl = pathToFileURL(rendererIndexPath).href;
// Only the bundled index.html (or the Vite dev server origin) is trusted; any
// other file:// page, e.g. an HTML file dropped onto the window, is not.
const isTrustedRendererUrl = (url: string): boolean => {
  if (devServerUrl !== undefined) {
    try { return new URL(url).origin === new URL(devServerUrl).origin; } catch { return false; }
  }
  return url.split(/[?#]/)[0] === rendererFileUrl;
};
const failure = (errorCode: TranscriptionFailure['errorCode'], message: string): TranscriptionFailure => ({ success: false, errorCode, message });

function createWindow(): void {
  const mainWindow = new BrowserWindow({ width: 1280, height: 900, webPreferences: {
    preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
  } });
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[Echo Report] Preload failed (${preloadPath}):`, error);
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!isTrustedRendererUrl(url)) event.preventDefault(); });
  if (devServerUrl) void mainWindow.loadURL(devServerUrl); else void mainWindow.loadFile(rendererIndexPath);
}

function registerIpc(): void {
  ipcMain.handle(IPC.getPipelineStatus, (): ReturnType<typeof pipelineStatus> => pipelineStatus());
  // Explicit doctor action only: generates an A4 PDF from the already-rendered
  // report preview and shows the native Windows Save As dialog. Cancelling
  // the dialog is a clean no-op; report data is never modified.
  ipcMain.handle(IPC.exportPdf, async (event, payload: unknown): Promise<ExportPdfResponse> => {
    const contents = event.sender;
    if (contents.isDestroyed() || !isTrustedRendererUrl(contents.getURL())) return { success: false, errorCode: 'UNEXPECTED_ERROR', message: 'Fereastra nu este disponibilă.' };
    const suggestedName = payload && typeof payload === 'object' && typeof (payload as { suggestedName?: unknown }).suggestedName === 'string'
      ? (payload as { suggestedName: string }).suggestedName
      : undefined;
    try { return await exportReportPdf(contents, suggestedName); } catch (error) { console.error('[Echo Report] Unexpected PDF export error:', error); return { success: false, errorCode: 'UNEXPECTED_ERROR', message: 'Generarea PDF-ului a eșuat.' }; }
  });
  ipcMain.handle(IPC.transcribeAudio, async (_event, payload: unknown): Promise<TranscriptionResponse> => {
    if (!payload || typeof payload !== 'object') return failure('INVALID_AUDIO', 'Înregistrarea audio este invalidă.');
    const { audioBytes, mimeType } = payload as { audioBytes?: unknown; mimeType?: unknown };
    if (!(audioBytes instanceof Uint8Array) || audioBytes.byteLength === 0 || audioBytes.byteLength > 256 * 1024 * 1024 || typeof mimeType !== 'string') return failure('INVALID_AUDIO', 'Înregistrarea audio este invalidă.');
    try { return await transcribeAudio(audioBytes, mimeType); } catch (error) { console.error('[Echo Report] Unexpected transcription error:', error); return failure('UNKNOWN_ERROR', 'Transcrierea locală a eșuat.'); }
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => callback(permission === 'media' && isTrustedRendererUrl(webContents.getURL())));
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => permission === 'media' && webContents !== null && isTrustedRendererUrl(webContents.getURL()));
  registerIpc(); createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
