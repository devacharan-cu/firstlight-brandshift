import '@fontsource/overpass/latin-400.css';
import '@fontsource/overpass/latin-600.css';
import '@fontsource/overpass/latin-800.css';
import '@fontsource/overpass-mono/latin-400.css';
import '@fontsource/overpass-mono/latin-600.css';
import './styles/app.css';
import './styles/chapters.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// The prerendered HTML paints first; React takes over after that frame.
const boot = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
requestAnimationFrame(() => setTimeout(boot, 0));
