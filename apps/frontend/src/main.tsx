import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function App() {
  const [status, setStatus] = useState('Sprawdzanie połączenia…');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('API niedostępne');
        const data: unknown = await response.json();
        if (typeof data !== 'object' || data === null || !('status' in data) || data.status !== 'ok') {
          throw new Error('Nieprawidłowa odpowiedź API');
        }
        setStatus('Backend działa');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('Brak połączenia z backendem');
      });
    return () => controller.abort();
  }, []);

  return (
    <main>
      <p className="eyebrow">React + TypeScript + Express</p>
      <h1>Projektowanie aplikacji</h1>
      <p>Środowisko gotowe do pracy.</p>
      <p role="status">{status}</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
