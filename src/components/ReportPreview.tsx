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

function Row({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rp-row">
      <span className="rp-row__label">{label}:</span>
      <span className="rp-row__value">{value}</span>
      {unit && <span className="rp-row__unit">{unit}</span>}
    </div>
  );
}

export function ReportPreview({ report }: ReportPreviewProps) {
  const { patient, measurements: m, conclusions } = report;

  return (
    <div id="printable-report" className="printable-report">
      <article className="rp-sheet" aria-label="Previzualizare raport ecocardiografie">
        <header className="rp-clinic-header">
          <strong>CMI DR. CURTA ASINETA</strong>
          <span>Str. Visinului nr. 47, Arad</span>
        </header>

        <div className="rp-document-meta">
          <Row label="Nr. curent" value={patient.currentNumber} />
          <Row label="Data" value={formatDate(patient.examinationDate)} />
        </div>

        <h1 className="rp-title">ECOCARDIOGRAFIE</h1>

      <div className="rp-patient">
        <div className="rp-patient__row">
          <Row label="Nume si Prenume" value={patient.name} />
          <Row label="Varsta" value={patient.age} unit="ani" />
        </div>
        <div className="rp-patient__row rp-patient__row--three">
          <Row label="Greutate" value={patient.weight} unit="kg" />
          <Row label="Inaltime" value={patient.height} unit="cm" />
          <Row label="IMC" value={patient.bmi} unit="kg/m²" />
        </div>
      </div>

      <h2 className="rp-group-title">M ECHO + 2D ECHO</h2>

      <section className="rp-section">
        <h3 className="rp-section-title">SECTIUNE LONGITUDINALA PARASTERNALA</h3>
        <div className="rp-parasternal-columns">
          <div className="rp-grid rp-grid--single">
            <Row label="VS - diametrul telediastolic (cm)" value={m.lvEndDiastolicDiameter} />
            <Row label="VS - diametrul telesistolic (cm)" value={m.lvEndSystolicDiameter} />
            <Row label="SIV - diam. diastolic (cm)" value={m.ivsDiastolicDiameter} />
            <Row label="Perete posterior - diam. diastolic (cm)" value={m.posteriorWallDiastolicDiameter} />
            <Row label="Fractie de ejectie VS (Teicholtz) %" value={m.lvEjectionFractionTeicholz} />
            <Row label="Fractie de scurtare %" value={m.shorteningFraction} />
            <Row label="Masa VS (g/m²)" value={m.lvMass} />
          </div>
          <div className="rp-grid rp-grid--single">
            <Row label="Aorta la inel (cm)" value={m.aortaAnnulus} />
            <Row label="Aorta ascendenta (cm)" value={m.ascendingAorta} />
            <Row label="AS - diametrul antero-posterior (cm)" value={m.laAnteroposteriorDiameter} />
            <Row label="Aorta la nivelul crosei (cm)" value={m.aortaAtArch} />
            <Row label="Artera pulmonara (cm)" value={m.pulmonaryArtery} />
          </div>
        </div>
      </section>

      <section className="rp-section">
        <h3 className="rp-section-title">APICAL 4C</h3>
        <div className="rp-apical-columns">
          <div className="rp-grid rp-grid--single">
            <Row label="VS - diametrul latero-median (cm)" value={m.lvLateromedialDiameter} />
            <Row label="VD - diametrul latero-median (cm)" value={m.rvLateromedialDiameter} />
            <Row label="AS - diametrul latero-median (cm)" value={m.laLateromedialDiameter} />
            <Row label="AD - diametrul latero-median (cm)" value={m.raLateromedialDiameter} />
            <div className="rp-inline-grid rp-inline-grid--two">
              <Row label="MAPSE (mm)" value={m.mapse} />
              <Row label="TAPSE (mm)" value={m.tapse} />
            </div>
          </div>
          <div className="rp-grid rp-grid--single">
            <Row label="Aria AS (cm²)" value={m.laArea} />
            <Row label="Aria AD (cm²)" value={m.raArea} />
            <Row label="Volum telediastolic VS (ml)" value={m.lvEndDiastolicVolume} />
            <Row label="Volum telesistolic VS (ml)" value={m.lvEndSystolicVolume} />
            <Row label="Fractie de ejectie (Simpson) %" value={m.lvEjectionFractionSimpson} />
          </div>
        </div>
        <div className="rp-grid rp-grid--single">
          <Row label="Cinetica parietala" value={m.wallMotion} />
          <Row label="Valve aortice" value={m.aorticValves} />
          <Row label="Valve mitrale" value={m.mitralValves} />
          <Row label="Valve tricuspide" value={m.tricuspidValves} />
          <Row label="Valve pulmonare" value={m.pulmonaryValves} />
        </div>
        <div className="rp-pericard">
          <span className="rp-pericard__label">Pericard:</span>
          <div className="rp-pericard__content">
            <Row label="Lichid pericardic" value={m.pericardialFluid} />
          </div>
        </div>
      </section>

      <h2 className="rp-group-title">ECHO DOPPLER</h2>

      <section className="rp-section rp-flux">
        <h3 className="rp-section-title">Flux aortic</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Row label="Vmax (cm/s)" value={m.aorticVmax} />
          <Row label="Pmax (mmHg)" value={m.aorticPmax} />
          <Row label="Pmediu (mmHg)" value={m.aorticPmean} />
        </div>
      </section>

      <section className="rp-section rp-flux">
        <h3 className="rp-section-title">Flux LVOT</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Row label="Vmax (cm/s)" value={m.lvotVmax} />
          <Row label="Pmax (mmHg)" value={m.lvotPmax} />
          <Row label="VTI (cm)" value={m.lvotVti} />
        </div>
        <div className="rp-inline-grid rp-inline-grid--two">
          <Row label="Aria valvei aortice (EC)(cm²)" value={m.aorticValveArea} />
          <Row label="Regurgitare aortica" value={m.aorticRegurgitation} />
        </div>
      </section>

      <section className="rp-section rp-flux">
        <h3 className="rp-section-title">Flux mitral</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Row label="Unda E" value={m.mitralE} />
          <Row label="Unda A" value={m.mitralA} />
          <Row label="E/A" value={m.mitralEaRatio} />
        </div>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Row label="TDE (msec)" value={m.mitralDecelerationTime} />
          <Row label="TRIV (msec)" value={m.mitralTriv} />
          <Row label="Aria valvei mitrala (cm²)" value={m.mitralValveArea} />
        </div>
        <div className="rp-grid rp-grid--single">
          <Row label="Regurgitare mitrala" value={m.mitralRegurgitation} />
        </div>
      </section>

      <section className="rp-section rp-flux">
        <h3 className="rp-section-title">Flux tricuspidian</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Row label="Vmax (cm/s)" value={m.tricuspidVmax} />
          <Row label="Pmax (mmHg)" value={m.tricuspidPmax} />
          <Row label="PSVD (mmHg)" value={m.psvd} />
        </div>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Row label="Unda E (cm/s)" value={m.tricuspidE} />
          <Row label="Unda A (cm/s)" value={m.tricuspidA} />
          <Row label="E/A" value={m.tricuspidEaRatio} />
        </div>
        <div className="rp-grid rp-grid--single">
          <Row label="Regurgitare tricuspidiana" value={m.tricuspidRegurgitation} />
        </div>
      </section>

      <section className="rp-section rp-flux">
        <h3 className="rp-section-title">Flux pulmonar</h3>
        <div className="rp-inline-grid rp-inline-grid--three">
          <Row label="Vmax (cm/s)" value={m.pulmonaryVmax} />
          <Row label="Pmax (mmHg)" value={m.pulmonaryPmax} />
          <Row label="VTI (cm)" value={m.pulmonaryVti} />
          <Row label="Regurgitare pulmonara" value={m.pulmonaryRegurgitation} />
        </div>
      </section>

      <h2 className="rp-group-title">DOPPLER TISULAR (sept)</h2>

      <section className="rp-section">
        <div className="rp-inline-grid rp-inline-grid--three">
          <Row label="Unda E'" value={m.septalEPrime} />
          <Row label="Unda A' (cm/s)" value={m.septalAPrime} />
          <Row label="E'/A'" value={m.septalEaPrimeRatio} />
          <Row label="E/E'" value={m.eePrimeRatio} />
          <Row label="Unda S (cm/s)" value={m.septalS} />
        </div>
      </section>

      <section className="rp-section rp-conclusions-section">
        <h3 className="rp-section-title">CONCLUZII</h3>
        <div className="rp-conclusions">{conclusions}</div>
      </section>
    </article>
    </div>
  );
}
