import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { errorMessage } from '../lib/errors';

type Tone = 'info' | 'error';
type Toast = { id: number; text: string; tone: Tone };

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

const tones: Record<Tone, string> = {
  info: 'border-zinc-700 bg-zinc-800 text-zinc-100',
  error: 'border-red-900/60 bg-red-950 text-red-200',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((text: string, tone: Tone = 'info') => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { id, text, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000);
  }, []);

  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => show(errorMessage(event.reason), 'error');
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, [show]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed inset-x-4 bottom-4 z-50 space-y-2 sm:left-auto sm:w-80">
        {toasts.map((toast) => (
          <p
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${tones[toast.tone]}`}
          >
            {toast.text}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
