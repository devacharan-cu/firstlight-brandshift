import { useEffect } from 'react';
import { DispatchSheet } from './DispatchSheet';
import { WhyHard } from './WhyHard';
import { Driver } from './Driver';
import { Disruption } from './Disruption';
import { Tracking } from './Tracking';
import { DayReport } from './DayReport';
import { Pricing } from './Pricing';
import { HowItWorks } from './HowItWorks';
import { Closing } from './Closing';

/** Everything below the hero. Loaded as its own chunk so the first viewport is interactive sooner. */
export default function Chapters() {
  useEffect(() => {
    // The chapters arrive after the browser has handled the URL hash, so honour deep links here.
    // Content above the target keeps growing as plan data arrives, so re-anchor while the layout
    // settles — and stop as soon as the visitor scrolls on their own.
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    let userMoved = false;
    const stop = () => (userMoved = true);
    const opts = { passive: true } as const;
    window.addEventListener('wheel', stop, opts);
    window.addEventListener('touchstart', stop, opts);
    window.addEventListener('keydown', stop);
    const anchor = () => !userMoved && target.scrollIntoView({ behavior: 'instant' });
    anchor();
    const ro = new ResizeObserver(anchor);
    ro.observe(document.body);
    const done = window.setTimeout(() => ro.disconnect(), 2500);
    return () => {
      ro.disconnect();
      window.clearTimeout(done);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('keydown', stop);
    };
  }, []);

  return (
    <>
      <DispatchSheet />
      <WhyHard />
      <Driver />
      <Disruption />
      <Tracking />
      <DayReport />
      <Pricing />
      <HowItWorks />
      <Closing />
    </>
  );
}
