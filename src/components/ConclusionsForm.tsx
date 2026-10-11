import { CONCLUSIONS_MAX_LENGTH } from '../config/measurementLimits';
import type { DictationNote } from '../services/reportState';
import { CONCLUSIONS_FIELD_ID } from '../utils/valueChecks';
import { DictationNoteView } from './DictationNoteView';

type ConclusionsFormProps = {
  value: string;
  onChange: (value: string) => void;
  // Set when dictated conclusions replaced text written in the form.
  note?: DictationNote;
  onChooseValue: (value: string) => void;
  onConfirm: () => void;
};

export function ConclusionsForm({ value, onChange, note, onChooseValue, onConfirm }: ConclusionsFormProps) {
  return (
    <section className="panel">
      <h2 className="panel__title">Concluzii</h2>
      <div className={`field field--textarea${note?.warnings.length ? ' field--confirm' : ''}`}>
        <label htmlFor={CONCLUSIONS_FIELD_ID}>Concluzii ale examinării</label>
        <textarea
          id={CONCLUSIONS_FIELD_ID}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          maxLength={CONCLUSIONS_MAX_LENGTH}
        />
        {note && <DictationNoteView note={note} value={value} onChoose={onChooseValue} onConfirm={onConfirm} />}
      </div>
    </section>
  );
}
