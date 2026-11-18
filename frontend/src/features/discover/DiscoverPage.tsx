import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Search, Sparkles, X } from 'lucide-react';
import { useGetFacetsQuery, useGetLibraryStatusQuery, useImportLibraryMutation, useSearchLibraryQuery } from '../../app/api';
import { Button, Card, EmptyState, Skeleton, SourceBadge, cx } from '../../shared/ui';
import RecipeCard from '../kitchen/RecipeCard';
import RecipeIdeas from '../kitchen/RecipeIdeas';

const SUGGESTIONS = ['cosy soup for a rainy day', 'quick vegetarian dinner', 'spicy Indian curry', 'something with chicken and rice', 'light summer salad', 'chocolate dessert'];

function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** One-time download of the recipe library (photos + RAG knowledge base), with progress. */
function LibraryBanner() {
  const [polling, setPolling] = useState(false);
  const { data: status } = useGetLibraryStatusQuery(undefined, { pollingInterval: polling ? 3000 : 0 });
  const [start] = useImportLibraryMutation();
  useEffect(() => { if (status) setPolling(status.running); }, [status]);
  if (!status || (status.total > 0 && !status.running && status.embeddedTotal >= status.total * 0.95)) return null;

  const busy = status.running;
  return (
    <Card className="paper-grain mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="font-display text-lg font-semibold text-ink">{status.total ? 'Finishing your cookbook' : 'Load the cookbook library'}</p>
        <p className="text-sm text-slate-600">
          {busy
            ? `Imported ${status.saved} recipes${status.embedded ? `, made ${status.embedded} searchable by meaning` : ''}… (about a minute per 90 recipes on the free Gemini tier)`
            : status.total
              ? `${status.total} recipes loaded, ${status.embeddedTotal} searchable by meaning. Resume to index the rest.`
              : '~800 real recipes with photos from TheMealDB. They power Discover and the Sous-chef\'s answers.'}
        </p>
      </div>
      <Button variant={busy ? 'secondary' : 'primary'} icon={Download} loading={busy} onClick={() => { start(); setPolling(true); }}>
        {busy ? 'Working…' : status.total ? 'Resume' : 'Load recipes'}
      </Button>
    </Card>
  );
}

export default function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const cuisine = params.get('cuisine') ?? '';
  const category = params.get('category') ?? '';
  const q = useDebounced(query.trim());
  const { data: facets } = useGetFacetsQuery();
  const { data, isFetching } = useSearchLibraryQuery({ q, cuisine, category });

  const setFilter = (key: 'cuisine' | 'category', value: string) => {
    const next = new URLSearchParams(params);
    if (!value || next.get(key) === value) next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };
  const chip = (active: boolean) => cx('shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition', active ? 'border-ink bg-ink text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300');

  return (
    <div>
      <section className="paper-grain relative mb-8 overflow-hidden rounded-3xl bg-ink px-6 py-10 sm:px-10">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-gradient-to-br from-saffron-400/40 to-brand-600/30 blur-3xl" />
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-saffron-400"><Sparkles className="size-3.5" />Search by meaning</p>
        <h1 className="mt-2 max-w-2xl font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">What are you craving?</h1>
        <div className="relative mt-6 max-w-2xl">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder='Describe it: "something warm and comforting", "high protein lunch"…'
            className="h-14 w-full rounded-2xl bg-white pl-12 pr-12 text-sm text-ink shadow-xl outline-none ring-saffron-400 focus:ring-2" />
          {query && <button onClick={() => setQuery('')} aria-label="Clear" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"><X className="size-4" /></button>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => <button key={s} onClick={() => setQuery(s)} className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/20">{s}</button>)}
        </div>
      </section>

      <LibraryBanner />

      {facets && (facets.cuisines.length > 0 || facets.categories.length > 0) && (
        <div className="mb-6 space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {facets.categories.map(c => <button key={c.name} onClick={() => setFilter('category', c.name)} className={chip(category === c.name)}>{c.name}</button>)}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {facets.cuisines.map(c => <button key={c.name} onClick={() => setFilter('cuisine', c.name)} className={chip(cuisine === c.name)}>{c.name}</button>)}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {q ? <>Best matches for <b className="text-ink">“{q}”</b></> : 'Ranked by what you have at home, what expires soon and your diet'}
          {data?.semantic && <span className="ml-1">· semantic search</span>}
        </p>
        <SourceBadge source={data?.source} />
      </div>

      {isFetching && !data ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="aspect-[5/4] rounded-2xl" />)}</div>
      ) : !data || data.data.length === 0 ? (
        <Card><EmptyState icon={Search} title="Nothing matches yet" text="Try other words, clear the filters, or load the cookbook library above." /></Card>
      ) : (
        <div className={cx('grid gap-5 sm:grid-cols-2 lg:grid-cols-3 transition-opacity', isFetching && 'opacity-60')}>
          {data.data.map(m => <RecipeCard key={m.recipeId} match={m} />)}
        </div>
      )}

      <div className="mt-12"><RecipeIdeas /></div>
    </div>
  );
}
