import type { EchoReport } from '../types/echoReport';
import './ReportPreview.css';

type ReportPreviewProps = {
  report: EchoReport;
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

function Row({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const unitIsValid = unit === undefined || isNumericValue(value);

  return (
    <div className="rp-row" aria-invalid={unit !== undefined && !unitIsValid}>
      <span className="rp-row__label">{label}:</span>
      <span className="rp-row__value">
        {unitIsValid ? value : ''}{unitIsValid && unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

export function ReportPreview({ report }: ReportPreviewProps) {
  const { patient, measurements: m, conclusions } = report;
  const patientName = [patient.lastName, patient.firstName].filter(Boolean).join(' ');

  return (
    <div id="printable-report" className="printable-report">
      <article className="rp-sheet" aria-label="Previzualizare raport ecocardiografie">
        <header className="rp-clinic-header">
          <div className="rp-clinic-header__top">
            <strong>CMI DR. CURTA ASINETA</strong>
            <Row label="Nr. curent" value={patient.currentNumber} />
            <Row label="Data" value={formatDate(patient.examinationDate)} />
          </div>
          <span>Str. Vișinului nr. 47, Arad</span>
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
            <Row label="VS - diametrul telediastolic" value={m.lvEndDiastolicDiameter} unit="cm" />
            <Row label="VS - diametrul telesistolic" value={m.lvEndSystolicDiameter} unit="cm" />
            <Row label="SIV - diam. diastolic" value={m.ivsDiastolicDiameter} unit="cm" />
            <Row label="Perete posterior - diam. diastolic" value={m.posteriorWallDiastolicDiameter} unit="cm" />
            <Row label="Fracție de ejecție VS (Teicholtz)" value={m.lvEjectionFractionTeicholz} unit="%" />
            <Row label="Fracție de scurtare" value={m.shorteningFraction} unit="%" />
            <Row label="Masa VS" value={m.lvMass} unit="g/m²" />
          </div>
          <div className="rp-grid rp-grid--single">
            <Row label="Aorta la inel" value={m.aortaAnnulus} unit="cm" />
            <Row label="Aorta ascendentă" value={m.ascendingAorta} unit="cm" />
            <Row label="AS - diametrul antero-posterior" value={m.laAnteroposteriorDiameter} unit="cm" />
            <Row label="Aorta la nivelul crosei" value={m.aortaAtArch} unit="cm" />
            <Row label="Artera pulmonară" value={m.pulmonaryArtery} unit="cm" />
          </div>
        </div>
      </section>

      <section className="rp-section rp-section--m-echo">
        <h3 className="rp-section-title">APICAL 4C</h3>
        <div className="rp-apical-columns">
          <div className="rp-grid rp-grid--single">
            <Row label="VS - diametrul latero-median" value={m.lvLateromedialDiameter} unit="cm" />
            <Row label="VD - diametrul latero-median" value={m.rvLateromedialDiameter} unit="cm" />
            <Row label="AS - diametrul latero-median" value={m.laLateromedialDiameter} unit="cm" />
            <Row label="AD - diametrul latero-median" value={m.raLateromedialDiameter} unit="cm" />
            <div className="rp-inline-grid rp-inline-grid--two">
              <Row label="MAPSE" value={m.mapse} unit="mm" />
              <Row label="TAPSE" value={m.tapse} unit="mm" />
            </div>
          </div>
          <div className="rp-grid rp-grid--single">
            <Row label="Aria AS" value={m.laArea} unit="cm²" />
            <Row label="Aria AD" value={m.raArea} unit="cm²" />
            <Row label="Volum telediastolic VS" value={m.lvEndDiastolicVolume} unit="ml" />
            <Row label="Volum telesistolic VS" value={m.lvEndSystolicVolume} unit="ml" />
            <Row label="Fracție de ejecție (Simpson)" value={m.lvEjectionFractionSimpson} unit="%" />
          </div>
        </div>
        <div className="rp-grid rp-grid--single">
          <Row label="Cinetică parietală" value={m.wallMotion} />
          <Row label="Valve aortice" value={m.aorticValves} />
          <Row label="Valve mitrale" value={m.mitralValves} />
          <Row label="Valve tricuspide" value={m.tricuspidValves} />
          <Row label="Valve pulmonare" value={m.pulmonaryValves} />
        </div>
        <div className="rp-pericard">
          <Row label="Pericard: Lichid pericardic" value={m.pericardialFluid} />
        </div>
      </section>

      <h2 className="rp-group-title">ECHO DOPPLER</h2>

      <section className="rp-section rp-flux">
        <h3 className="rp-section-title">Flux aortic</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Row label="Vmax" value={m.aorticVmax} unit="cm/s" />
          <Row label="Pmax" value={m.aorticPmax} unit="mmHg" />
          <Row label="Pmediu" value={m.aorticPmean} unit="mmHg" />
        </div>
      </section>

      <section className="rp-section rp-flux rp-flux--spacious">
        <h3 className="rp-section-title">Flux LVOT</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Row label="Vmax" value={m.lvotVmax} unit="cm/s" />
          <Row label="Pmax" value={m.lvotPmax} unit="mmHg" />
          <Row label="VTI" value={m.lvotVti} unit="cm" />
        </div>
        <div className="rp-inline-grid rp-inline-grid--two">
          <Row label="Aria valvei aortice (EC)" value={m.aorticValveArea} unit="cm²" />
          <Row label="Regurgitare aortică" value={m.aorticRegurgitation} />
        </div>
      </section>

      <section className="rp-section rp-flux rp-flux--spacious">
        <h3 className="rp-section-title">Flux mitral</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Row label="Unda E" value={m.mitralE} unit="cm/s" />
          <Row label="Unda A" value={m.mitralA} unit="cm/s" />
          <Row label="E/A" value={m.mitralEaRatio} />
        </div>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Row label="TDE" value={m.mitralDecelerationTime} unit="msec" />
          <Row label="TRIV" value={m.mitralTriv} unit="msec" />
          <Row label="Aria valvei mitrale" value={m.mitralValveArea} unit="cm²" />
        </div>
        <div className="rp-grid rp-grid--single">
          <Row label="Regurgitare mitrală" value={m.mitralRegurgitation} />
        </div>
      </section>

      <section className="rp-section rp-flux rp-flux--spacious">
        <h3 className="rp-section-title">Flux tricuspidian</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Row label="Vmax" value={m.tricuspidVmax} unit="cm/s" />
          <Row label="Pmax" value={m.tricuspidPmax} unit="mmHg" />
          <Row label="PSVD" value={m.psvd} unit="mmHg" />
        </div>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Row label="Unda E" value={m.tricuspidE} unit="cm/s" />
          <Row label="Unda A" value={m.tricuspidA} unit="cm/s" />
          <Row label="E/A" value={m.tricuspidEaRatio} />
        </div>
        <div className="rp-grid rp-grid--single">
          <Row label="Regurgitare tricuspidiană" value={m.tricuspidRegurgitation} />
        </div>
      </section>

      <section className="rp-section rp-flux">
        <h3 className="rp-section-title">Flux pulmonar</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Row label="Vmax" value={m.pulmonaryVmax} unit="cm/s" />
          <Row label="Pmax" value={m.pulmonaryPmax} unit="mmHg" />
          <Row label="VTI" value={m.pulmonaryVti} unit="cm" />
          <Row label="Regurgitare pulmonară" value={m.pulmonaryRegurgitation} />
        </div>
      </section>

      <section className="rp-section rp-flux">
        <h3 className="rp-section-title">DOPPLER TISULAR (sept)</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Row label="Unda E'" value={m.septalEPrime} />
          <Row label="Unda A'" value={m.septalAPrime} unit="cm/s" />
          <Row label="E'/A'" value={m.septalEaPrimeRatio} />
          <Row label="E/E'" value={m.eePrimeRatio} />
          <Row label="Unda S" value={m.septalS} unit="cm/s" />
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
