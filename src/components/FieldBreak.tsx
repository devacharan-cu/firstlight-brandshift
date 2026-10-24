import type { ReactNode } from 'react';
import { Credit, Loop, Photo } from './media';
import type { PhotoId, VideoId } from '../media.gen';

/**
 * A full-bleed photographic interlude between chapters. Each break is its own photograph or clip,
 * labelled as a plate; the edit is a cut between different places, never a pretend camera move.
 */
export function FieldBreak({
  photo,
  video,
  no,
  time,
  title,
  clock,
  children,
}: {
  photo?: PhotoId;
  video?: VideoId;
  no: string;
  time: string;
  title: string;
  clock: string;
  children: ReactNode;
}) {
  return (
    <section className="fieldbreak" data-clock={clock} aria-label={`${time}: ${title}`}>
      <div className="fieldbreak__media">
        {video ? <Loop id={video} controlsLabel="footage" /> : photo ? <Photo id={photo} sizes="100vw" /> : null}
      </div>
      <div className="fieldbreak__scrim" aria-hidden />
      <div className="wrap fieldbreak__content">
        <p className="fieldbreak__time mono">
          <span>Pl. {no}</span>
          {time}
        </p>
        <p className="fieldbreak__title">{title}</p>
        <p className="fieldbreak__text">{children}</p>
        {video ? <Credit kind="video" id={video} /> : photo ? <Credit kind="photo" id={photo} /> : null}
      </div>
    </section>
  );
}
