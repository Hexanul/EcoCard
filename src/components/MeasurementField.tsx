type MeasurementFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'numeric' | 'text' | 'textarea';
  unit?: string;
};

export function MeasurementField({
  id,
  label,
  value,
  onChange,
  type = 'numeric',
  unit,
}: MeasurementFieldProps) {
  if (type === 'textarea') {
    return (
      <div className="field field--textarea">
        <label htmlFor={id}>{label}</label>
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      </div>
    );
  }

  return (
    <div className={`field field--${type}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field__input-row">
        <input
          id={id}
          type={type === 'numeric' ? 'text' : 'text'}
          inputMode={type === 'numeric' ? 'decimal' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {unit && <span className="field__unit">{unit}</span>}
      </div>
    </div>
  );
}
