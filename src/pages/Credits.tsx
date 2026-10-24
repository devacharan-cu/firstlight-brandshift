import { LICENCES, PANORAMAS, PHOTOS, VIDEOS, type PhotoId } from '../media.gen';
import { Photo } from '../components/media';

const lic = (k: string) => LICENCES[k as keyof typeof LICENCES];

export default function Credits() {
  return (
    <div className="credits">
      <header className="pagehead">
        <div className="wrap">
          <p className="label">Photography & credits</p>
          <h1>Real photographs, honestly credited.</h1>
          <p className="pagehead__lede">
            Every image and clip on this site is a real-world capture, licensed for commercial use. None of them shows Firstlight, Kesarnagar or a
            customer: they are unrelated places, used to show what delivery work looks like. Licences were read on the source pages on 24 October
            2026.
          </p>
        </div>
      </header>

      <section className="wrap" aria-labelledby="edits-title">
        <h2 id="edits-title" className="section-title">
          What we changed
        </h2>
        <ul className="credits__edits">
          <li>All photographs and footage carry the same light grade (slightly lower saturation, a little warmth) so different sources sit together.</li>
          <li>One photograph (the loading-bay door) has a phone number and a fleet ID on a truck blurred.</li>
          <li>Video clips are trimmed and cross-faded into seamless loops. No clip is presented as continuous with another.</li>
        </ul>
      </section>

      <section className="wrap" aria-labelledby="photos-title">
        <h2 id="photos-title" className="section-title">
          Photographs
        </h2>
        <ul className="credits__grid">
          {(Object.keys(PHOTOS) as PhotoId[]).map((id) => {
            const p = PHOTOS[id];
            return (
              <li key={id} className="credits__item">
                <Photo id={id} sizes="(min-width: 1080px) 25vw, 50vw" />
                <p className="credits__alt">{p.alt}</p>
                <p className="mono credits__meta">
                  <a href={p.page} target="_blank" rel="noopener noreferrer">
                    {p.credit}
                  </a>{' '}
                  ·{' '}
                  <a href={lic(p.licence).url} target="_blank" rel="noopener noreferrer">
                    {lic(p.licence).name}
                  </a>
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="wrap" aria-labelledby="video-title">
        <h2 id="video-title" className="section-title">
          Footage and 360°
        </h2>
        <ul className="credits__list">
          {Object.entries(VIDEOS).map(([id, v]) => (
            <li key={id}>
              <p className="credits__alt">{v.alt}</p>
              <p className="mono credits__meta">
                Video ·{' '}
                <a href={v.page} target="_blank" rel="noopener noreferrer">
                  {v.credit}
                </a>{' '}
                · {lic(v.licence).name} · loop of {v.seconds} s
              </p>
            </li>
          ))}
          {Object.entries(PANORAMAS).map(([id, p]) => (
            <li key={id}>
              <p className="credits__alt">{p.alt}</p>
              <p className="mono credits__meta">
                360° photograph ·{' '}
                <a href={p.page} target="_blank" rel="noopener noreferrer">
                  {p.credit}
                </a>{' '}
                · {lic(p.licence).name}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="wrap credits__type" aria-labelledby="type-title">
        <h2 id="type-title" className="section-title">
          Type and code
        </h2>
        <p className="section-lede">
          Overpass and Overpass Mono, SIL Open Font License, self-hosted. The city, its map, the routing engine and every interface were designed and
          built for this site by BrandShift.
        </p>
      </section>
    </div>
  );
}
