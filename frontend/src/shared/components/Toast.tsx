import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';

type ToastType = 'success' | 'info' | 'warning' | 'error';
interface ToastMessage { id: number; message: string; type: ToastType }

let listeners: ((t: ToastMessage) => void)[] = [];
let nextId = 1;

function show(message: string, type: ToastType) {
  const t = { id: nextId++, message, type };
  listeners.forEach(fn => fn(t));
}

export const toast = {
  success: (message: string) => show(message, 'success'),
  info: (message: string) => show(message, 'info'),
  warning: (message: string) => show(message, 'warning'),
  error: (message: string) => show(message, 'error'),
};

/** Human-readable message from an RTK Query / fetch error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const data = (err as { data?: { message?: string; error?: string } })?.data;
  return data?.message || data?.error || fallback;
}

const styles = {
  success: { icon: CheckCircle2, className: 'text-brand-600' },
  info: { icon: Info, className: 'text-sky-600' },
  warning: { icon: AlertTriangle, className: 'text-amber-600' },
  error: { icon: XCircle, className: 'text-red-600' },
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (t: ToastMessage) => {
      setToasts(prev => [...prev.slice(-2), t]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 4000);
    };
    listeners.push(listener);
    return () => { listeners = listeners.filter(l => l !== listener); };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6" aria-live="polite">
      {toasts.map(t => {
        const { icon: Icon, className } = styles[t.type];
        return (
          <div key={t.id} className="animate-fade-in pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg">
            <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} />
            <span>{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
