import { useEffect, useRef } from 'react';

export type AutoStopReason = 'maxLength' | 'longPause';

type AutoStopDialogProps = {
  reason: AutoStopReason;
  minutes: number;
  onAnalyze: () => void;
  onDiscard: () => void;
};

// Romanian counts: "un minut", "5 minute", "30 de minute" (20+ take "de",
// except when the last two digits are 01–19).
function formatMinutes(minutes: number): string {
  if (minutes === 1) return 'un minut';
  const lastTwo = minutes % 100;
  return lastTwo >= 1 && lastTwo <= 19 ? `${minutes} minute` : `${minutes} de minute`;
}

// Mounted only while open, like AboutDialog. The doctor must choose: Esc does
// not dismiss it, so a recording left on by mistake is never analyzed or
// dropped without a decision. Chromium ignores preventDefault on `cancel`
// when nobody has clicked since the dialog opened (exactly the forgotten
// recording), so the Esc keydown itself is cancelled and a dialog closed any
// other way is reopened.
export function AutoStopDialog({ reason, minutes, onAnalyze, onDiscard }: AutoStopDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="settings-dialog auto-stop-dialog"
      onKeyDown={(event) => { if (event.key === 'Escape') event.preventDefault(); }}
      onCancel={(event) => event.preventDefault()}
      onClose={() => {
        const dialog = dialogRef.current;
        if (dialog?.isConnected && !dialog.open) dialog.showModal();
      }}
      aria-labelledby="auto-stop-title"
    >
      <h2 id="auto-stop-title" className="settings-dialog__title">
        Înregistrarea a fost oprită automat
      </h2>
      <p>
        {reason === 'maxLength'
          ? `Dictarea a ajuns la ${formatMinutes(minutes)}`
          : `Dictarea a stat în pauză ${formatMinutes(minutes)}`}
        , așa că înregistrarea a fost oprită și microfonul închis, ca să nu rămână pornit din greșeală.
      </p>
      <p>
        Doriți să fie analizată ca o înregistrare normală? Dacă a rămas pornită din greșeală, poate
        conține și alte conversații. Analiza unei înregistrări lungi poate dura mai multe minute.
      </p>
      <div className="settings-dialog__actions">
        <button type="button" className="btn btn--neutral" onClick={onDiscard}>
          Nu, șterge înregistrarea
        </button>
        <button type="button" className="btn btn--primary" onClick={onAnalyze}>
          Da, analizează
        </button>
      </div>
    </dialog>
  );
}
