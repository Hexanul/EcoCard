import { useEffect, useRef, type ReactNode } from 'react';

type ConfirmDialogProps = {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// A yes/no question before a destructive action. Mounted only while open,
// like AutoStopDialog; Esc, "Anulează" and closing the dialog all cancel, and
// "Anulează" has the focus, so Enter never confirms by accident.
export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog ref={dialogRef} className="settings-dialog message-dialog" onClose={onCancel} aria-labelledby="confirm-title">
      <h2 id="confirm-title" className="settings-dialog__title">{title}</h2>
      {children}
      <div className="settings-dialog__actions">
        <button type="button" className="btn btn--neutral" onClick={() => dialogRef.current?.close()} autoFocus>
          Anulează
        </button>
        <button type="button" className="btn btn--secondary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
