/**
 * The app's component kit. Pages compose these instead of repeating long class strings,
 * so the look stays consistent and changes happen in one place.
 */
import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Loader2, Sparkles, X, type LucideIcon } from 'lucide-react';

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');
export { cx };

// ---------------------------------------------------------------- Button

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai';
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
  secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ai: 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  icon?: LucideIcon;
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', icon: Icon, loading, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        buttonVariants[variant], className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon && <Icon className="size-4" />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, label, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button {...props} aria-label={label} title={label}
      className={cx('inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-40', className)}>
      <Icon className="size-4" />
    </button>
  );
}

/** Delete-style action that asks "Sure?" inline instead of a browser popup. */
export function ConfirmButton({ onConfirm, label = 'Delete', icon }: { onConfirm: () => void | Promise<unknown>; label?: string; icon: LucideIcon }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <IconButton icon={icon} label={label} onClick={() => setAsking(true)} className="hover:text-red-600 hover:bg-red-50" />;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="text-slate-500">Sure?</span>
      <button className="rounded-md bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700" onClick={async () => { await onConfirm(); setAsking(false); }}>Yes</button>
      <button className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={() => setAsking(false)}>No</button>
    </span>
  );
}

// ---------------------------------------------------------------- Layout pieces

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cx('rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]', className)}>{children}</div>;
}

export function CardHeader({ title, icon: Icon, subtitle, action }: { title: ReactNode; icon?: LucideIcon; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Icon className="size-4" /></span>}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon className="size-6" /></span>
      <p className="mt-4 text-sm font-medium text-slate-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <Loader2 className="size-5 animate-spin text-brand-600" />{label}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-slate-100', className)} />;
}

export function Stat({ label, value, icon: Icon, tone = 'slate' }: { label: string; value: ReactNode; icon: LucideIcon; tone?: Tone }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className={cx('flex size-9 items-center justify-center rounded-lg', toneClasses[tone])}><Icon className="size-4" /></span>
        <div>
          <p className="text-xl font-semibold text-slate-900 leading-tight">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Badges

type Tone = 'slate' | 'green' | 'amber' | 'red' | 'violet' | 'blue';
const toneClasses: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-600',
  green: 'bg-brand-50 text-brand-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  violet: 'bg-violet-50 text-violet-700',
  blue: 'bg-sky-50 text-sky-700',
};

export function Badge({ tone = 'slate', icon: Icon, children, title }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium', toneClasses[tone])}>
      {Icon && <Icon className="size-3" />}{children}
    </span>
  );
}

/** Shows whether a result came from Gemini or from the built-in logic. */
export function SourceBadge({ source }: { source?: 'ai' | 'fallback' }) {
  if (!source) return null;
  return source === 'ai'
    ? <Badge tone="violet" icon={Sparkles} title="Generated with Gemini">AI</Badge>
    : <Badge tone="slate" title="Built-in logic (add a Gemini key for AI)">Basic</Badge>;
}

// ---------------------------------------------------------------- Form controls

const fieldClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(fieldClass, className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(fieldClass, 'pr-8', className)}>{children}</select>;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(fieldClass, 'h-auto min-h-20 py-2', className)} />;
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------- Overlays

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div onMouseDown={e => e.stopPropagation()} role="dialog" aria-label={title}
        className={cx('animate-fade-in flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={cx('rounded-md px-3 py-1.5 text-xs font-medium transition-colors', value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
