import type { ReactNode } from 'react';

export function Chapter({
  id,
  clock,
  note,
  title,
  children,
  className = '',
}: {
  id?: string;
  clock: string;
  note: string;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = `${id ?? clock.replace(':', '')}-title`;
  return (
    <section id={id} className={`chapter ${className}`} data-clock={clock} aria-labelledby={headingId}>
      <div className="wrap chapter__grid">
        <p className="chapter__time" aria-hidden>
          {clock}
          <small>{note}</small>
        </p>
        <div className="chapter__body">
          <h2 id={headingId}>{title}</h2>
          {children}
        </div>
      </div>
    </section>
  );
}
