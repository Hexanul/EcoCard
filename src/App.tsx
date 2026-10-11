import { useCallback, useMemo, useState } from 'react';
import './App.css';
import { Header } from './components/Header';
import { PatientForm } from './components/PatientForm';
import { DictationPanel } from './components/DictationPanel';
import { MeasurementReview } from './components/MeasurementReview';
import { MeasurementGroup } from './components/MeasurementGroup';
import { ConclusionsForm } from './components/ConclusionsForm';
import { ReportActions } from './components/ReportActions';
import { ReportPreviewPage } from './components/ReportPreviewPage';
import { SettingsDialog } from './components/SettingsDialog';
import { AboutDialog } from './components/AboutDialog';
import { TERMS_ACCEPTED_STORAGE_KEY, TERMS_REVISION } from './config/appInfo';
import {
  CLINIC_SETTINGS_STORAGE_KEY,
  parseClinicSettings,
  type ClinicSettings,
} from './config/clinicSettings';
import { createTestEchoReport } from './dev/testReport';
import type {
  ParsedEchoData,
  ParsedDetectedItem,
  ParsedPatientInfo,
} from './services/medicalParser';
import {
  applyDetectedItems,
  buildDetectedItems,
  getFollowingCurrentNumber,
  mergeParsedPatient,
} from './services/reportState';
import {
  createEmptyEchoReport,
  type EchoReport,
  type MeasurementKey,
  type PatientInfo,
} from './types/echoReport';
import { calculateDerivedMeasurements } from './utils/derivedMeasurements';

const CURRENT_NUMBER_STORAGE_KEY = 'ecocard-next-current-number';

function getNextCurrentNumber(): number {
  const stored = Number(window.localStorage.getItem(CURRENT_NUMBER_STORAGE_KEY));
  return Number.isInteger(stored) && stored > 0 ? stored : 1;
}

function loadClinicSettings(): ClinicSettings {
  try {
    return parseClinicSettings(window.localStorage.getItem(CLINIC_SETTINGS_STORAGE_KEY));
  } catch {
    return parseClinicSettings(null);
  }
}

// The intended purpose and terms must be accepted once per terms revision.
function hasAcceptedTerms(): boolean {
  try {
    return window.localStorage.getItem(TERMS_ACCEPTED_STORAGE_KEY) === TERMS_REVISION;
  } catch {
    return false;
  }
}

function createReportWithCurrentNumber(): EchoReport {
  const report = createEmptyEchoReport();
  report.patient.currentNumber = String(getNextCurrentNumber());
  return report;
}

