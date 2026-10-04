import type { ClinicSettings } from '../config/clinicSettings';
import { MEASUREMENT_FIELDS } from '../config/measurementFields';
import type { EchoReport, MeasurementKey, Measurements } from '../types/echoReport';
import './ReportPreview.css';

type ReportPreviewProps = {
  report: EchoReport;
  clinic: ClinicSettings;
};

// ISO dates (yyyy-mm-dd) are shown in the Romanian report format (dd.mm.yyyy).
// Any other stored value is printed exactly as entered — nothing is invented.
function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function isNumericValue(value: string): boolean {
  const normalized = value.trim().replace(',', '.');
  return normalized.length > 0 && Number.isFinite(Number(normalized));
}

// Every entered value is printed as typed; the unit is appended only to plain
// numbers so that ranges ("55-60") or annotated values never get a wrong unit.
function Row({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const showUnit = unit !== undefined && isNumericValue(value);

  return (
    <div className="rp-row">
      <span className="rp-row__label">{label}:</span>
      <span className="rp-row__value">
        {value}{showUnit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

// Measurement row: label and unit come from the field registry.
function Field({ k, m }: { k: MeasurementKey; m: Measurements }) {
  const field = MEASUREMENT_FIELDS[k];
  return <Row label={field.reportLabel} value={m[k]} unit={field.unit} />;
}

export function ReportPreview({ report, clinic }: ReportPreviewProps) {
  const { patient, measurements: m, conclusions } = report;
  const patientName = [patient.lastName, patient.firstName].filter(Boolean).join(' ');

  return (
    <div id="printable-report" className="printable-report">
      <article className="rp-sheet" aria-label="Previzualizare raport ecocardiografie">
        <header className="rp-clinic-header">
          <div className="rp-clinic-header__top">
            <strong>{clinic.name}</strong>
            <Row label="Nr. curent" value={patient.currentNumber} />
            <Row label="Data" value={formatDate(patient.examinationDate)} />
          </div>
          {clinic.address && <span>{clinic.address}</span>}
        </header>

        <div className="rp-document-meta">
          <h1 className="rp-title">ECOCARDIOGRAFIE</h1>
        </div>

      <div className="rp-patient">
        <div className="rp-patient__row">
          <Row label="Nume și Prenume" value={patientName} />
          <Row label="Vârstă" value={patient.age} unit="ani" />
        </div>
        <div className="rp-patient__row rp-patient__row--three">
          <Row label="Greutate" value={patient.weight} unit="kg" />
          <Row label="Înălțime" value={patient.height} unit="cm" />
          <Row label="IMC" value={patient.bmi} unit="kg/m²" />
        </div>
      </div>

      <h2 className="rp-group-title">M ECHO + 2D ECHO</h2>

      <section className="rp-section rp-section--m-echo">
        <h3 className="rp-section-title">SECȚIUNE LONGITUDINALĂ PARASTERNALĂ</h3>
        <div className="rp-parasternal-columns">
          <div className="rp-grid rp-grid--single">
            <Field k="lvEndDiastolicDiameter" m={m} />
            <Field k="lvEndSystolicDiameter" m={m} />
            <Field k="ivsDiastolicDiameter" m={m} />
            <Field k="posteriorWallDiastolicDiameter" m={m} />
            <Field k="lvEjectionFractionTeicholz" m={m} />
            <Field k="shorteningFraction" m={m} />
            <Field k="lvMass" m={m} />
          </div>
          <div className="rp-grid rp-grid--single">
            <Field k="aortaAnnulus" m={m} />
            <Field k="ascendingAorta" m={m} />
            <Field k="laAnteroposteriorDiameter" m={m} />
            <Field k="aortaAtArch" m={m} />
            <Field k="pulmonaryArtery" m={m} />
          </div>
        </div>
      </section>

      <section className="rp-section rp-section--m-echo">
        <h3 className="rp-section-title">APICAL 4C</h3>
        <div className="rp-apical-columns">
          <div className="rp-grid rp-grid--single">
            <Field k="lvLateromedialDiameter" m={m} />
            <Field k="rvLateromedialDiameter" m={m} />
            <Field k="laLateromedialDiameter" m={m} />
            <Field k="raLateromedialDiameter" m={m} />
            <div className="rp-inline-grid rp-inline-grid--two">
              <Field k="mapse" m={m} />
              <Field k="tapse" m={m} />
            </div>
          </div>
          <div className="rp-grid rp-grid--single">
            <Field k="laArea" m={m} />
            <Field k="raArea" m={m} />
            <Field k="lvEndDiastolicVolume" m={m} />
            <Field k="lvEndSystolicVolume" m={m} />
            <Field k="lvEjectionFractionSimpson" m={m} />
          </div>
        </div>
        <div className="rp-grid rp-grid--single">
          <Field k="wallMotion" m={m} />
          <Field k="aorticValves" m={m} />
          <Field k="mitralValves" m={m} />
          <Field k="tricuspidValves" m={m} />
          <Field k="pulmonaryValves" m={m} />
        </div>
        <div className="rp-pericard">
          <Field k="pericardialFluid" m={m} />
        </div>
      </section>

      <h2 className="rp-group-title">ECHO DOPPLER</h2>

      <section className="rp-section rp-flux">
        <h3 className="rp-section-title">Flux aortic</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Field k="aorticVmax" m={m} />
          <Field k="aorticPmax" m={m} />
          <Field k="aorticPmean" m={m} />
        </div>
      </section>

      <section className="rp-section rp-flux rp-flux--spacious">
        <h3 className="rp-section-title">Flux LVOT</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Field k="lvotVmax" m={m} />
          <Field k="lvotPmax" m={m} />
          <Field k="lvotVti" m={m} />
        </div>
        <div className="rp-inline-grid rp-inline-grid--two">
          <Field k="aorticValveArea" m={m} />
          <Field k="aorticRegurgitation" m={m} />
        </div>
      </section>

      <section className="rp-section rp-flux rp-flux--spacious">
        <h3 className="rp-section-title">Flux mitral</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Field k="mitralE" m={m} />
          <Field k="mitralA" m={m} />
          <Field k="mitralEaRatio" m={m} />
        </div>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Field k="mitralDecelerationTime" m={m} />
          <Field k="mitralTriv" m={m} />
          <Field k="mitralValveArea" m={m} />
        </div>
        <div className="rp-grid rp-grid--single">
          <Field k="mitralRegurgitation" m={m} />
        </div>
      </section>

      <section className="rp-section rp-flux rp-flux--spacious">
        <h3 className="rp-section-title">Flux tricuspidian</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Field k="tricuspidVmax" m={m} />
          <Field k="tricuspidPmax" m={m} />
          <Field k="psvd" m={m} />
        </div>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Field k="tricuspidE" m={m} />
          <Field k="tricuspidA" m={m} />
          <Field k="tricuspidEaRatio" m={m} />
        </div>
        <div className="rp-grid rp-grid--single">
          <Field k="tricuspidRegurgitation" m={m} />
        </div>
      </section>

      <section className="rp-section rp-flux">
        <h3 className="rp-section-title">Flux pulmonar</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Field k="pulmonaryVmax" m={m} />
          <Field k="pulmonaryPmax" m={m} />
          <Field k="pulmonaryVti" m={m} />
          <Field k="pulmonaryRegurgitation" m={m} />
        </div>
      </section>

      <section className="rp-section rp-flux">
        <h3 className="rp-section-title">DOPPLER TISULAR (sept)</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Field k="septalEPrime" m={m} />
          <Field k="septalAPrime" m={m} />
          <Field k="septalEaPrimeRatio" m={m} />
          <Field k="eePrimeRatio" m={m} />
          <Field k="septalS" m={m} />
        </div>
      </section>

      <section className="rp-section rp-conclusions-section">
        <h2 className="rp-group-title">CONCLUZII</h2>
        <div className="rp-conclusions">{conclusions}</div>
      </section>
    </article>
    </div>
  );
}
