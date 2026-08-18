import { useCallback, useState } from 'react';
import './App.css';
import { Header } from './components/Header';
import { PatientForm } from './components/PatientForm';
import { DictationPanel } from './components/DictationPanel';
import { MeasurementReview } from './components/MeasurementReview';
import { EchoMeasurements } from './components/EchoMeasurements';
import { DopplerMeasurements } from './components/DopplerMeasurements';
import { ReportActions } from './components/ReportActions';
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

  const updatePatient = (patient: PatientInfo) => {
    setReport((prev) => ({ ...prev, patient }));
  };

  const updateMeasurement = (key: MeasurementKey, value: string) => {
    setReport((prev) => ({
      ...prev,
      measurements: { ...prev.measurements, [key]: value },
    }));
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

        <ReportActions onClear={handleClear} onGenerate={handleGenerate} />
      </main>
    </div>
  );
}

export default App;
