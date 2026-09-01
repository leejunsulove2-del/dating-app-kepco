import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error protection against Leaflet/transient unmount style reading errors
if (typeof window !== 'undefined') {
  const isStyleError = (msg?: string | null) => {
    if (!msg) return false;
    return (
      msg.includes("Cannot read properties of undefined (reading 'style')") ||
      msg.includes("reading 'style'") ||
      msg.includes("reading '_leaflet_pos'") ||
      msg.includes('Map container is being reused')
    );
  };

  window.addEventListener('error', (event) => {
    if (isStyleError(event.message) || isStyleError(event.error?.message)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isStyleError(event.reason?.message)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

