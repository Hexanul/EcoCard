import { app, BrowserWindow, dialog, ipcMain, Menu, session, type IpcMainInvokeEvent } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { pipelineStatus } from './config.cjs';
import { exportReportPdf } from './pdf.cjs';
import { IPC, type ExportPdfResponse, type TranscriptionFailure, type TranscriptionResponse } from './shared.cjs';
import { abortActiveTranscriptions, removeStaleSessionDirectories, transcribeAudio } from './transcription.cjs';

// Set by scripts/dev.mjs only; a packaged app always loads its bundled page.
const devServerUrl = app.isPackaged ? undefined : process.env.ECHOREPORT_DEV_SERVER_URL;
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
// Every bridge call must come from the trusted app page.
const fromTrustedPage = (event: IpcMainInvokeEvent): boolean => !event.sender.isDestroyed() && isTrustedRendererUrl(event.sender.getURL());
const failure = (errorCode: TranscriptionFailure['errorCode'], message: string): TranscriptionFailure => ({ success: false, errorCode, message });

// The shipped app has no Reload, Developer Tools or Help links (Electron's
// default menu); editing and zoom shortcuts keep working. The menu bar is
// hidden and shown with Alt. Development keeps the default menu.
function setPackagedMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Editare', submenu: [
      { role: 'undo', label: 'Anulează' }, { role: 'redo', label: 'Refă' }, { type: 'separator' },
      { role: 'cut', label: 'Decupează' }, { role: 'copy', label: 'Copiază' }, { role: 'paste', label: 'Lipește' },
      { role: 'selectAll', label: 'Selectează tot' },
    ] },
    { label: 'Vizualizare', submenu: [
      { role: 'resetZoom', label: 'Mărime normală' }, { role: 'zoomIn', label: 'Mărește' }, { role: 'zoomOut', label: 'Micșorează' },
      { type: 'separator' }, { role: 'togglefullscreen', label: 'Ecran complet' },
    ] },
  ]));
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({ width: 1280, height: 900, autoHideMenuBar: app.isPackaged, webPreferences: {
    preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
    devTools: !app.isPackaged,
  } });
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`[Echo Report] Preload failed (${preloadPath}):`, error);
  });
  // The renderer cancels the unload (beforeunload in App.tsx) while the report
  // holds values or audio that were not exported; closing or reloading the
  // window then asks first. preventDefault here lets the unload go ahead.
  mainWindow.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      title: 'Raport Eco',
      message: 'Raportul nu a fost exportat în PDF.',
      detail: 'Dacă închideți acum, datele pacientului, valorile, concluziile și dictarea se pierd.',
      buttons: ['Închide fără export', 'Înapoi la raport'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    if (choice === 0) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!isTrustedRendererUrl(url)) event.preventDefault(); });
  if (devServerUrl) void mainWindow.loadURL(devServerUrl); else void mainWindow.loadFile(rendererIndexPath);
}

function registerIpc(): void {
  ipcMain.handle(IPC.getPipelineStatus, (event): ReturnType<typeof pipelineStatus> => {
    if (!fromTrustedPage(event)) throw new Error('Untrusted sender.');
    return pipelineStatus();
  });
  // Explicit doctor action only: generates an A4 PDF from the already-rendered
  // report preview and shows the native Windows Save As dialog. Cancelling
  // the dialog is a clean no-op; report data is never modified.
  ipcMain.handle(IPC.exportPdf, async (event, payload: unknown): Promise<ExportPdfResponse> => {
    const contents = event.sender;
    if (!fromTrustedPage(event)) return { success: false, errorCode: 'UNEXPECTED_ERROR', message: 'Fereastra nu este disponibilă.' };
    const suggestedName = payload && typeof payload === 'object' && typeof (payload as { suggestedName?: unknown }).suggestedName === 'string'
      ? (payload as { suggestedName: string }).suggestedName
      : undefined;
    try { return await exportReportPdf(contents, suggestedName); } catch (error) { console.error('[Echo Report] Unexpected PDF export error:', error); return { success: false, errorCode: 'UNEXPECTED_ERROR', message: 'Generarea PDF-ului a eșuat.' }; }
  });
  ipcMain.handle(IPC.transcribeAudio, async (event, payload: unknown): Promise<TranscriptionResponse> => {
    if (!fromTrustedPage(event)) return failure('UNTRUSTED_SENDER', 'Fereastra nu este disponibilă.');
    if (!payload || typeof payload !== 'object') return failure('INVALID_AUDIO', 'Înregistrarea audio este invalidă.');
    const { audioBytes, mimeType } = payload as { audioBytes?: unknown; mimeType?: unknown };
    if (!(audioBytes instanceof Uint8Array) || audioBytes.byteLength === 0 || audioBytes.byteLength > 256 * 1024 * 1024 || typeof mimeType !== 'string') return failure('INVALID_AUDIO', 'Înregistrarea audio este invalidă.');
    try { return await transcribeAudio(audioBytes, mimeType); } catch (error) { console.error('[Echo Report] Unexpected transcription error:', error); return failure('UNKNOWN_ERROR', 'Transcrierea locală a eșuat.'); }
  });
}

// One window at a time: starting the app again (installed or portable)
// brings the open one to the front instead of a second window that would hand
// out the same register number.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows();
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });
  app.whenReady().then(() => {
    void removeStaleSessionDirectories();
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => callback(permission === 'media' && isTrustedRendererUrl(webContents.getURL())));
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => permission === 'media' && webContents !== null && isTrustedRendererUrl(webContents.getURL()));
    if (app.isPackaged) setPackagedMenu();
    registerIpc(); createWindow();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', abortActiveTranscriptions);
}
