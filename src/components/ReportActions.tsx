import type { ReportIssue } from '../utils/valueChecks';

const ISSUE_TEXT: Record<ReportIssue['status'], string> = {
  reject: ' — valoare imposibilă',
  confirm: ' — valoare neobișnuită, neconfirmată',
  dictated: ' — valoare dictată de verificat',
};

type ReportActionsProps = {
  onClear: () => void;
  onPreview: () => void;
  // Values blocking the preview, shown after a preview attempt.
  issues: ReportIssue[];
};

export function ReportActions({ onClear, onPreview, issues }: ReportActionsProps) {
  return (
    <section className="report-actions">
      {issues.length > 0 && (
        <div className="report-actions__issues" role="alert">
          <p>Corectați sau confirmați înainte de previzualizare:</p>
          <ul>
            {issues.map((issue) => (
              <li key={issue.id}>
                <button
                  type="button"
                  className="report-actions__issue"
                  onClick={() => document.getElementById(issue.id)?.focus()}
                >
                  {issue.label}
                </button>
                {ISSUE_TEXT[issue.status]}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="report-actions__buttons">
        <button type="button" className="btn btn--secondary" onClick={onClear}>
          Șterge formularul
        </button>
        <button type="button" className="btn btn--primary" onClick={onPreview}>
          Previzualizare raport
        </button>
      </div>
    </section>
  );
}
