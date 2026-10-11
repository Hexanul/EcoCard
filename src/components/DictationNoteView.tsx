import type { DictationNote } from '../services/reportState';

type DictationNoteViewProps = {
  note: DictationNote;
  // The value now in the field (not offered again as a choice).
  value: string;
  // Puts another dictated value, or the replaced one, in the field.
  onChoose: (value: string) => void;
  // Keeps the dictated value; omitted when it cannot be kept (impossible value).
  onConfirm?: () => void;
};

const MAX_CHOICE_LENGTH = 24;

// Shown under a field filled by dictation, like the checks under the patient
// fields: why the value is uncertain and the doctor's options.
export function DictationNoteView({ note, value, onChoose, onConfirm }: DictationNoteViewProps) {
  const choices = (note.alternatives ?? []).filter((alternative) => alternative !== value);
  const needsDecision = note.warnings.length > 0;
  const previous = note.previousValue;
  return (
    <div className="field__note">
      {note.warnings.map((warning) => (
        <p key={warning} className="field__note-warning">{warning}</p>
      ))}
      {note.info.map((info) => (
        <p key={info} className="field__note-info">{info}</p>
      ))}
      {needsDecision && note.sourceText && (
        <p className="field__note-source">Dictat: „{note.sourceText}”</p>
      )}
      {needsDecision && (
        <div className="field__note-actions">
          {onConfirm && (
            <button type="button" className="field__confirm" onClick={onConfirm}>
              Confirmă
            </button>
          )}
          {choices.map((choice) => (
            <button key={choice} type="button" className="field__choice" onClick={() => onChoose(choice)}>
              Folosește {choice}
            </button>
          ))}
          {previous !== undefined && (
            <button type="button" className="field__choice" onClick={() => onChoose(previous)}>
              {previous.length > MAX_CHOICE_LENGTH ? 'Revino la textul anterior' : `Revino la ${previous}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
