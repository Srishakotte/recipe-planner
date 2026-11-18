import { useState } from 'react';
import { ChefHat, Sparkles } from 'lucide-react';
import { cx } from '../ui';

const TILES = ['from-saffron-100 to-brand-100', 'from-herb-50 to-saffron-100', 'from-brand-50 to-[#f3e1ec]', 'from-slate-100 to-saffron-100'];
const tileFor = (name: string) => TILES[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TILES.length];

/** Recipe photo with a warm illustrated fallback when there is no image (or it fails to load). */
export function RecipeImage({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} className={cx('object-cover', className)} />;
  }
  return (
    <div className={cx('flex items-center justify-center bg-gradient-to-br', tileFor(name), className)} aria-label={name}>
      <ChefHat className="size-1/4 max-h-12 max-w-12 text-slate-400/70" />
    </div>
  );
}

/** The glowing mark used for everything AI. */
export function AiOrb({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'sm' ? 'size-7' : size === 'lg' ? 'size-14' : 'size-9';
  const icon = size === 'sm' ? 'size-3.5' : size === 'lg' ? 'size-6' : 'size-4';
  return (
    <span className={cx('ai-orb inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-white', box)}>
      <Sparkles className={icon} />
    </span>
  );
}

/** Ring showing how much of a recipe your pantry covers. */
export function CoverageRing({ coverage, label }: { coverage: number; label?: string }) {
  const pct = Math.round(coverage * 100);
  const r = 15, c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex size-10 items-center justify-center" title={label ?? `You have ${pct}% of the ingredients`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke="#f4b740" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
      </svg>
      <span className="text-[10px] font-semibold text-white">{pct}%</span>
    </span>
  );
}
