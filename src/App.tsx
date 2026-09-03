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
import { calculateDerivedMeasurements } from './utils/derivedMeasurements';

const DERIVED_MEASUREMENT_KEYS: MeasurementKey[] = [
  'mitralEaRatio',
  'tricuspidEaRatio',
  'septalEaPrimeRatio',
  'eePrimeRatio',
];

const CURRENT_NUMBER_STORAGE_KEY = 'ecocard-next-current-number';

function getNextCurrentNumber(): number {
  const stored = Number(window.localStorage.getItem(CURRENT_NUMBER_STORAGE_KEY));
  return Number.isInteger(stored) && stored > 0 ? stored : 1;
}

function getFollowingCurrentNumber(value: string): number | null {
  const currentNumber = Number(value.trim());
  return Number.isInteger(currentNumber) && currentNumber > 0 ? currentNumber + 1 : null;
}

function createReportWithCurrentNumber(): EchoReport {
  const report = createEmptyEchoReport();
  report.patient.currentNumber = String(getNextCurrentNumber());
  return report;
}

function addCalculatedMeasurements(
  parsedMeasurements: ParsedMeasurement[],
  existing: EchoReport['measurements'],
): ParsedMeasurement[] {
  const values = { ...existing };
  const parsedFields = new Set(parsedMeasurements.map((item) => item.field));
  for (const item of parsedMeasurements) {
    values[item.field] = item.value;
  }

  const calculated = calculateDerivedMeasurements(values);
  const detected = parsedMeasurements.filter(
    (item) => !DERIVED_MEASUREMENT_KEYS.includes(item.field),
  );
  const derivedDefinitions: Array<[
    MeasurementKey,
    string,
    string,
    MeasurementKey[],
  ]> = [
    ['mitralEaRatio', 'Flux mitral — E/A', 'Calculat automat: Undă E / Undă A', ['mitralE', 'mitralA']],
    ['tricuspidEaRatio', 'Flux tricuspidian — E/A', 'Calculat automat: Undă E / Undă A', ['tricuspidE', 'tricuspidA']],
    ["septalEaPrimeRatio", "Doppler tisular — E'/A'", "Calculat automat: Undă E' / Undă A'", ['septalEPrime', 'septalAPrime']],
    ['eePrimeRatio', "Doppler tisular — E/E'", "Calculat automat: Undă E mitrală / Undă E'", ['mitralE', 'septalEPrime']],
  ];

  for (const [field, label, sourceText, sourceFields] of derivedDefinitions) {
    if (sourceFields.some((sourceField) => parsedFields.has(sourceField)) && calculated[field] !== '') {
      detected.push({
        field,
        label,
        value: calculated[field],
        kind: 'numeric',
        confidence: 'high',
        sourceText,
      });
    }
  }

  return detected;
}

function App() {
  const [report, setReport] = useState<EchoReport>(createReportWithCurrentNumber);
  const [pendingMeasurements, setPendingMeasurements] = useState<ParsedMeasurement[]>([]);
  const [view, setView] = useState<'form' | 'preview'>('form');

  const updatePatient = (patient: PatientInfo) => {
    const nextCurrentNumber = getFollowingCurrentNumber(patient.currentNumber);
    if (nextCurrentNumber !== null) {
      window.localStorage.setItem(CURRENT_NUMBER_STORAGE_KEY, String(nextCurrentNumber));
    }
    setReport((prev) => ({ ...prev, patient }));
  };

  const updateMeasurement = (key: MeasurementKey, value: string) => {
    setReport((prev) => ({
      ...prev,
      measurements: calculateDerivedMeasurements({ ...prev.measurements, [key]: value }),
    }));
  };

  const updateConclusions = (conclusions: string) => {
    setReport((prev) => ({ ...prev, conclusions }));
  };

  const handleMeasurementsParsed = useCallback((data: ParsedEchoData) => {
    setPendingMeasurements(addCalculatedMeasurements(data.measurements, report.measurements));
  }, [report.measurements]);

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
      return { ...prev, measurements: calculateDerivedMeasurements(measurements) };
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
    setReport(createReportWithCurrentNumber());
  };

  const handlePdfExported = () => {
    const nextNumber = getFollowingCurrentNumber(report.patient.currentNumber) ?? getNextCurrentNumber();
    window.localStorage.setItem(CURRENT_NUMBER_STORAGE_KEY, String(nextNumber));
    setReport((prev) => ({
      ...prev,
      patient: { ...prev.patient, currentNumber: String(nextNumber) },
    }));
  };

  const handleGenerate = () => {
    // Placeholder — PDF generation will be implemented later
    console.log('Generează raport', report);
  };

  const handleLoadTestReport = () => {
    const testReport = createTestEchoReport();
    testReport.patient.currentNumber = String(getNextCurrentNumber());
    setReport(testReport);
  };

  // The read-only preview renders the same report state — no copy is made,
  // so it always reflects the current form values.
  if (view === 'preview') {
    return <ReportPreviewPage report={report} onBack={() => setView('form')} onExportSuccess={handlePdfExported} />;
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
