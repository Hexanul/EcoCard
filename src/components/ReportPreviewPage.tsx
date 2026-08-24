import { useState } from 'react';
import { getEchoReportApi } from '../services/electronBridge';
import { ReportPreview } from './ReportPreview';
import type { EchoReport } from '../types/echoReport';

type ReportPreviewPageProps = {
  report: EchoReport;
  onBack: () => void;
};

type ExportStatus = 'idle' | 'generating' | 'success' | 'error';

export function ReportPreviewPage({ report, onBack }: ReportPreviewPageProps) {
  // Narrowly scoped preload bridge: the main process generates an A4 PDF via
  // webContents.printToPDF() and the native Windows Save As dialog. Nothing
  // happens without the doctor clicking "Exportă PDF".
  const pdfAvailable = getEchoReportApi() !== null;
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');

  const exporting = exportStatus === 'generating';

  const handleExportPdf = async () => {
    const api = getEchoReportApi();
    if (!api || exporting) return;

    setExportStatus('generating');
    try {
      const name = report.patient.name.trim();
      const result = await api.exportPdf(name.length > 0 ? name : undefined);
      if (result.success) {
        setExportStatus('success');
      } else if (result.errorCode === 'CANCELED') {
        // Cancelling the Save As dialog is a clean no-op, not an error.
        setExportStatus('idle');
      } else {
        console.error('[Echo Report] PDF export failed:', result.errorCode);
        setExportStatus('error');
      }
    } catch (error) {
      console.error('[Echo Report] PDF export failed:', error);
      setExportStatus('error');
    }
  };

  return (
    <div className="preview-page">
      <div className="preview-toolbar no-print">
        <button type="button" className="btn btn--secondary" onClick={onBack} disabled={exporting}>
          ← Înapoi
        </button>
        <p className="preview-toolbar__note">
          Raport ecocardiografie — previzualizare doar-citire a valorilor curente din formular.
          Verificați valorile înainte de export.
        </p>
        {exportStatus !== 'idle' && (
          <p className={`preview-toolbar__status preview-toolbar__status--${exportStatus}`} role="status">
            {exportStatus === 'generating' && 'Se generează PDF...'}
            {exportStatus === 'success' && 'PDF generat cu succes.'}
            {exportStatus === 'error' && 'Generarea PDF-ului a eșuat.'}
          </p>
        )}
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void handleExportPdf()}
          disabled={!pdfAvailable || exporting}
          title={pdfAvailable ? undefined : 'Exportul PDF este disponibil doar în aplicația desktop Electron.'}
        >
          {exporting ? 'Se generează...' : 'Exportă PDF'}
        </button>
      </div>
      <div className="preview-scroll">
        <ReportPreview report={report} />
      </div>
    </div>
  );
}
