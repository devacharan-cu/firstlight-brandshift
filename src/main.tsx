import '@fontsource-variable/geist/index.css';
import '@fontsource-variable/geist-mono/index.css';
import './styles/app.css';
import './styles/chapters.css';
import './styles/site.css';
import './styles/console.css';
import './styles/story.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { normalise, setPreloader } from './router';
import { preload } from './routes';

setPreloader(preload);

// The prerendered HTML paints first; React takes over once this page's chunk has loaded.
const boot = async () => {
  try {
    await preload(normalise(window.location.pathname));
  } catch {
    /* the app still renders and shows the page's loading state */
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};
requestAnimationFrame(() => setTimeout(boot, 0));
