import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { Camera, CornerDownLeft, Link2, Search } from 'lucide-react';
import { useSearchLibraryQuery } from '../../app/api';
import { NAV } from './nav';
import { RecipeImage } from './RecipeVisuals';

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** ⌘K / Ctrl+K: jump to any page, run an action, or find a recipe in the cookbook. */
export default function CommandPalette({ open, onOpenChange, onAskChef }: { open: boolean; onOpenChange: (o: boolean) => void; onAskChef: (q?: string) => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim());
  const { data: recipes, isFetching } = useSearchLibraryQuery({ q }, { skip: !open || q.length < 2 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); onOpenChange(!open); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const go = (fn: () => void) => { fn(); onOpenChange(false); setQuery(''); };
  const item = 'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 data-[selected=true]:bg-slate-100 data-[selected=true]:text-ink';

  return (
    <Command.Dialog open={open} onOpenChange={onOpenChange} label="Command menu" shouldFilter={false}
      overlayClassName="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4">
        <Search className="size-4 text-slate-400" />
        <Command.Input value={query} onValueChange={setQuery} autoFocus placeholder="Search recipes, pages, or ask the sous-chef…"
          className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
        <kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500">ESC</kbd>
      </div>
      <Command.List className="max-h-[60vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-slate-500">{isFetching ? 'Searching the cookbook…' : 'No matches.'}</Command.Empty>
        {query.trim() && (
          <Command.Group heading="Sous-chef" className="text-[11px] font-medium uppercase tracking-wide text-slate-400 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
            <Command.Item value="ask" onSelect={() => go(() => onAskChef(query))} className={item}>
              <span className="ai-orb inline-flex size-6 overflow-hidden rounded-full" /> Ask “{query}”
              <CornerDownLeft className="ml-auto size-3.5 text-slate-400" />
            </Command.Item>
          </Command.Group>
        )}
        {recipes && recipes.data.length > 0 && (
          <Command.Group heading="Recipes" className="text-[11px] font-medium uppercase tracking-wide text-slate-400 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
            {recipes.data.slice(0, 6).map(r => (
              <Command.Item key={r.recipeId} value={`recipe-${r.recipeId}`} onSelect={() => go(() => navigate(`/recipes/${r.recipeId}`))} className={item}>
                <RecipeImage src={r.imageUrl} name={r.name} className="size-9 rounded-lg" />
                <span className="min-w-0 flex-1 truncate normal-case">{r.name}</span>
                <span className="text-xs normal-case text-slate-400">{r.cuisine}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        <Command.Group heading="Actions" className="text-[11px] font-medium uppercase tracking-wide text-slate-400 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
          <Command.Item value="scan" onSelect={() => go(() => navigate('/pantry?scan=1'))} className={item}><Camera className="size-4" /> Scan fridge or receipt</Command.Item>
          <Command.Item value="import" onSelect={() => go(() => navigate('/recipes?import=1'))} className={item}><Link2 className="size-4" /> Import a recipe from a link</Command.Item>
        </Command.Group>
        <Command.Group heading="Go to" className="text-[11px] font-medium uppercase tracking-wide text-slate-400 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
          {NAV.flatMap(g => g.items).filter(n => !query || n.label.toLowerCase().includes(query.toLowerCase())).map(({ to, label, icon: Icon }) => (
            <Command.Item key={to} value={`nav-${to}`} onSelect={() => go(() => navigate(to))} className={item}><Icon className="size-4" /> {label}</Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
