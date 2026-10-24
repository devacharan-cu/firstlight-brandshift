import { useEffect, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

/**
 * A small History-API router. Routes are plain paths; parameters travel in the query string
 * (e.g. /app/fleet?van=3) so every page can be prerendered to its own static file and opened
 * directly on any static host. Navigation uses View Transitions where the browser supports them.
 */

export interface Location {
  path: string;
  search: URLSearchParams;
  hash: string;
}

function read(): Location {
  if (typeof window === 'undefined') return { path: serverPath, search: new URLSearchParams(), hash: '' };
  return {
    path: normalise(window.location.pathname),
    search: new URLSearchParams(window.location.search),
    hash: window.location.hash.slice(1),
  };
}

export function normalise(p: string): string {
  let path = p.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

let serverPath = '/';
/** Used by the prerenderer to render a specific route outside the browser. */
export function setServerPath(p: string) {
  serverPath = p;
  current = read();
}

let current: Location = read();
const listeners = new Set<() => void>();
const emit = () => {
  current = read();
  listeners.forEach((l) => l());
};

if (typeof window !== 'undefined') window.addEventListener('popstate', emit);

export function useLocation(): Location {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
}

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

type DocWithVT = Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };

export function navigate(to: string, opts: { replace?: boolean; keepScroll?: boolean } = {}) {
  const url = new URL(to, window.location.href);
  if (url.origin !== window.location.origin) {
    window.location.href = to;
    return;
  }
  const samePage = normalise(url.pathname) === current.path;
  const apply = () => {
    if (opts.replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    emit();
    if (opts.keepScroll) return;
    if (url.hash) {
      // wait a frame so the new page has rendered its anchors
      requestAnimationFrame(() => document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView());
    } else if (!samePage) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  };
  const doc = document as DocWithVT;
  if (!samePage && doc.startViewTransition && !reducedMotion()) doc.startViewTransition(apply);
  else apply();
}

/** Internal link: client-side navigation with normal fallbacks (new tab, modifiers, external). */
export function Link({
  to,
  children,
  replace,
  keepScroll,
  onClick,
  ...rest
}: { to: string; replace?: boolean; keepScroll?: boolean; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (rest.target && rest.target !== '_self') return;
    const url = new URL(to, window.location.href);
    if (url.origin !== window.location.origin) return;
    e.preventDefault();
    navigate(to, { replace, keepScroll });
  };
  const loc = useLocation();
  const target = normalise(new URL(to, 'http://x' + loc.path).pathname);
  const isCurrent = target === loc.path && !to.includes('#');
  return (
    <a href={to} onClick={handle} aria-current={isCurrent ? 'page' : undefined} {...rest}>
      {children}
    </a>
  );
}

/** Sets document title / description per page. */
export function useDocumentMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = title;
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
}
