import { useMemo, useState } from 'react';
import type { Measurements } from '../types/echoReport';
import type { ParsedDetectedItem } from '../services/medicalParser';
import {
  conflictingDuplicateFields,
  isCalculatedItem,
  mergeSelectedMeasurements,
  needsExplicitApproval,
} from '../services/reportState';

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
  // Fields dictated twice with different values: every such row starts
  // unchecked and at most one of them can be selected.
  const duplicates = useMemo(() => conflictingDuplicateFields(parsedMeasurements), [parsedMeasurements]);

  const hasUnitMismatch = (item: ParsedDetectedItem): boolean =>
    'unitMismatch' in item && item.unitMismatch === true;

  const hasAmbiguousValue = (item: ParsedDetectedItem): boolean =>
    'ambiguousValue' in item && item.ambiguousValue === true;

  const isDuplicate = (item: ParsedDetectedItem): boolean => duplicates.has(item.field);

  const existingValueOf = (item: ParsedDetectedItem): string =>
    item.field === 'conclusions' ? conclusions : measurements[item.field];

  const isConflict = (item: ParsedDetectedItem): boolean =>
    needsExplicitApproval(item, existingValueOf(item), duplicates);

  const isSelected = (item: ParsedDetectedItem, index: number): boolean => {
    if (isCalculatedItem(item)) return false;
    const defaultSelected = !isConflict(item);
    return toggled.has(index) ? !defaultSelected : defaultSelected;
  };

  const setSelected = (index: number, selected: boolean) => {
    setToggled((prev) => {
      const item = parsedMeasurements[index];
      const defaultSelected = !isConflict(item);
      const next = new Set(prev);
      if (selected === defaultSelected) {
        next.delete(index);
      } else {
        next.add(index);
      }
      // Selecting one value of a duplicated field deselects the others
      // (their default is unselected, so dropping the toggle unchecks them).
      if (selected && isDuplicate(item)) {
        parsedMeasurements.forEach((other, otherIndex) => {
          if (otherIndex !== index && other.field === item.field) next.delete(otherIndex);
        });
      }
      return next;
    });
  };

  const selectedItems = parsedMeasurements.filter((item, index) => isSelected(item, index));
  // Ratios as they will be recalculated from the checked values.
  const resultingMeasurements = mergeSelectedMeasurements(measurements, selectedItems);

  return (
    <section className="panel measurement-review">
      <div className="measurement-review__header">
        <h2 className="panel__title">Măsurători detectate</h2>
        <span className="local-badge">REVIZUIRE</span>
      </div>

      <ul className="measurement-review__list">
        {parsedMeasurements.map((item, index) => {
          const unit = 'unit' in item ? item.unit : undefined;
          if (isCalculatedItem(item)) {
            const resultingValue = item.field === 'conclusions' ? '' : resultingMeasurements[item.field];
            return (
              <li
                key={`${item.field}-${index}`}
                className="measurement-review__row measurement-review__row--calculated"
              >
                <div className="measurement-review__item">
                  <span className="measurement-review__calculated-mark" aria-hidden="true">=</span>
                  <span className="measurement-review__field">{item.label}</span>
                  <span className="measurement-review__value">{resultingValue || '—'}</span>
                  <span
                    className={`measurement-review__badge measurement-review__badge--${item.confidence}`}
                  >
                    {CONFIDENCE_LABELS[item.confidence]}
                  </span>
                </div>
                <p className="measurement-review__source">
                  {item.sourceText}. Se recalculează din valorile bifate.
                </p>
              </li>
            );
          }
          const conflict = isConflict(item);
          const selected = isSelected(item, index);
          const existingValue = existingValueOf(item);
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
                  onChange={(event) => setSelected(index, event.currentTarget.checked)}
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
              {'convertedFrom' in item && item.convertedFrom && (
                <p className="measurement-review__source">
                  Convertit automat din {item.convertedFrom} în {unit}.
                </p>
              )}
              {isDuplicate(item) && (
                <p className="measurement-review__conflict">
                  Câmp dictat de mai multe ori cu valori diferite — alegeți valoarea corectă.
                </p>
              )}
              {hasAmbiguousValue(item) && (
                <p className="measurement-review__conflict">
                  Mai multe valori dictate pentru acest câmp — a fost propusă prima. Verificați și bifați pentru a aplica.
                </p>
              )}
              {hasUnitMismatch(item) ? (
                <p className="measurement-review__conflict">
                  Unitate dictată diferită de unitatea câmpului — verificați valoarea. Bifează pentru a aplica.
                </p>
              ) : existingValue !== '' && existingValue !== item.value && (
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