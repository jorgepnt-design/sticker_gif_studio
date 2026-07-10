import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// Service Worker für Offline-Nutzung und Installation als App.
// Wichtig für iOS: installierte PWAs cachen hartnäckig – deshalb prüfen wir
// regelmäßig auf Updates und laden bei einer neuen Version automatisch neu,
// damit niemand auf einer veralteten Version hängen bleibt.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Neue Version ist bereit → sofort aktivieren und einmalig neu laden
    updateSW(true);
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    // Beim Start und danach alle 60 s nach einer neueren Version suchen
    registration.update();
    setInterval(() => registration.update(), 60 * 1000);
    // Auch beim Zurückkehren in die App (App-Wechsel auf dem Handy) prüfen
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update();
    });
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
