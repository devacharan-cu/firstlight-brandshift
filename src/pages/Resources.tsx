import { Link } from '../router';
import { Photo } from '../components/media';
import { GUIDES } from './guides/list';
import type { PhotoId } from '../media.gen';

export default function Resources() {
  return (
    <div className="resources">
      <header className="pagehead">
        <div className="wrap">
          <p className="label">Resources</p>
          <h1>Practical reading for people who plan deliveries.</h1>
          <p className="pagehead__lede">
            Short guides for dispatchers and operations leads. Each one works on the simulated day in this browser, so the numbers in the article are
            the ones in your plan.
          </p>
        </div>
      </header>
      <section className="wrap" aria-label="Guides">
        <ul className="guides">
          {GUIDES.map((g, i) => (
            <li key={g.slug}>
              <Link to={`/resources/${g.slug}`} className="guide">
                <Photo id={g.photo as PhotoId} sizes="(min-width: 1080px) 33vw, 100vw" />
                <span className="guide__meta mono">
                  Guide {String(i + 1).padStart(2, '0')} · {g.minutes} min
                </span>
                <span className="guide__title">{g.title}</span>
                <span className="guide__dek">{g.dek}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="wrap platform__cta">
        <h2 className="section-title">Or learn by doing.</h2>
        <p className="section-lede">The console is the fastest way to understand route planning: change something and watch the numbers move.</p>
        <div className="hero-field__ctas">
          <Link className="btn btn--primary" to="/app/planner">
            Open the planner
          </Link>
          <Link className="btn btn--quiet" to="/engine">
            How the engine works
          </Link>
        </div>
      </section>
    </div>
  );
}
