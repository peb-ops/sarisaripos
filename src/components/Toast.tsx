import { CheckCircle2, CircleAlert } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Tone = 'success' | 'error';
type ToastItem = { id: number; message: ReactNode; tone: Tone };
type Push = (message: ReactNode, tone?: Tone) => void;

const ToastContext = createContext<Push>(() => {});

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback<Push>((message, tone = 'success') => {
    const id = nextId++;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl px-5 py-3 font-semibold text-white shadow-lg ${
              t.tone === 'error' ? 'bg-red-700' : 'bg-stone-900'
            }`}
          >
            {t.tone === 'error' ? <CircleAlert size={20} /> : <CheckCircle2 size={20} className="text-emerald-400" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
