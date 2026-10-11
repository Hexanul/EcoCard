import { useCallback, useState } from 'react';
import './App.css';
import { Header } from './components/Header';
import { PatientForm } from './components/PatientForm';
import { DictationPanel } from './components/DictationPanel';
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
import type { ParsedPatientInfo } from './services/medicalParser';
import {
  applyDictation,
  createReportForm,
  editField,
  getFollowingCurrentNumber,
  mergeParsedPatient,
  resolveNote,
  type DictatedField,
  type DictationChanges,
  type ReportForm,
} from './services/reportState';
import { findReportIssues, type Confirmations } from './utils/valueChecks';
import {
  createEmptyEchoReport,
  type EchoReport,
  type PatientInfo,
} from './types/echoReport';

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
  // The report plus the notes on uncertain dictated values (reportState.ts).
  const [form, setForm] = useState<ReportForm>(() => createReportForm(createReportWithCurrentNumber()));
  const { report, notes } = form;
  const [view, setView] = useState<'form' | 'preview'>('form');
  // Bumped on "Șterge formularul" to remount the dictation panel, so the
  // previous patient's transcript and recording are discarded with the form.
  const [dictationKey, setDictationKey] = useState(0);
  // Clinic header ("⚙ Setări"), set once per installation.
  const [clinic, setClinic] = useState<ClinicSettings>(loadClinicSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [about, setAbout] = useState<'accept' | 'about' | null>(() => (hasAcceptedTerms() ? null : 'accept'));
  // Unusual values the doctor confirmed (field id → value); a confirmation
  // lapses as soon as the value changes.
  const [confirmed, setConfirmed] = useState<Confirmations>({});
  // Set by a preview attempt blocked by impossible, unconfirmed or uncertain
  // dictated values; the list then updates live until every issue is resolved.
  const [showIssues, setShowIssues] = useState(false);
  const issues = showIssues ? findReportIssues(report, confirmed, notes) : [];

  const confirmValue = (id: string, value: string) => {
    setConfirmed((prev) => ({ ...prev, [id]: value }));
  };

  // "Confirmă" under a dictated field keeps the value: it confirms an unusual
  // value and settles the dictation note in one click.
  const confirmField = (field: DictatedField, value: string) => {
    confirmValue(field, value);
    setForm((prev) => resolveNote(prev, field));
  };

  const chooseValue = (field: DictatedField, value: string) => {
    setForm((prev) => resolveNote(prev, field, value));
  };

  const handlePreview = () => {
    if (findReportIssues(report, confirmed, notes).length > 0) {
      setShowIssues(true);
      return;
    }
    setShowIssues(false);
    setView('preview');
  };

  const updatePatient = (patient: PatientInfo) => {
    setForm((prev) => ({ ...prev, report: { ...prev.report, patient } }));
  };

  const updateField = (field: DictatedField, value: string) => {
    setForm((prev) => editField(prev, field, value));
  };

  // Stable callbacks: the dictation panel reports changes only when the
  // transcript changes, never because the form state changed.
  // Dictated values fill the form directly, like the patient data; uncertain
  // ones carry a note under their field until the doctor resolves it.
  const handleDictationChanged = useCallback((changes: DictationChanges) => {
    setForm((prev) => applyDictation(prev, changes));
  }, []);

  // Only explicitly spoken patient fields are touched and the BMI is recalculated.
  const handlePatientParsed = useCallback((parsed: ParsedPatientInfo) => {
    setForm((prev) => ({ ...prev, report: { ...prev.report, patient: mergeParsedPatient(prev.report.patient, parsed) } }));
  }, []);

  const handleClear = () => {
    setForm(createReportForm(createReportWithCurrentNumber()));
    setConfirmed({});
    setShowIssues(false);
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
    setForm(createReportForm(testReport));
    setConfirmed({});
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
          onDictationChanged={handleDictationChanged}
          onPatientParsed={handlePatientParsed}
        />
        <PatientForm
          patient={report.patient}
          onChange={updatePatient}
          confirmed={confirmed}
          onConfirm={confirmValue}
        />

        <section className="panel measurements-panel">
          {(['echo', 'doppler'] as const).map((group) => (
            <MeasurementGroup
              key={group}
              group={group}
              title={group === 'echo' ? 'M ECHO + 2D ECHO' : 'ECHO DOPPLER'}
              measurements={report.measurements}
              onChange={updateField}
              confirmed={confirmed}
              onConfirm={confirmField}
              notes={notes}
              onChooseValue={chooseValue}
            />
          ))}
        </section>

        <ConclusionsForm
          value={report.conclusions}
          onChange={(value) => updateField('conclusions', value)}
          note={notes.conclusions}
          onChooseValue={(value) => chooseValue('conclusions', value)}
          onConfirm={() => setForm((prev) => resolveNote(prev, 'conclusions'))}
        />

        <ReportActions onClear={handleClear} onPreview={handlePreview} issues={issues} />

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
