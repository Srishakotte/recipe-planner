import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CalendarPlus, Clock3, Database, RotateCcw, Search, Sparkles, UtensilsCrossed, Wand2 } from 'lucide-react';
import {
  useGetDinnerPickQuery, useGetMealPlanQuery, useGetPantryQuery, useRecommendRecipesQuery,
  useReseedDataMutation, useResetDataMutation, type RecipeMatch,
} from '../../../app/api';
import { daysUntil, formatDay, relativeDay, todayIso, weekStartOf, addDays, datePart } from '../../../shared/dates';
import { Badge, Button, Card, CardHeader, EmptyState, Input, PageHeader, Skeleton, SourceBadge, cx } from '../../../shared/ui';
import { errorMessage, toast } from '../../../shared/components/Toast';
import PlanMealModal, { type PlanTarget } from '../../kitchen/PlanMealModal';
import RecipeFixModal from '../../kitchen/RecipeFixModal';
import RecipeMatchCard from '../../kitchen/RecipeMatchCard';
import RecipeIdeas from '../../kitchen/RecipeIdeas';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

function useDebounced<T>(value: T, ms = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const t = setTimeout(() => setDebounced(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return debounced;
}

const toTarget = (m: RecipeMatch): PlanTarget => ({ recipeId: m.recipeId, name: m.name, defaultServings: m.defaultServings });

function DinnerCard({ onPlan, onFix }: { onPlan: (m: RecipeMatch) => void; onFix: (m: RecipeMatch) => void }) {
  const { data, isLoading } = useGetDinnerPickQuery();
  const pick = data?.data.pick;

  return (
    <Card className="overflow-hidden lg:col-span-2">
      <div className="bg-gradient-to-br from-brand-600 to-emerald-700 p-6 text-white">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-100"><UtensilsCrossed className="size-4" /> What's for dinner?</p>
          {data?.source === 'ai' && <span className="flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 text-[11px]"><Sparkles className="size-3" />AI</span>}
        </div>
        {isLoading ? <Skeleton className="mt-3 h-8 w-2/3 bg-white/20" /> : pick ? (
          <>
            <h2 className="mt-2 text-2xl font-semibold">{pick.name}</h2>
            <p className="mt-1 max-w-xl text-sm text-emerald-50">{data!.data.pitch}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" icon={CalendarPlus} onClick={() => onPlan(pick)} className="border-0">Plan for tonight</Button>
              {(pick.missing.length > 0 || pick.conflicts.length > 0) &&
                <Button variant="ghost" icon={Wand2} onClick={() => onFix(pick)} className="text-white hover:bg-white/15 hover:text-white">Fix with swaps</Button>}
            </div>
          </>
        ) : <p className="mt-2 text-sm text-emerald-50">{data?.data.pitch}</p>}
      </div>
      {pick && (
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-slate-500">You have</p>
            <p className="mt-1 text-sm text-slate-700">{pick.have.join(', ') || 'nothing yet'}</p>
            {pick.missing.length > 0 && <>
              <p className="mt-3 text-xs font-medium text-slate-500">You need</p>
              <p className="mt-1 text-sm text-slate-700">{pick.missing.join(', ')}</p>
            </>}
          </div>
          {data!.data.alternatives.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500">Or try</p>
              <div className="mt-1 space-y-1.5">
                {data!.data.alternatives.map(a => (
                  <button key={a.recipeId} onClick={() => onPlan(a)} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-brand-200 hover:bg-brand-50">
                    <span className="font-medium text-slate-800">{a.name}</span>
                    <span className="text-xs text-slate-500">{a.have.length}/{a.have.length + a.missing.length}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function UseSoonCard() {
  const { data: pantry = [], isLoading } = useGetPantryQuery();
  const soon = pantry
    .filter(p => p.expirationDate && daysUntil(p.expirationDate) >= 0 && daysUntil(p.expirationDate) <= 3)
    .sort((a, b) => daysUntil(a.expirationDate!) - daysUntil(b.expirationDate!));

  return (
    <Card>
      <CardHeader icon={Clock3} title="Use soon" subtitle="Expiring in the next 3 days" action={<Link to="/pantry" className="text-xs font-medium text-brand-700 hover:underline">Pantry</Link>} />
      {isLoading ? <div className="space-y-2 p-5"><Skeleton className="h-5" /><Skeleton className="h-5" /></div> : soon.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">Nothing is about to expire.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {soon.map(p => {
            const days = daysUntil(p.expirationDate!);
            return (
              <li key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="font-medium capitalize text-slate-800">{p.name}</span>
                <span className="flex items-center gap-2 text-xs text-slate-500">{p.quantity} {p.unit}
                  <Badge tone={days <= 1 ? 'red' : 'amber'}>{relativeDay(days)}</Badge></span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function WeekStrip() {
  const weekStart = weekStartOf();
  const { data: meals = [] } = useGetMealPlanQuery(weekStart);
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <Card>
      <CardHeader icon={CalendarDays} title="This week" action={<Link to="/meal-plan" className="text-xs font-medium text-brand-700 hover:underline">Open plan</Link>} />
      <div className="grid grid-cols-7 gap-1 p-3">
        {days.map(day => {
          const dayMeals = meals.filter(m => datePart(m.planDate) === day);
          return (
            <div key={day} className={cx('rounded-lg p-2 text-center', day === today ? 'bg-brand-50 ring-1 ring-brand-200' : day < today && 'opacity-50')}>
              <p className="text-[11px] font-medium text-slate-500">{formatDay(day, { weekday: 'short' })}</p>
              <p className={cx('text-sm font-semibold', day === today ? 'text-brand-700' : 'text-slate-800')}>{formatDay(day, { day: 'numeric' })}</p>
              <div className="mt-1 flex justify-center gap-0.5">
                {dayMeals.slice(0, 3).map(m => <span key={m.id} title={`${m.mealSlot}: ${m.recipe.name}`} className={cx('size-1.5 rounded-full', m.isLeftover ? 'bg-amber-400' : 'bg-brand-500')} />)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-slate-100 px-5 py-3">
        <p className="text-xs font-medium text-slate-500">Today</p>
        {meals.filter(m => datePart(m.planDate) === today).length === 0
          ? <p className="mt-1 text-sm text-slate-500">Nothing planned yet.</p>
          : meals.filter(m => datePart(m.planDate) === today).map(m => (
            <p key={m.id} className="mt-1 text-sm text-slate-700"><span className="capitalize text-slate-500">{m.mealSlot}</span> · {m.recipe.name}</p>
          ))}
      </div>
    </Card>
  );
}

function CookFromPantry({ onPlan, onFix }: { onPlan: (m: RecipeMatch) => void; onFix: (m: RecipeMatch) => void }) {
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query.trim());
  const { data, isFetching } = useRecommendRecipesQuery(debounced);
  const matches = useMemo(() => data?.data ?? [], [data]);

  return (
    <section>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Cook from your pantry</h2>
          <p className="text-sm text-slate-500">
            {data?.semantic ? 'Searching by meaning across your recipes' : 'Ranked by what you have, what expires and your diet'}
          </p>
        </div>
        <SourceBadge source={data?.source} />
      </div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input value={query} onChange={e => setQuery(e.target.value)} className="pl-9"
          placeholder='Try "something light with tomato" or "vegetarian dinner"' />
      </div>
      {isFetching && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-40" />)}</div>
      ) : matches.length === 0 ? (
        <Card><EmptyState icon={Search} title="No recipes match" text="Add recipes or try different words." action={<Link to="/recipes"><Button variant="secondary">Add a recipe</Button></Link>} /></Card>
      ) : (
        <div className={cx('grid gap-3 sm:grid-cols-2 lg:grid-cols-3 transition-opacity', isFetching && 'opacity-60')}>
          {matches.slice(0, 6).map(m => <RecipeMatchCard key={m.recipeId} match={m} onPlan={onPlan} onFix={onFix} />)}
        </div>
      )}
    </section>
  );
}

export default function HomePage() {
  const [planTarget, setPlanTarget] = useState<PlanTarget | null>(null);
  const [fixId, setFixId] = useState<string | null>(null);
  const [reset, { isLoading: resetting }] = useResetDataMutation();
  const [reseed, { isLoading: reseeding }] = useReseedDataMutation();
  const [confirmReset, setConfirmReset] = useState(false);

  const run = async (action: () => Promise<unknown>, done: string) => {
    try { await action(); toast.success(done); } catch (err) { toast.error(errorMessage(err)); }
    setConfirmReset(false);
  };

  const plan = (m: RecipeMatch) => setPlanTarget(toTarget(m));
  const fix = (m: RecipeMatch) => setFixId(m.recipeId);

  return (
    <div className="space-y-8">
      <PageHeader title={greeting()} subtitle={formatDay(todayIso(), { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={<>
          {confirmReset ? (
            <span className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
              Clear all your data?
              <Button size="sm" variant="danger" loading={resetting} onClick={() => run(() => reset().unwrap(), 'Everything cleared')}>Yes</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>No</Button>
            </span>
          ) : <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => setConfirmReset(true)}>Start fresh</Button>}
          <Button size="sm" variant="secondary" icon={Database} loading={reseeding} onClick={() => run(() => reseed().unwrap(), 'Sample data loaded')}>Load sample data</Button>
        </>} />

      <div className="grid gap-4 lg:grid-cols-3">
        <DinnerCard onPlan={m => setPlanTarget(toTarget(m))} onFix={fix} />
        <UseSoonCard />
      </div>

      <WeekStrip />
      <CookFromPantry onPlan={plan} onFix={fix} />
      <RecipeIdeas />

      <PlanMealModal target={planTarget} onClose={() => setPlanTarget(null)} />
      <RecipeFixModal recipeId={fixId} onClose={() => setFixId(null)} />
    </div>
  );
}
