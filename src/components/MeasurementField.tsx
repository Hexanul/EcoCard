type MeasurementFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'numeric' | 'text' | 'textarea';
  unit?: string;
  readOnly?: boolean;
};

export function MeasurementField({
  id,
  label,
  value,
  onChange,
  type = 'numeric',
  unit,
  readOnly = false,
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
          readOnly={readOnly}
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
          type="text"
          inputMode={type === 'numeric' ? 'decimal' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
        />
        {unit && <span className="field__unit">{unit}</span>}
      </div>
    </div>
  );
}
