import { PATIENT_LIMITS, type PatientLimitKey } from '../config/measurementLimits';
import type { PatientInfo } from '../types/echoReport';
import { calculateBmi } from '../utils/bmi';
import { patientFieldId, type Confirmations } from '../utils/valueChecks';
import { MeasurementField } from './MeasurementField';

type PatientFormProps = {
  patient: PatientInfo;
  onChange: (patient: PatientInfo) => void;
  confirmed: Confirmations;
  onConfirm: (id: string, value: string) => void;
};

export function PatientForm({ patient, onChange, confirmed, onConfirm }: PatientFormProps) {
  const update = (field: keyof PatientInfo, value: string) => {
    onChange({ ...patient, [field]: value });
  };

  const updateWeight = (value: string) => {
    onChange({
      ...patient,
      weight: value,
      bmi: calculateBmi(value, patient.height),
    });
  };

  const updateHeight = (value: string) => {
    onChange({
      ...patient,
      height: value,
      bmi: calculateBmi(patient.weight, value),
    });
  };

  const limitedField = (
    key: PatientLimitKey,
    label: string,
    unit: string,
    onFieldChange: (value: string) => void,
  ) => {
    const id = patientFieldId(key);
    return (
      <MeasurementField
        id={id}
        label={label}
        value={patient[key]}
        onChange={onFieldChange}
        unit={unit}
        limits={PATIENT_LIMITS[key]}
        confirmed={confirmed[id] === patient[key]}
        onConfirm={() => onConfirm(id, patient[key])}
      />
    );
  };

  return (
    <section className="panel">
      <h2 className="panel__title">Date pacient</h2>
      <div className="patient-form">
        <div className="patient-form__name">
          <div className="field">
            <label htmlFor="patient-last-name">Nume</label>
            <input
              id="patient-last-name"
              type="text"
              value={patient.lastName}
              onChange={(e) => update('lastName', e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="patient-first-name">Prenume</label>
            <input
              id="patient-first-name"
              type="text"
              value={patient.firstName}
              onChange={(e) => update('firstName', e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="patient-form__demographics">
          {limitedField('age', 'Vârstă', 'ani', (value) => update('age', value))}

          <div className="field">
            <label htmlFor="examination-date">Data examinării</label>
            <input
              id="examination-date"
              type="date"
              value={patient.examinationDate}
              onChange={(e) => update('examinationDate', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="current-number">Nr. curent</label>
            <input
              id="current-number"
              type="text"
              value={patient.currentNumber}
              onChange={(e) => update('currentNumber', e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        {limitedField('weight', 'Greutate', 'kg', updateWeight)}
        {limitedField('height', 'Înălțime', 'cm', updateHeight)}

        {/* Calculated from weight and height. */}
        <MeasurementField
          id="patient-bmi"
          label="IMC"
          value={patient.bmi}
          onChange={() => undefined}
          unit="kg/m²"
          readOnly
        />
      </div>
    </section>
  );
}
