import { MEASUREMENT_SECTIONS, type MeasurementSectionDef } from '../config/measurementFields';
import { MeasurementField } from './MeasurementField';
import { MeasurementSection } from './MeasurementSection';
import type { MeasurementKey, Measurements } from '../types/echoReport';

type MeasurementGroupProps = {
  group: MeasurementSectionDef['group'];
  title: string;
  measurements: Measurements;
  onChange: (key: MeasurementKey, value: string) => void;
};

// Renders every section of one form group ("M ECHO + 2D ECHO" or
// "ECHO DOPPLER") from the field registry in config/measurementFields.ts.
export function MeasurementGroup({ group, title, measurements, onChange }: MeasurementGroupProps) {
  return (
    <div className={`${group}-measurements`}>
      <h2 className="form-group__title">{title}</h2>
      {MEASUREMENT_SECTIONS.filter((section) => section.group === group).map((section) => (
        <MeasurementSection key={section.title} title={section.title}>
          {section.fields.map((field) => (
            <MeasurementField
              key={field.key}
              id={field.key}
              label={field.label}
              value={measurements[field.key]}
              onChange={(value) => onChange(field.key, value)}
              unit={field.unit}
              type={field.type === 'textarea' ? 'textarea' : 'numeric'}
              readOnly={field.type === 'derived'}
            />
          ))}
        </MeasurementSection>
      ))}
    </div>
  );
}
