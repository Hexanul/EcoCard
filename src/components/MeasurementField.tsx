import { useState } from 'react';
import type { ValueLimits } from '../config/measurementLimits';
import { hasWarnings, type DictationNote } from '../services/reportState';
import { checkValue, describeStatus, sanitizeNumericInput } from '../utils/valueChecks';
import { DictationNoteView } from './DictationNoteView';

type MeasurementFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'numeric' | 'text' | 'textarea';
  unit?: string;
  readOnly?: boolean;
  // Plausibility limits of a numeric field (config/measurementLimits.ts).
  limits?: ValueLimits;
  // The doctor confirmed this exact unusual value.
  confirmed?: boolean;
  // Confirms an unusual value and keeps a dictated one with a warning.
  onConfirm?: () => void;
  // Cross-field consistency note; never blocks.
  warning?: string;
  maxLength?: number;
  // Why a dictated value is uncertain, and the alternatives to choose from.
  note?: DictationNote;
  onChooseValue?: (value: string) => void;
};

export function MeasurementField({
  id,
  label,
  value,
  onChange,
  type = 'numeric',
  unit,
  readOnly = false,
  limits,
  confirmed = false,
  onConfirm,
  warning,
  maxLength,
  note,
  onChooseValue,
}: MeasurementFieldProps) {
  // Values are checked when the field is left, never while typing (a lower
  // limit would flag "4" on the way to "4.8"). Dictated values, which never
  // had focus, are checked as soon as they are applied.
  const [focused, setFocused] = useState(false);

  const status = limits && !readOnly && !focused ? checkValue(value, limits) : 'empty';
  const needsLimitConfirmation = status === 'confirm' && !confirmed;
  const noteNeedsDecision = hasWarnings(note);
  const fieldClass = [
    'field',
    `field--${type}`,
    status === 'reject' ? 'field--reject' : '',
    status !== 'reject' && (needsLimitConfirmation || noteNeedsDecision) ? 'field--confirm' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // One "Confirmă" per field: the note's button also confirms an unusual
  // value. An impossible value cannot be kept, only corrected.
  const confirm = status === 'reject' ? undefined : onConfirm;
  const details = (
    <>
      {limits && (status === 'reject' || needsLimitConfirmation) && (
        <p className="field__message">
          {describeStatus(status, limits, unit)}
          {needsLimitConfirmation && !noteNeedsDecision && confirm && (
            <button type="button" className="field__confirm" onClick={confirm}>
              Confirmă
            </button>
          )}
        </p>
      )}
      {note && (
        <DictationNoteView
          note={note}
          value={value}
          onChoose={(choice) => onChooseValue?.(choice)}
          onConfirm={confirm}
        />
      )}
      {warning && !focused && <p className="field__warning">{warning}</p>}
    </>
  );

  if (type === 'textarea') {
    return (
      <div className={fieldClass}>
        <label htmlFor={id}>{label}</label>
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          readOnly={readOnly}
          maxLength={maxLength}
          aria-invalid={noteNeedsDecision || undefined}
        />
        {details}
      </div>
    );
  }

  return (
    <div className={fieldClass}>
      <label htmlFor={id}>{label}</label>
      <div className="field__input-row">
        <input
          id={id}
          type="text"
          inputMode={type === 'numeric' ? 'decimal' : 'text'}
          value={value}
          onChange={(e) =>
            onChange(limits ? sanitizeNumericInput(e.target.value, limits.maxDecimals) : e.target.value)
          }
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          readOnly={readOnly}
          aria-invalid={status === 'reject' || needsLimitConfirmation || noteNeedsDecision || undefined}
          autoComplete="off"
        />
        {unit && <span className="field__unit">{unit}</span>}
      </div>
      {details}
    </div>
  );
}
