type ConclusionsFormProps = {
  value: string;
  onChange: (value: string) => void;
};

export function ConclusionsForm({ value, onChange }: ConclusionsFormProps) {
  return (
    <section className="panel">
      <h2 className="panel__title">Concluzii</h2>
      <div className="field field--textarea">
        <label htmlFor="report-conclusions">Concluzii ale examinării</label>
        <textarea
          id="report-conclusions"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
        />
      </div>
    </section>
  );
}
