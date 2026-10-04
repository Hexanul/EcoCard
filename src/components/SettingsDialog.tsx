import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ClinicSettings } from '../config/clinicSettings';

type SettingsDialogProps = {
  clinic: ClinicSettings;
  onSave: (settings: ClinicSettings) => void;
  onClose: () => void;
};

// Mounted only while open; the native modal dialog provides the backdrop,
// focus trapping and Esc-to-close.
export function SettingsDialog({ clinic, onSave, onClose }: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<ClinicSettings>(clinic);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const canSave = draft.name.trim().length > 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    onSave({ name: draft.name.trim(), address: draft.address.trim() });
  };

  return (
    <dialog ref={dialogRef} className="settings-dialog" onClose={onClose} aria-labelledby="settings-title">
      <form onSubmit={handleSubmit}>
        <h2 id="settings-title" className="settings-dialog__title">Setări raport</h2>
        <h3 className="settings-dialog__section">Antet cabinet</h3>
        <p className="settings-dialog__note">Apare în antetul fiecărui raport exportat ca PDF.</p>
        <div className="field">
          <label htmlFor="clinic-name">Nume cabinet</label>
          <input
            id="clinic-name"
            type="text"
            value={draft.name}
            placeholder="ex. CMI DR. NUME PRENUME"
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="clinic-address">Adresă</label>
          <input
            id="clinic-address"
            type="text"
            value={draft.address}
            placeholder="ex. Str. Exemplu nr. 1, Oraș"
            onChange={(event) => setDraft({ ...draft, address: event.target.value })}
          />
        </div>
        <div className="settings-dialog__actions">
          <button type="button" className="btn btn--neutral" onClick={() => dialogRef.current?.close()}>
            Anulează
          </button>
          <button type="submit" className="btn btn--primary" disabled={!canSave}>
            Salvează
          </button>
        </div>
      </form>
    </dialog>
  );
}
