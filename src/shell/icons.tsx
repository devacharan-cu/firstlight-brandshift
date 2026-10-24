/** A small set of line icons drawn for the console (24px grid, 1.6 stroke, currentColor). */
const paths: Record<string, string> = {
  tower: 'M12 3v18M7 21h10M9 7h6M8 11h8M5 3l3 4M19 3l-3 4',
  planner: 'M4 18c3-6 5 2 8-4s5 2 8-6M4 6h3M17 18h3',
  fleet: 'M3 14V7h11v7M14 10h4l3 3v1H14M6.5 17.5a1.5 1.5 0 1 0 0-.1M17.5 17.5a1.5 1.5 0 1 0 0-.1M3 14h18',
  dispatch: 'M4 5h16v14H4zM8 9h8M8 13h5M16 15l2 2 3-4',
  driver: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2M9 7h6M9 10h4',
  track: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  disruption: 'M12 3l9 16H3zM12 10v4M12 17v.5',
  reports: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4',
  back: 'M10 6l-6 6 6 6M4 12h16',
  play: 'M7 5l12 7-12 7z',
  pause: 'M7 5h3v14H7zM14 5h3v14h-3z',
};

export function Icon({ name, size = 18 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[name] ?? ''} />
    </svg>
  );
}
