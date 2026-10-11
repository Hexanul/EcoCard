import { useEffect, useRef, useState } from 'react';
import { APP_VERSION, TERMS_REVISION, TERMS_TEXT } from '../config/appInfo';

type AboutDialogProps = {
  // First start (or changed terms): the app stays blocked until the doctor
  // accepts; Esc does not dismiss the dialog.
  requireAcceptance: boolean;
  onAccept: () => void;
  onClose: () => void;
};

// Mounted only while open; the native modal dialog provides the backdrop and
// focus trapping. Shows the intended purpose, terms and privacy notice.
export function AboutDialog({ requireAcceptance, onAccept, onClose }: AboutDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="settings-dialog about-dialog"
      onCancel={(event) => { if (requireAcceptance) event.preventDefault(); }}
      onClose={onClose}
      aria-labelledby="about-title"
    >
      <h2 id="about-title" className="settings-dialog__title">
        {requireAcceptance ? 'Înainte de prima utilizare' : 'Despre Raport Eco'}
      </h2>
      <p className="settings-dialog__note about-dialog__meta">
        Raport Eco versiunea {APP_VERSION} · termeni din {TERMS_REVISION}
      </p>
      <p className="about-dialog__summary">
        Raport Eco este un instrument de redactare: transcrie dictarea și propune valori, dar nu pune
        diagnostice. Fiecare valoare, unitate, calcul și concluzie trebuie verificată de medic înainte
        de exportul raportului.
      </p>
      <pre className="about-dialog__terms" tabIndex={0}>{TERMS_TEXT}</pre>
      {requireAcceptance && (
        <label className="about-dialog__accept">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          Am citit și accept scopul utilizării, termenii și nota de confidențialitate.
        </label>
      )}
      <div className="settings-dialog__actions">
        {requireAcceptance ? (
          <>
            <button type="button" className="btn btn--neutral" onClick={() => window.close()}>
              Închide aplicația
            </button>
            <button type="button" className="btn btn--primary" disabled={!accepted} onClick={onAccept}>
              Continuă
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => dialogRef.current?.close()}>
            Închide
          </button>
        )}
      </div>
    </dialog>
  );
}
