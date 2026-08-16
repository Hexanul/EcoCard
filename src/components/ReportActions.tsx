type ReportActionsProps = {
  onClear: () => void;
  onGenerate: () => void;
};

export function ReportActions({ onClear, onGenerate }: ReportActionsProps) {
  return (
    <section className="report-actions">
      <button type="button" className="btn btn--secondary" onClick={onClear}>
        Șterge formularul
      </button>
      <button type="button" className="btn btn--primary" onClick={onGenerate}>
        Generează raport
      </button>
    </section>
  );
}
