import { useCallback, useState } from 'react';
import './App.css';
import { Header } from './components/Header';
import { PatientForm } from './components/PatientForm';
import { DictationPanel } from './components/DictationPanel';
import { MeasurementReview } from './components/MeasurementReview';
import { EchoMeasurements } from './components/EchoMeasurements';
import { DopplerMeasurements } from './components/DopplerMeasurements';
import { ConclusionsForm } from './components/ConclusionsForm';
import { ReportActions } from './components/ReportActions';
import { ReportPreviewPage } from './components/ReportPreviewPage';
import { createTestEchoReport } from './dev/testReport';
import type { ParsedEchoData, ParsedMeasurement } from './services/medicalParser';
import {
  createEmptyEchoReport,
  type EchoReport,
  type MeasurementKey,
  type PatientInfo,
} from './types/echoReport';

function App() {
  const [report, setReport] = useState<EchoReport>(createEmptyEchoReport);
  const [pendingMeasurements, setPendingMeasurements] = useState<ParsedMeasurement[]>([]);
  const [view, setView] = useState<'form' | 'preview'>('form');

  const updatePatient = (patient: PatientInfo) => {
    setReport((prev) => ({ ...prev, patient }));
  };

  const updateMeasurement = (key: MeasurementKey, value: string) => {
    setReport((prev) => ({
      ...prev,
      measurements: { ...prev.measurements, [key]: value },
    }));
  };

  const updateConclusions = (conclusions: string) => {
    setReport((prev) => ({ ...prev, conclusions }));
  };

  const handleMeasurementsParsed = useCallback((data: ParsedEchoData) => {
    setPendingMeasurements(data.measurements);
  }, []);

  // Only measurements explicitly approved in the review panel reach the form;
  // manually entered values are never overwritten silently.
  const handleApplyMeasurements = useCallback((selected: ParsedMeasurement[]) => {
    if (selected.length === 0) {
      return;
    }
    setReport((prev) => {
      const measurements = { ...prev.measurements };
      for (const item of selected) {
        measurements[item.field] = item.value;
      }
      return { ...prev, measurements };
    });
    setPendingMeasurements([]);
  }, []);

  const handleDismissReview = useCallback(() => {
    setPendingMeasurements([]);
  }, []);

  // Remounts the review panel whenever a new transcript parse arrives, so
  // toggle state resets together with the detected measurement list.
  const reviewKey = pendingMeasurements
    .map((item) => `${item.field}|${item.value}|${item.confidence}`)
    .join('\n');

  const handleClear = () => {
    setReport(createEmptyEchoReport());
  };

  const handleGenerate = () => {
    // Placeholder — PDF generation will be implemented later
    console.log('Generează raport', report);
  };

  const handleLoadTestReport = () => {
    setReport(createTestEchoReport());
  };

  // The read-only preview renders the same report state — no copy is made,
  // so it always reflects the current form values.
  if (view === 'preview') {
    return <ReportPreviewPage report={report} onBack={() => setView('form')} />;
  }

  return (
    <div className="app">
      <Header />

      <main className="app-main">
        <PatientForm patient={report.patient} onChange={updatePatient} />
        <DictationPanel onMeasurementsParsed={handleMeasurementsParsed} />
        {pendingMeasurements.length > 0 && (
          <MeasurementReview
            key={reviewKey}
            measurements={report.measurements}
            parsedMeasurements={pendingMeasurements}
            onApply={handleApplyMeasurements}
            onDismiss={handleDismissReview}
          />
        )}

        <section className="panel measurements-panel">
          <EchoMeasurements
            measurements={report.measurements}
            onChange={updateMeasurement}
          />
          <DopplerMeasurements
            measurements={report.measurements}
            onChange={updateMeasurement}
          />
        </section>

        <ConclusionsForm value={report.conclusions} onChange={updateConclusions} />

        <ReportActions
          onClear={handleClear}
          onPreview={() => setView('preview')}
          onGenerate={handleGenerate}
        />

        {import.meta.env.DEV && (
          <div className="dev-actions">
            <button type="button" className="btn btn--secondary" onClick={handleLoadTestReport}>
              Date test (dev)
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
