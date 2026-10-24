import '@fontsource/overpass/latin-400.css';
import '@fontsource/overpass/latin-600.css';
import '@fontsource/overpass/latin-800.css';
import '@fontsource/overpass-mono/latin-400.css';
import '@fontsource/overpass-mono/latin-600.css';
import './styles/app.css';
import './styles/chapters.css';
import './styles/case-study.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CaseStudy } from './components/CaseStudy';

document.documentElement.style.setProperty('--paper', 'rgb(244 239 228)');
document.documentElement.style.setProperty('--paper-deep', 'rgb(234 227 212)');

// The prerendered HTML paints first; React takes over after that frame.
const boot = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <CaseStudy />
    </StrictMode>,
  );
requestAnimationFrame(() => setTimeout(boot, 0));
