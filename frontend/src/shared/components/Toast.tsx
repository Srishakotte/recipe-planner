import { useEffect, useState } from 'react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

let toastListeners: ((toast: ToastMessage) => void)[] = [];

export function showToast(message: string, type: ToastMessage['type'] = 'info') {
  const toast: ToastMessage = { id: Date.now().toString(), message, type };
  toastListeners.forEach(fn => fn(toast));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (toast: ToastMessage) => {
      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 4000);
    };
    toastListeners.push(listener);
    return () => { toastListeners = toastListeners.filter(l => l !== listener); };
  }, []);

  if (toasts.length === 0) return null;

  const icons = { success: '✓', info: 'ℹ', warning: '⚠', error: '✕' };
  const colors = {
    success: 'bg-green-600 dark:bg-green-700',
    info: 'bg-blue-600 dark:bg-blue-700',
    warning: 'bg-amber-500 dark:bg-amber-600',
    error: 'bg-red-600 dark:bg-red-700',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`${colors[toast.type]} text-white px-4 py-3 rounded-xl shadow-lg text-sm max-w-sm flex items-center gap-2 animate-[slideIn_0.3s_ease-out]`}
        >
          <span className="text-lg">{icons[toast.type]}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
