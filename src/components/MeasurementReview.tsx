import { useState } from 'react';
import type { Measurements } from '../types/echoReport';
import type { ParsedDetectedItem } from '../services/medicalParser';

const CONFIDENCE_LABELS: Record<ParsedDetectedItem['confidence'], string> = {
  high: 'Sigur',
  medium: 'Aproximativ',
  low: 'Incert',
};

type MeasurementReviewProps = {
  measurements: Measurements;
  conclusions: string;
  parsedMeasurements: ParsedDetectedItem[];
  onApply: (selected: ParsedDetectedItem[]) => void;
  onDismiss: () => void;
};

export function MeasurementReview({
  measurements,
  parsedMeasurements,
  conclusions,
  onApply,
  onDismiss,
}: MeasurementReviewProps) {
  // A detected value never overwrites a manually entered value automatically:
  // conflicting rows start unchecked and require an explicit doctor decision.
  // The parent remounts this panel (via key) whenever a new transcript parse
  // arrives, so the toggle state resets together with the detected list.
  const [toggled, setToggled] = useState<Set<number>>(() => new Set());

  const isConflict = (item: ParsedDetectedItem): boolean => {
    const existing = item.field === 'conclusions' ? conclusions : measurements[item.field];
    return existing !== '' && existing !== item.value;
  };

  const isSelected = (item: ParsedDetectedItem, index: number): boolean => {
    const defaultSelected = !isConflict(item);
    return toggled.has(index) ? !defaultSelected : defaultSelected;
  };

  const toggle = (index: number) => {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectedItems = parsedMeasurements.filter((item, index) => isSelected(item, index));

  return (
    <section className="panel measurement-review">
      <div className="measurement-review__header">
        <h2 className="panel__title">Măsurători detectate</h2>
        <span className="local-badge">REVIZUIRE</span>
      </div>

      <ul className="measurement-review__list">
        {parsedMeasurements.map((item, index) => {
          const conflict = isConflict(item);
          const selected = isSelected(item, index);
          const unit = 'unit' in item ? item.unit : undefined;
          const existingValue = item.field === 'conclusions' ? conclusions : measurements[item.field];
          const rowClass = [
            'measurement-review__row',
            conflict ? 'measurement-review__row--conflict' : '',
            item.confidence === 'low' ? 'measurement-review__row--low' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li key={`${item.field}-${index}`} className={rowClass}>
              <label className="measurement-review__item">
                <input
                  type="checkbox"
                  className="measurement-review__checkbox"
                  checked={selected}
                  onChange={() => toggle(index)}
                  aria-label={`${conflict ? 'Înlocuiește' : 'Aplică'} ${item.label}: ${item.value}${unit ? ` ${unit}` : ''}`}
                />
                <span className="measurement-review__field">{item.label}</span>
                <span className="measurement-review__value">
                  {item.value}
                  {unit && <span className="measurement-review__unit">{unit}</span>}
                </span>
                {item.kind === 'qualitative' && (
                  <span className="measurement-review__kind">text</span>
                )}
                <span
                  className={`measurement-review__badge measurement-review__badge--${item.confidence}`}
                >
                  {CONFIDENCE_LABELS[item.confidence]}
                </span>
              </label>
              <p className="measurement-review__source">{item.sourceText}</p>
              {conflict && (
                <p className="measurement-review__conflict">
                  Formularul conține deja: {existingValue}. Bifează pentru a înlocui.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {parsedMeasurements.some((item) => item.confidence === 'low') && (
        <p className="measurement-review__low-note">
          Valorile marcate „Incert” necesită revizuire manuală.
        </p>
      )}

      <div className="measurement-review__actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={selectedItems.length === 0}
          onClick={() => onApply(selectedItems)}
        >
          Aplică în formular
        </button>
        <button type="button" className="btn btn--secondary" onClick={onDismiss}>
          Renunță
        </button>
      </div>
    </section>
  );
}