import type { ReactNode } from 'react';
import { Link } from '../../router';
import { Photo, Credit } from '../../components/media';
import type { PhotoId } from '../../media.gen';
import { GUIDES } from './list';

export function Article({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const g = GUIDES.find((x) => x.slug === slug)!;
  const others = GUIDES.filter((x) => x.slug !== slug);
  return (
    <article className="article">
      <header className="article__head">
        <div className="wrap article__headgrid">
          <div>
            <p className="label">
              <Link to="/resources">Resources</Link> · Guide · {g.minutes} min read
            </p>
            <h1>{g.title}</h1>
            <p className="pagehead__lede">{g.dek}</p>
          </div>
          <figure className="article__photo">
            <Photo id={g.photo as PhotoId} sizes="(min-width: 1080px) 40vw, 100vw" priority />
            <figcaption>
              <Credit kind="photo" id={g.photo as PhotoId} />
            </figcaption>
          </figure>
        </div>
      </header>
      <div className="wrap article__body prose">{children}</div>
      <aside className="wrap article__more" aria-labelledby="more-title">
        <h2 id="more-title" className="label">
          More guides
        </h2>
        <ul>
          {others.map((o) => (
            <li key={o.slug}>
              <Link to={`/resources/${o.slug}`}>
                <strong>{o.title}</strong>
                <span>{o.dek}</span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </article>
  );
}

/** A figure inside an article that shows live numbers from the visitor’s simulation. */
export function LiveBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="livebox" aria-live="polite">
      <p className="livebox__title mono">{title}</p>
      {children}
    </aside>
  );
}
