import { MEASUREMENT_SECTIONS, type MeasurementSectionDef } from '../config/measurementFields';
import { FINDINGS_MAX_LENGTH, MEASUREMENT_LIMITS } from '../config/measurementLimits';
import { MeasurementField } from './MeasurementField';
import { MeasurementSection } from './MeasurementSection';
import type { DictationNotes } from '../services/reportState';
import type { MeasurementKey, Measurements } from '../types/echoReport';
import { crossFieldWarnings, type Confirmations } from '../utils/valueChecks';

type MeasurementGroupProps = {
  group: MeasurementSectionDef['group'];
  title: string;
  measurements: Measurements;
  onChange: (key: MeasurementKey, value: string) => void;
  confirmed: Confirmations;
  onConfirm: (key: MeasurementKey, value: string) => void;
  // Notes on dictated values; choosing puts another value in the field.
  notes: DictationNotes;
  onChooseValue: (key: MeasurementKey, value: string) => void;
};

// Renders every section of one form group ("M ECHO + 2D ECHO" or
// "ECHO DOPPLER") from the field registry in config/measurementFields.ts.
export function MeasurementGroup({
  group,
  title,
  measurements,
  onChange,
  confirmed,
  onConfirm,
  notes,
  onChooseValue,
}: MeasurementGroupProps) {
  const warnings = crossFieldWarnings(measurements);
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
              limits={MEASUREMENT_LIMITS[field.key]}
              confirmed={confirmed[field.key] === measurements[field.key]}
              onConfirm={() => onConfirm(field.key, measurements[field.key])}
              warning={warnings[field.key]}
              maxLength={field.type === 'textarea' ? FINDINGS_MAX_LENGTH : undefined}
              note={notes[field.key]}
              onChooseValue={(value) => onChooseValue(field.key, value)}
            />
          ))}
        </MeasurementSection>
      ))}
    </div>
  );
}
