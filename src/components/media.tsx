import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { LICENCES, PHOTOS, VIDEOS, type PhotoId, type VideoId } from '../media.gen';
import { useReducedMotion } from '../lib/hooks';

const BASE = '/media/';

function srcset(id: string, widths: readonly number[], ext: 'avif' | 'webp') {
  return widths.map((w) => `${BASE}${id}-${w}.${ext} ${w}w`).join(', ');
}

/**
 * A real photograph from the asset manifest: AVIF with WebP fallback at several widths,
 * intrinsic dimensions to prevent layout shift, and a blurred placeholder while it loads.
 */
export function Photo({
  id,
  sizes = '100vw',
  priority = false,
  className = '',
  focus,
  alt,
  style,
}: {
  id: PhotoId;
  sizes?: string;
  priority?: boolean;
  className?: string;
  focus?: string;
  alt?: string;
  style?: CSSProperties;
}) {
  const p = PHOTOS[id];
  const largest = p.widths[p.widths.length - 1];
  return (
    <picture className={`photo ${className}`} style={{ backgroundImage: `url(${p.lqip})`, ...style }}>
      <source type="image/avif" srcSet={srcset(id, p.widths, 'avif')} sizes={sizes} />
      <img
        src={`${BASE}${id}-${p.widths[Math.min(1, p.widths.length - 1)]}.webp`}
        srcSet={srcset(id, p.widths, 'webp')}
        sizes={sizes}
        width={largest}
        height={Math.round((p.height / p.width) * largest)}
        alt={alt ?? p.alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        style={{ objectPosition: focus ?? p.focus }}
      />
    </picture>
  );
}

const saveData = () =>
  typeof navigator !== 'undefined' && (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

/**
 * A seamless video loop with an honest fallback chain: poster first, video only when visible,
 * mobile encode on small screens, no autoplay under reduced motion or Save-Data, and a visible
 * pause control (motion longer than five seconds must be pausable).
 */
export function Loop({
  id,
  className = '',
  priority = false,
  controlsLabel,
}: {
  id: VideoId;
  className?: string;
  priority?: boolean;
  controlsLabel?: string;
}) {
  const v = VIDEOS[id];
  const reduced = useReducedMotion();
  const ref = useRef<HTMLVideoElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(priority);
  const [userPaused, setUserPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const allowed = !reduced && !saveData();

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => setVisible(es.some((e) => e.isIntersecting)), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || src) return;
    const small = matchMedia('(max-width: 900px)').matches;
    setSrc(`${BASE}${id}-${small ? 'mobile' : 'desktop'}.mp4`);
  }, [visible, src, id]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    if (visible && allowed && !userPaused) video.play().catch(() => setPlaying(false));
    else video.pause();
  }, [visible, allowed, userPaused, src]);

  return (
    <div ref={wrap} className={`loop ${className}`}>
      <picture className="loop__poster" style={{ backgroundImage: `url(${v.lqip})` }}>
        <source media="(max-width: 900px)" srcSet={`${BASE}${id}-poster-960.webp`} />
        <img
          src={`${BASE}${id}-poster-1600.webp`}
          alt={v.alt}
          width={1600}
          height={900}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
        />
      </picture>
      {src && (
        <video
          ref={ref}
          className={`loop__video ${playing ? 'is-playing' : ''}`}
          src={src}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
          onPlaying={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => setPlaying(false)}
        />
      )}
      {allowed && (
        <button
          className="loop__toggle"
          onClick={() => setUserPaused((p) => !p)}
          aria-pressed={userPaused}
          aria-label={userPaused ? `Play ${controlsLabel ?? 'background video'}` : `Pause ${controlsLabel ?? 'background video'}`}
        >
          {userPaused ? '▶' : '❚❚'}
        </button>
      )}
    </div>
  );
}

export function Credit({ kind, id }: { kind: 'photo' | 'video'; id: PhotoId | VideoId }) {
  const m = kind === 'photo' ? PHOTOS[id as PhotoId] : VIDEOS[id as VideoId];
  return (
    <span className="credit">
      {kind === 'photo' ? 'Photograph' : 'Footage'}:{' '}
      <a href={m.page} target="_blank" rel="noopener noreferrer">
        {m.credit}
      </a>{' '}
      · {LICENCES[m.licence as keyof typeof LICENCES].name}
    </span>
  );
}

/** An editorial photographic plate: registration marks, a number, a title and a credit. */
export function Plate({
  id,
  no,
  title,
  sizes = '(min-width: 1080px) 50vw, 100vw',
  className = '',
  ratio,
  children,
}: {
  id: PhotoId;
  no: string;
  title: string;
  sizes?: string;
  className?: string;
  ratio?: string;
  children?: ReactNode;
}) {
  return (
    <figure className={`plate ${className}`} style={ratio ? ({ '--ratio': ratio } as CSSProperties) : undefined}>
      <div className="plate__frame">
        <Photo id={id} sizes={sizes} />
        {children}
      </div>
      <figcaption className="plate__cap">
        <span className="plate__no mono">Pl. {no}</span>
        <span className="plate__title">{title}</span>
        <Credit kind="photo" id={id} />
      </figcaption>
    </figure>
  );
}
