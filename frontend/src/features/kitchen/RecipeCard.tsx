import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, Bookmark, Clock3 } from 'lucide-react';
import type { RecipeMatch } from '../../app/api';
import { relativeDay } from '../../shared/dates';
import { CoverageRing, RecipeImage } from '../../shared/components/RecipeVisuals';
import { cx } from '../../shared/ui';

/** Photo card for a recipe scored against your kitchen. Opens the recipe page. */
export default function RecipeCard({ match, size = 'md' }: { match: RecipeMatch; size?: 'md' | 'lg' }) {
  const urgent = [...match.expiring].sort((a, b) => a.daysLeft - b.daysLeft)[0];
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Link to={`/recipes/${match.recipeId}`} className="group block overflow-hidden rounded-2xl bg-white shadow-[0_8px_24px_-12px_rgba(28,24,20,0.25)] ring-1 ring-slate-200/70">
        <div className={cx('relative overflow-hidden', size === 'lg' ? 'aspect-[4/3]' : 'aspect-[5/4]')}>
          <RecipeImage src={match.imageUrl} name={match.name} className="size-full transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
          <div className="absolute right-3 top-3 flex items-center gap-1.5">
            {match.saved && <span className="rounded-full bg-white/90 p-1.5 text-ink" title="In My recipes"><Bookmark className="size-3.5 fill-current" /></span>}
            <CoverageRing coverage={match.coverage} label={`You have ${match.have.length} of ${match.have.length + match.missing.length} ingredients`} />
          </div>
          <div className="absolute inset-x-0 bottom-0 p-4">
            {(match.cuisine || match.category) && <p className="text-[11px] font-medium uppercase tracking-wider text-saffron-100/90">{[match.cuisine, match.category].filter(Boolean).join(' · ')}</p>}
            <h3 className="mt-0.5 font-display text-lg font-semibold leading-snug text-white">{match.name}</h3>
          </div>
        </div>
        <div className="flex min-h-11 flex-wrap items-center gap-1.5 px-4 py-2.5 text-xs">
          {urgent && <span className="inline-flex items-center gap-1 rounded-full bg-saffron-100 px-2 py-0.5 font-medium text-[#8a5a10]"><Clock3 className="size-3" />{urgent.name} · {relativeDay(urgent.daysLeft)}</span>}
          {match.conflicts[0] && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700"><AlertTriangle className="size-3" />{match.conflicts[0].constraint}</span>}
          <span className="ml-auto text-slate-500">{match.missing.length === 0 ? 'You have everything' : `${match.missing.length} to buy`}</span>
        </div>
      </Link>
    </motion.div>
  );
}
