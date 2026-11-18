import { Toaster } from 'sonner';

/** Toasts are sonner's; the app calls toast.success / toast.error / toast.info / toast.warning. */
export { toast } from 'sonner';

/** Human-readable message from an RTK Query / fetch error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const data = (err as { data?: { message?: string; error?: string } })?.data;
  return data?.message || data?.error || fallback;
}

export default function ToastContainer() {
  return <Toaster position="bottom-right" richColors closeButton offset={24} toastOptions={{ style: { fontFamily: 'Inter, sans-serif' } }} />;
}
