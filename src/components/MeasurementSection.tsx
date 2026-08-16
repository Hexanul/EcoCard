import type { ReactNode } from 'react';

type MeasurementSectionProps = {
  title: string;
  children: ReactNode;
};

export function MeasurementSection({ title, children }: MeasurementSectionProps) {
  return (
    <section className="measurement-section">
      <h3 className="measurement-section__title">{title}</h3>
      <div className="measurement-section__grid">{children}</div>
    </section>
  );
}
