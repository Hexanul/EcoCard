import type { PatientInfo } from '../types/echoReport';

type PatientFormProps = {
  patient: PatientInfo;
  onChange: (patient: PatientInfo) => void;
};

function calculateBmi(weightKg: string, heightCm: string): string {
  const weight = parseFloat(weightKg.replace(',', '.'));
  const height = parseFloat(heightCm.replace(',', '.'));
  if (!weight || !height || height <= 0) return '';
  const heightM = height / 100;
  return (weight / (heightM * heightM)).toFixed(1);
}

export function PatientForm({ patient, onChange }: PatientFormProps) {
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

  return (
    <section className="panel">
      <h2 className="panel__title">Date pacient</h2>
      <div className="patient-form">
        <div className="field patient-form__name">
          <label htmlFor="patient-name">Nume pacient</label>
          <input
            id="patient-name"
            type="text"
            value={patient.name}
            onChange={(e) => update('name', e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor="patient-age">Vârstă</label>
          <div className="field__input-row">
            <input
              id="patient-age"
              type="text"
              inputMode="decimal"
              value={patient.age}
              onChange={(e) => update('age', e.target.value)}
              autoComplete="off"
            />
            <span className="field__unit">ani</span>
          </div>
        </div>

        <div className="patient-form__date-group">
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

        <div className="field">
          <label htmlFor="patient-weight">Greutate</label>
          <div className="field__input-row">
            <input
              id="patient-weight"
              type="text"
              inputMode="decimal"
              value={patient.weight}
              onChange={(e) => updateWeight(e.target.value)}
              autoComplete="off"
            />
            <span className="field__unit">kg</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="patient-height">Înălțime</label>
          <div className="field__input-row">
            <input
              id="patient-height"
              type="text"
              inputMode="decimal"
              value={patient.height}
              onChange={(e) => updateHeight(e.target.value)}
              autoComplete="off"
            />
            <span className="field__unit">cm</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="patient-bmi">IMC</label>
          <div className="field__input-row">
            <input
              id="patient-bmi"
              type="text"
              inputMode="decimal"
              value={patient.bmi}
              onChange={(e) => update('bmi', e.target.value)}
              autoComplete="off"
            />
            <span className="field__unit">kg/m²</span>
          </div>
        </div>
      </div>
    </section>
  );
}
