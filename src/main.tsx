/**
 * main.tsx — the entry point. Vite loads this file from index.html.
 * It imports the global styles and mounts <App /> into <div id="root">.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element in index.html');

// StrictMode runs extra checks in development (e.g. mounting twice to catch missing cleanups).
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
