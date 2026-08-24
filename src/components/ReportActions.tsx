type ReportActionsProps = {
  onClear: () => void;
  onPreview: () => void;
  onGenerate: () => void;
};

export function ReportActions({ onClear, onPreview, onGenerate }: ReportActionsProps) {
  return (
    <section className="report-actions">
      <button type="button" className="btn btn--secondary" onClick={onClear}>
        Șterge formularul
      </button>
      <button type="button" className="btn btn--primary" onClick={onPreview}>
        Previzualizare raport
      </button>
      <button type="button" className="btn btn--primary" onClick={onGenerate}>
        Generează raport
      </button>
    </section>
  );
}
