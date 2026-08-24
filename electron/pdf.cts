import { BrowserWindow, dialog, shell, type WebContents } from 'electron';
import { promises as fs } from 'node:fs';
import type { ExportPdfErrorCode, ExportPdfResponse } from './shared.cjs';

// PDF export for the echocardiography report. Everything runs in the main
// process against the already-rendered preview page; nothing is sent over
// the network and no patient data is ever written to the log.

const MAX_READINESS_ATTEMPTS = 10;
const READINESS_RETRY_DELAY_MS = 150;

type ReportReadiness = {
  ready: boolean;
  reason?: string;
  readyState?: string;
  width?: number;
  height?: number;
  scrollWidth?: number;
  scrollHeight?: number;
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const fail = (errorCode: ExportPdfErrorCode, message: string): ExportPdfResponse => ({ success: false, errorCode, message });

// Windows-invalid filename characters (< > : " / \ | ? *) and control
// characters are stripped. Patient data stays local — it is only used to
// build the suggested file name, never logged.
function buildPdfFileName(patientName: string | undefined): string {
  const fallback = 'ecocardiografie.pdf';
  if (!patientName) return fallback;
  const cleaned = patientName
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '');
  if (cleaned.length === 0) return fallback;
  return `Ecocardiografie_${cleaned.slice(0, 120)}.pdf`;
}

function ensurePdfExtension(filePath: string): string {
  return filePath.toLocaleLowerCase().endsWith('.pdf') ? filePath : `${filePath}.pdf`;
}

// Waits for the report DOM to be fully laid out: fonts settled, document
// complete, #printable-report present with real dimensions. The check runs
// inside the renderer and returns only technical layout numbers.
async function checkReadiness(contents: WebContents): Promise<ReportReadiness> {
  try {
    const result = await contents.executeJavaScript(
      `(async () => {
        try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { /* fonts check optional */ }
        const report = document.getElementById('printable-report');
        if (!report) return { ready: false, reason: 'REPORT_NOT_FOUND' };
        const rect = report.getBoundingClientRect();
        return {
          ready: document.readyState === 'complete'
            && rect.width > 0 && rect.height > 0
            && document.documentElement.scrollWidth > 0
            && document.documentElement.scrollHeight > 0,
          readyState: document.readyState,
          width: rect.width,
          height: rect.height,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
        };
      })()`,
      true,
    );
    if (!result || typeof result !== 'object') return { ready: false, reason: 'READINESS_CHECK_FAILED' };
    return result as ReportReadiness;
  } catch {
    return { ready: false, reason: 'READINESS_CHECK_FAILED' };
  }
}

async function waitForReport(contents: WebContents): Promise<ReportReadiness> {
  let readiness = await checkReadiness(contents);
  for (let attempt = 1; !readiness.ready && attempt < MAX_READINESS_ATTEMPTS; attempt++) {
    await sleep(READINESS_RETRY_DELAY_MS);
    readiness = await checkReadiness(contents);
  }
  return readiness;
}

export async function exportReportPdf(contents: WebContents, suggestedName?: string): Promise<ExportPdfResponse> {
  console.log('[Echo Report] PDF generation started');

  if (contents.isDestroyed()) return fail('UNEXPECTED_ERROR', 'Fereastra nu mai este disponibilă.');

  // 1. The report must be fully rendered before printToPDF is called.
  const readiness = await waitForReport(contents);
  console.log('[Echo Report] PDF readiness:', `width=${readiness.width ?? 0}`, `height=${readiness.height ?? 0}`, `scrollWidth=${readiness.scrollWidth ?? 0}`, `scrollHeight=${readiness.scrollHeight ?? 0}`, `readyState=${readiness.readyState ?? 'unknown'}`);
  if (!readiness.ready) {
    console.error('[Echo Report] Report not ready for PDF:', readiness.reason ?? 'DIMENSIONS_EMPTY');
    return fail('REPORT_NOT_READY_FOR_PDF', 'Raportul nu este gata pentru export. Reîncercați.');
  }

  // 2. Native Windows Save As dialog. Cancelling is a clean no-op.
  const window = BrowserWindow.fromWebContents(contents);
  const saveOptions = {
    title: 'Exportă raport PDF',
    defaultPath: buildPdfFileName(suggestedName),
    filters: [{ name: 'Document PDF', extensions: ['pdf'] }],
  };
  const saveResult = window ? await dialog.showSaveDialog(window, saveOptions) : await dialog.showSaveDialog(saveOptions);
  if (saveResult.canceled || !saveResult.filePath) return fail('CANCELED', '');

  // 3. A4 portrait PDF via Chromium — vector text, not rasterized.
  let pdfData: Uint8Array;
  try {
    pdfData = await contents.printToPDF({
      landscape: false,
      printBackground: true,
      pageSize: 'A4',
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
  } catch (error) {
    console.error('[Echo Report] PDF generation failed:', error instanceof Error ? error.message : 'unknown');
    return fail('PDF_GENERATION_FAILED', 'Generarea PDF-ului a eșuat.');
  }
  if (pdfData.byteLength === 0) {
    console.error('[Echo Report] PDF generation failed: empty result');
    return fail('PDF_GENERATION_FAILED', 'Generarea PDF-ului a eșuat.');
  }

  // 4. Write the file locally.
  try {
    await fs.writeFile(ensurePdfExtension(saveResult.filePath), Buffer.from(pdfData));
  } catch (error) {
    console.error('[Echo Report] PDF save failed:', error instanceof Error ? error.message : 'unknown');
    return fail('PDF_SAVE_FAILED', 'Salvarea fișierului PDF a eșuat.');
  }
  console.log('[Echo Report] PDF generation completed');

  // 5. Best effort: open with the default Windows PDF application. A failure
  // here never fails the export — the file is already saved.
  try {
    const openError = await shell.openPath(ensurePdfExtension(saveResult.filePath));
    if (openError) console.error('[Echo Report] PDF open failed');
  } catch {
    console.error('[Echo Report] PDF open failed');
  }

  return { success: true };
}
