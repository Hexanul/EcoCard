type ReportActionsProps = {
  onClear: () => void;
  onPreview: () => void;
};

export function ReportActions({ onClear, onPreview }: ReportActionsProps) {
  return (
    <section className="report-actions">
      <button type="button" className="btn btn--secondary" onClick={onClear}>
        Șterge formularul
      </button>
      <button type="button" className="btn btn--primary" onClick={onPreview}>
        Previzualizare raport
      </button>
    </section>
  );
}
