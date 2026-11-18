import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Camera, Clock3, Compass, Database, Link2, RotateCcw, Send, Wand2 } from 'lucide-react';
import {
  useGetDinnerPickQuery, useGetMealPlanQuery, useGetPantryQuery, useRecommendRecipesQuery,
  useReseedDataMutation, useResetDataMutation,
} from '../../../app/api';
import { addDays, datePart, daysUntil, formatDay, relativeDay, todayIso, weekStartOf } from '../../../shared/dates';
import { AiOrb, RecipeImage } from '../../../shared/components/RecipeVisuals';
import { Badge, Button, Card, CardHeader, Skeleton, cx } from '../../../shared/ui';
import { errorMessage, toast } from '../../../shared/components/Toast';
import PlanMealModal, { type PlanTarget } from '../../kitchen/PlanMealModal';
import RecipeFixModal from '../../kitchen/RecipeFixModal';
import RecipeCard from '../../kitchen/RecipeCard';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

/** Tonight's pick with a big photo: the first thing you see. */
function TonightCard({ onPlan, onFix }: { onPlan: (t: PlanTarget) => void; onFix: (id: string) => void }) {
  const { data, isLoading } = useGetDinnerPickQuery();
  const pick = data?.data.pick;
  if (isLoading) return <Skeleton className="h-80 rounded-3xl lg:col-span-2" />;
  if (!pick) return <Card className="p-8 lg:col-span-2"><p className="font-display text-xl text-ink">{data?.data.pitch}</p></Card>;
  return (
    <div className="group relative overflow-hidden rounded-3xl bg-ink lg:col-span-2">
      <RecipeImage src={pick.imageUrl} name={pick.name} className="absolute inset-0 size-full opacity-80 transition duration-700 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-transparent" />
      <div className="relative flex min-h-80 flex-col justify-end p-6 sm:p-8">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-saffron-400"><AiOrb size="sm" /> Tonight's pick{data?.source === 'ai' && ' · by Gemini'}</p>
        <Link to={`/recipes/${pick.recipeId}`} className="mt-3 max-w-lg font-display text-4xl font-semibold leading-tight text-white hover:underline">{pick.name}</Link>
        <p className="mt-2 max-w-lg text-sm text-slate-200">{data!.data.pitch}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="ai" onClick={() => onPlan({ recipeId: pick.recipeId, name: pick.name, defaultServings: pick.defaultServings })}>Plan for tonight</Button>
          {pick.missing.length > 0 && <Button variant="secondary" icon={Wand2} onClick={() => onFix(pick.recipeId)}>Swap {pick.missing.length} missing</Button>}
          {data!.data.alternatives.map(a => (
            <Link key={a.recipeId} to={`/recipes/${a.recipeId}`} className="hidden items-center rounded-full bg-white/10 px-3 text-xs text-white backdrop-blur hover:bg-white/20 sm:inline-flex">or {a.name}</Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function AskBox() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center gap-3"><AiOrb /><p className="font-display text-lg font-semibold text-ink">Ask your sous-chef</p></div>
      <p className="mt-2 text-sm text-slate-500">It searches ~900 recipes by meaning and knows your pantry, plan and diet.</p>
      <form onSubmit={e => { e.preventDefault(); if (q.trim()) navigate(`/chef?q=${encodeURIComponent(q.trim())}`); }} className="mt-4 flex gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Plan a cosy dinner with my spinach…"
          className="h-10 min-w-0 flex-1 rounded-full border border-slate-200 px-4 text-sm outline-none focus:border-brand-500" />
        <Button type="submit" variant="ai" icon={Send} aria-label="Ask" disabled={!q.trim()} />
      </form>
      <div className="mt-auto grid grid-cols-2 gap-2 pt-5 text-xs">
        {[
          { to: '/pantry?scan=1', icon: Camera, label: 'Scan fridge' },
          { to: '/recipes?import=1', icon: Link2, label: 'Import a link' },
          { to: '/discover', icon: Compass, label: 'Discover' },
          { to: '/meal-plan', icon: ArrowRight, label: 'Plan the week' },
        ].map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 font-medium text-slate-700 hover:bg-slate-100"><Icon className="size-4 text-brand-600" />{label}</Link>
        ))}
      </div>
    </Card>
  );
}

function UseSoon() {
  const { data: pantry = [] } = useGetPantryQuery();
  const soon = pantry.filter(p => p.expirationDate && daysUntil(p.expirationDate) >= 0 && daysUntil(p.expirationDate) <= 3)
    .sort((a, b) => daysUntil(a.expirationDate!) - daysUntil(b.expirationDate!));
  return (
    <Card>
      <CardHeader icon={Clock3} title="Use soon" action={<Link to="/pantry" className="text-xs font-medium text-brand-600">Pantry</Link>} />
      {soon.length === 0 ? <p className="px-5 py-6 text-sm text-slate-500">Nothing is about to expire.</p> : (
        <ul className="divide-y divide-slate-100">
          {soon.map(p => (
            <li key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
              <span className="font-medium capitalize text-ink">{p.name}</span>
              <Badge tone={daysUntil(p.expirationDate!) <= 1 ? 'red' : 'amber'}>{relativeDay(daysUntil(p.expirationDate!))}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function WeekStrip() {
  const weekStart = weekStartOf();
  const { data: meals = [] } = useGetMealPlanQuery(weekStart);
  const today = todayIso();
  return (
    <Card className="lg:col-span-2">
      <CardHeader title="This week" action={<Link to="/meal-plan" className="text-xs font-medium text-brand-600">Open plan</Link>} />
      <div className="grid grid-cols-7 gap-1.5 p-4">
        {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map(day => {
          const dayMeals = meals.filter(m => datePart(m.planDate) === day);
          return (
            <div key={day} className={cx('rounded-xl p-2 text-center', day === today ? 'bg-ink text-white' : day < today ? 'opacity-50' : 'bg-slate-50')}>
              <p className={cx('text-[11px]', day === today ? 'text-slate-300' : 'text-slate-500')}>{formatDay(day, { weekday: 'short' })}</p>
              <p className="font-display text-lg font-semibold">{formatDay(day, { day: 'numeric' })}</p>
              <div className="mt-1 flex justify-center -space-x-2">
                {dayMeals.slice(0, 3).map(m => <RecipeImage key={m.id} src={m.recipe.imageUrl} name={m.recipe.name} className="size-6 rounded-full ring-2 ring-white" />)}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function HomePage() {
  const [planTarget, setPlanTarget] = useState<PlanTarget | null>(null);
  const [fixId, setFixId] = useState<string | null>(null);
  const { data: picks } = useRecommendRecipesQuery('');
  const [reset, { isLoading: resetting }] = useResetDataMutation();
  const [reseed, { isLoading: reseeding }] = useReseedDataMutation();
  const [confirmReset, setConfirmReset] = useState(false);
  const run = (p: Promise<unknown>, done: string) => p.then(() => toast.success(done)).catch(err => toast.error(errorMessage(err))).finally(() => setConfirmReset(false));

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">{formatDay(todayIso(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="font-display text-4xl font-semibold text-ink sm:text-5xl">{greeting()}.</h1>
        </div>
        <div className="flex gap-2">
          {confirmReset
            ? <><Button size="sm" variant="danger" loading={resetting} onClick={() => run(reset().unwrap(), 'Your data was cleared')}>Clear my data</Button><Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button></>
            : <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setConfirmReset(true)}>Start fresh</Button>}
          <Button size="sm" variant="ghost" icon={Database} loading={reseeding} onClick={() => run(reseed().unwrap(), 'Sample data loaded')}>Sample data</Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <TonightCard onPlan={setPlanTarget} onFix={setFixId} />
        <AskBox />
        <WeekStrip />
        <UseSoon />
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">Cook from what you have</h2>
            <p className="text-sm text-slate-500">The whole cookbook ranked by your pantry, expiring items and diet</p>
          </div>
          <Link to="/discover" className="text-sm font-medium text-brand-600">See all</Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(picks?.data ?? []).slice(0, 8).map(m => <RecipeCard key={m.recipeId} match={m} />)}
          {!picks && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="aspect-[5/4] rounded-2xl" />)}
        </div>
      </section>

      <PlanMealModal target={planTarget} onClose={() => setPlanTarget(null)} />
      <RecipeFixModal recipeId={fixId} onClose={() => setFixId(null)} />
    </div>
  );
}
