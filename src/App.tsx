import { useState } from 'react';
import './App.css';
import { Header } from './components/Header';
import { PatientForm } from './components/PatientForm';
import { DictationPanel } from './components/DictationPanel';
import { EchoMeasurements } from './components/EchoMeasurements';
import { DopplerMeasurements } from './components/DopplerMeasurements';
import { ReportActions } from './components/ReportActions';
import {
  createEmptyEchoReport,
  type EchoReport,
  type MeasurementKey,
  type PatientInfo,
} from './types/echoReport';

function App() {
  const [report, setReport] = useState<EchoReport>(createEmptyEchoReport);

  const updatePatient = (patient: PatientInfo) => {
    setReport((prev) => ({ ...prev, patient }));
  };

  const updateMeasurement = (key: MeasurementKey, value: string) => {
    setReport((prev) => ({
      ...prev,
      measurements: { ...prev.measurements, [key]: value },
    }));
  };

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
        <DictationPanel />

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