function App() {
  const [report, setReport] = useState<EchoReport>(createReportWithCurrentNumber);
  // The latest transcript parse awaiting review; null once applied or dismissed.
  const [pendingParse, setPendingParse] = useState<ParsedEchoData | null>(null);
  const [view, setView] = useState<'form' | 'preview'>('form');
  // Bumped on "Șterge formularul" to remount the dictation panel, so the
  // previous patient's transcript and recording are discarded with the form.
  const [dictationKey, setDictationKey] = useState(0);
  // Clinic header ("⚙ Setări"), set once per installation.
  const [clinic, setClinic] = useState<ClinicSettings>(loadClinicSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [about, setAbout] = useState<'accept' | 'about' | null>(() => (hasAcceptedTerms() ? null : 'accept'));

  const updatePatient = (patient: PatientInfo) => {
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

  // Stable callbacks: the dictation panel reports a parse only when the
  // transcript changes, never because the form state changed.
  const handleMeasurementsParsed = useCallback((data: ParsedEchoData) => {
    setPendingParse(data);
  }, []);

  // Dictated patient data fills the form directly (like conclusions); only
  // explicitly spoken fields are touched and the BMI is recalculated.
  const handlePatientParsed = useCallback((parsed: ParsedPatientInfo) => {
    setReport((prev) => ({ ...prev, patient: mergeParsedPatient(prev.patient, parsed) }));
  }, []);

  const pendingMeasurements = useMemo<ParsedDetectedItem[]>(
    () => (pendingParse ? buildDetectedItems(pendingParse, report.measurements) : []),
    [pendingParse, report.measurements],
  );

  // Only measurements explicitly approved in the review panel reach the form;
  // manually entered values are never overwritten silently.
  const handleApplyMeasurements = useCallback((selected: ParsedDetectedItem[]) => {
    if (selected.length === 0) {
      return;
    }
    setReport((prev) => applyDetectedItems(prev, selected));
    setPendingParse(null);
  }, []);

  const handleDismissReview = useCallback(() => {
    setPendingParse(null);
  }, []);

  // Remounts the review panel whenever a new transcript parse arrives, so
  // toggle state resets together with the detected measurement list.
  const reviewKey = pendingMeasurements
    .map((item) => `${item.field}|${item.value}|${item.confidence}`)
    .join('\n');

  const handleClear = () => {
    setReport(createReportWithCurrentNumber());
    setPendingParse(null);
    setDictationKey((key) => key + 1);
  };

  // The register number is consumed only by a successful export. The report
  // keeps its number, so re-exporting the same patient never skips one; the
  // next number is shown when a new report is started.
  const handlePdfExported = () => {
    const nextNumber = getFollowingCurrentNumber(report.patient.currentNumber);
    if (nextNumber !== null) {
      window.localStorage.setItem(CURRENT_NUMBER_STORAGE_KEY, String(nextNumber));
    }
  };

  const handleSaveClinic = (settings: ClinicSettings) => {
    try {
      window.localStorage.setItem(CLINIC_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('[Echo Report] Saving clinic settings failed:', error);
    }
    setClinic(settings);
    setSettingsOpen(false);
  };

  const handleAcceptTerms = () => {
    try {
      window.localStorage.setItem(TERMS_ACCEPTED_STORAGE_KEY, TERMS_REVISION);
    } catch (error) {
      console.error('[Echo Report] Saving terms acceptance failed:', error);
    }
    setAbout(null);
  };

  const handleLoadTestReport = () => {
    const testReport = createTestEchoReport();
    testReport.patient.currentNumber = String(getNextCurrentNumber());
    setReport(testReport);
  };

  // The read-only preview renders the same report state — no copy is made,
  // so it always reflects the current form values.
  // The form stays mounted (only hidden) while previewing, so the dictation
  // panel keeps its transcript and recording when the doctor comes back.
  return (
    <>
    {view === 'preview' && (
      <ReportPreviewPage report={report} clinic={clinic} onBack={() => setView('form')} onExportSuccess={handlePdfExported} />
    )}
    <div className="app" style={view === 'preview' ? { display: 'none' } : undefined}>
      <Header onOpenSettings={() => setSettingsOpen(true)} onOpenAbout={() => setAbout('about')} />
      {about && (
        <AboutDialog
          requireAcceptance={about === 'accept'}
          onAccept={handleAcceptTerms}
          onClose={() => setAbout(null)}
        />
      )}
      {settingsOpen && (
        <SettingsDialog clinic={clinic} onSave={handleSaveClinic} onClose={() => setSettingsOpen(false)} />
      )}

      <main className="app-main">
        <DictationPanel
          key={dictationKey}
          onMeasurementsParsed={handleMeasurementsParsed}
          onPatientParsed={handlePatientParsed}
        />
        <PatientForm patient={report.patient} onChange={updatePatient} />
        {pendingMeasurements.length > 0 && (
          <MeasurementReview
            key={reviewKey}
            measurements={report.measurements}
            conclusions={report.conclusions}
            parsedMeasurements={pendingMeasurements}
            onApply={handleApplyMeasurements}
            onDismiss={handleDismissReview}
          />
        )}

        <section className="panel measurements-panel">
          <MeasurementGroup
            group="echo"
            title="M ECHO + 2D ECHO"
            measurements={report.measurements}
            onChange={updateMeasurement}
          />
          <MeasurementGroup
            group="doppler"
            title="ECHO DOPPLER"
            measurements={report.measurements}
            onChange={updateMeasurement}
          />
        </section>

        <ConclusionsForm value={report.conclusions} onChange={updateConclusions} />

        <ReportActions
          onClear={handleClear}
          onPreview={() => setView('preview')}
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
    </>
  );
}

export default App;
