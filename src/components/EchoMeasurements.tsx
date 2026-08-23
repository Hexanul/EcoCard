import { MeasurementField } from './MeasurementField';
import { MeasurementSection } from './MeasurementSection';
import type { MeasurementKey, Measurements } from '../types/echoReport';

type EchoMeasurementsProps = {
  measurements: Measurements;
  onChange: (key: MeasurementKey, value: string) => void;
};

export function EchoMeasurements({ measurements, onChange }: EchoMeasurementsProps) {
  const field = (
    key: MeasurementKey,
    label: string,
    unit?: string,
    type: 'numeric' | 'text' | 'textarea' = 'numeric',
  ) => (
    <MeasurementField
      key={key}
      id={key}
      label={label}
      value={measurements[key]}
      onChange={(value) => onChange(key, value)}
      unit={unit}
      type={type}
    />
  );

  return (
    <div className="echo-measurements">
      <h2 className="form-group__title">M ECHO + 2D ECHO</h2>

      <MeasurementSection title="Secțiune longitudinală parasternală">
        {field('lvEndDiastolicDiameter', 'VS — diametrul telediastolic', 'cm')}
        {field('lvEndSystolicDiameter', 'VS — diametrul telesistolic', 'cm')}
        {field('ivsDiastolicDiameter', 'SIV — diam. diastolic', 'cm')}
        {field('posteriorWallDiastolicDiameter', 'Perete posterior — diam. diastolic', 'cm')}
        {field('lvEjectionFractionTeicholz', 'Fracție de ejecție VS (Teicholz)', '%')}
        {field('shorteningFraction', 'Fracție de scurtare', '%')}
        {field('lvMass', 'Masă VS', 'g/m²')}
        {field('aortaAnnulus', 'Aortă la inel', 'cm')}
        {field('ascendingAorta', 'Aortă ascendentă', 'cm')}
        {field('laAnteroposteriorDiameter', 'AS — diametrul antero-posterior', 'cm')}
        {field('aortaAtArch', 'Aortă la nivelul croșii', 'cm')}
        {field('pulmonaryArtery', 'Arteră pulmonară', 'cm')}
      </MeasurementSection>

      <MeasurementSection title="Apical 4C">
        {field('lvLateromedialDiameter', 'VS — diametrul latero-median', 'cm')}
        {field('rvLateromedialDiameter', 'VD — diametrul latero-median', 'cm')}
        {field('laLateromedialDiameter', 'AS — diametrul latero-median', 'cm')}
        {field('raLateromedialDiameter', 'AD — diametrul latero-median', 'cm')}
        {field('mapse', 'MAPSE', 'mm')}
        {field('tapse', 'TAPSE', 'mm')}
      </MeasurementSection>

      <MeasurementSection title="Alte măsurători">
        {field('wallMotion', 'Cinetică parietală', undefined, 'textarea')}
        {field('aorticValves', 'Valve aortice', undefined, 'textarea')}
        {field('mitralValves', 'Valve mitrale', undefined, 'textarea')}
        {field('tricuspidValves', 'Valve tricuspide', undefined, 'textarea')}
        {field('pulmonaryValves', 'Valve pulmonare', undefined, 'textarea')}
        {field('laArea', 'Aria AS', 'cm²')}
        {field('raArea', 'Aria AD', 'cm²')}
        {field('lvEndDiastolicVolume', 'Volum telediastolic VS', 'ml')}
        {field('lvEndSystolicVolume', 'Volum telesistolic VS', 'ml')}
        {field('lvEjectionFractionSimpson', 'Fracție de ejecție Simpson', '%')}
      </MeasurementSection>

      <MeasurementSection title="Pericard">
        {field('pericardialFluid', 'Lichid pericardic', undefined, 'textarea')}
      </MeasurementSection>

      <h2 className="form-group__title">ECHO DOPPLER</h2>

      <MeasurementSection title="Flux aortic">
        {field('aorticVmax', 'Vmax', 'cm/s')}
        {field('aorticPmax', 'Pmax', 'mmHg')}
        {field('aorticPmean', 'Pmediu', 'mmHg')}
      </MeasurementSection>

      <MeasurementSection title="Flux LVOT">
        {field('lvotVmax', 'Vmax', 'cm/s')}
        {field('lvotPmax', 'Pmax', 'mmHg')}
        {field('lvotVti', 'VTI', 'cm')}
        {field('aorticValveArea', 'Aria valvei aortice (EC)', 'cm²')}
        {field('aorticRegurgitation', 'Regurgitare aortică', undefined, 'textarea')}
      </MeasurementSection>

      <MeasurementSection title="Flux mitral">
        {field('mitralE', 'Undă E', 'cm/s')}
        {field('mitralA', 'Undă A', 'cm/s')}
        {field('mitralEaRatio', 'E/A')}
        {field('mitralDecelerationTime', 'TDE', 'ms')}
        {field('mitralTriv', 'TRIV', 'ms')}
        {field('mitralValveArea', 'Aria valvei mitrale', 'cm²')}
        {field('mitralRegurgitation', 'Regurgitare mitrală', undefined, 'textarea')}
      </MeasurementSection>

      <MeasurementSection title="Flux tricuspidian">
        {field('tricuspidVmax', 'Vmax', 'cm/s')}
        {field('tricuspidPmax', 'Pmax', 'mmHg')}
        {field('psvd', 'PSVD', 'mmHg')}
        {field('tricuspidE', 'Undă E', 'cm/s')}
        {field('tricuspidA', 'Undă A', 'cm/s')}
        {field('tricuspidEaRatio', 'E/A')}
        {field('tricuspidRegurgitation', 'Regurgitare tricuspidiană', undefined, 'textarea')}
      </MeasurementSection>

      <MeasurementSection title="Flux pulmonar">
        {field('pulmonaryVmax', 'Vmax', 'cm/s')}
        {field('pulmonaryPmax', 'Pmax', 'mmHg')}
        {field('pulmonaryVti', 'VTI', 'cm')}
        {field('pulmonaryRegurgitation', 'Regurgitare pulmonară', undefined, 'textarea')}
      </MeasurementSection>

      <MeasurementSection title="Doppler tisular (sept)">
        {field('septalEPrime', "Undă E'", 'cm/s')}
        {field('septalAPrime', "Undă A'", 'cm/s')}
        {field('septalEaPrimeRatio', "E'/A'")}
        {field('eePrimeRatio', "E/E'")}
        {field('septalS', 'Undă S', 'cm/s')}
      </MeasurementSection>
    </div>
  );
}
