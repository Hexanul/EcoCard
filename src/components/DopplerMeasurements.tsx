import { MeasurementField } from './MeasurementField';
import { MeasurementSection } from './MeasurementSection';
import type { MeasurementKey, Measurements } from '../types/echoReport';

type DopplerMeasurementsProps = {
  measurements: Measurements;
  onChange: (key: MeasurementKey, value: string) => void;
};

export function DopplerMeasurements({ measurements, onChange }: DopplerMeasurementsProps) {
  const field = (
    key: MeasurementKey,
    label: string,
    unit?: string,
    type: 'numeric' | 'text' | 'textarea' = 'numeric',
  ) => (
    <MeasurementField
      key={key}
      id={`doppler-${key}`}
      label={label}
      value={measurements[key]}
      onChange={(value) => onChange(key, value)}
      unit={unit}
      type={type}
    />
  );

  return (
    <div className="doppler-measurements">
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
      </MeasurementSection>

      <MeasurementSection title="Valvă aortică">
        {field('aorticValveArea', 'Aria valvei aortice (EC)', 'cm²')}
        {field('aorticRegurgitation', 'Regurgitare aortică', undefined, 'textarea')}
      </MeasurementSection>

      <MeasurementSection title="Flux mitral">
        {field('mitralE', 'Undă E', 'cm/s')}
        {field('mitralA', 'Undă A', 'cm/s')}
        {field('mitralEaRatio', 'E/A')}
        {field('mitralDecelerationTime', 'TDE', 'msec')}
        {field('mitralTriv', 'TRIV', 'msec')}
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
