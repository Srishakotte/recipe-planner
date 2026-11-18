import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Bookmark, CalendarPlus, Check, ChefHat, ChevronLeft, ChevronRight, ExternalLink, Minus, Pencil, Play, Plus, Timer, Wand2, X } from 'lucide-react';
import { useGetPantryQuery, useGetRecipeQuery, useSetRecipeSavedMutation, type Recipe } from '../../../app/api';
import { sectionOf } from '../../../shared/constants';
import { RecipeImage } from '../../../shared/components/RecipeVisuals';
import { Badge, Button, Card, Spinner, cx } from '../../../shared/ui';
import { errorMessage, toast } from '../../../shared/components/Toast';
import PlanMealModal, { type PlanTarget } from '../../kitchen/PlanMealModal';
import RecipeFixModal from '../../kitchen/RecipeFixModal';
import RecipeForm from '../components/RecipeForm';

// same rule as the server: "chicken" covers "chicken breast", "unsalted butter" is butter, "coconut milk" is not milk
const DESCRIPTORS = new Set(['unsalted', 'salted', 'red', 'white', 'yellow', 'green', 'brown', 'fresh', 'large', 'small', 'medium', 'whole', 'chopped', 'minced', 'grated', 'plain', 'boneless', 'skinless', 'baby', 'ripe', 'dried', 'frozen']);
const inPantry = (ingredient: string, item: string) =>
  ingredient === item || ingredient.startsWith(item + ' ') || item.startsWith(ingredient + ' ') ||
  (ingredient.endsWith(' ' + item) && ingredient.slice(0, -item.length - 1).split(' ').every(w => DESCRIPTORS.has(w)));

const splitSteps =(steps?: string | null) => (steps ?? '').split(/\n+/).map(s => s.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);

function formatQty(q: number): string {
  if (q >= 10) return String(Math.round(q));
  const whole = Math.floor(q), frac = q - whole;
  const nice: [number, string][] = [[0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.66, '⅔'], [0.75, '¾']];
  const match = nice.find(([v]) => Math.abs(frac - v) < 0.04);
  if (match) return `${whole || ''}${match[1]}`;
  return String(Math.round(q * 10) / 10);
}

/** Full-screen, step-by-step cooking view with timers found in the step text. */
function CookMode({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const steps = splitSteps(recipe.steps);
  const [i, setI] = useState(0);
  const [timer, setTimer] = useState<{ end: number; label: string } | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI(n => Math.min(n + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') setI(n => Math.max(n - 1, 0));
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // keep the screen awake while cooking (where supported)
    const lock = (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => void }> } }).wakeLock?.request('screen').catch(() => null);
    return () => { window.removeEventListener('keydown', onKey); lock?.then(l => l?.release()); };
  }, [steps.length, onClose]);

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => {
      tick(t => t + 1);
      if (Date.now() >= timer.end) { clearInterval(id); toast.success(`Timer done: ${timer.label}`); setTimer(null); }
    }, 1000);
    return () => clearInterval(id);
  }, [timer]);

  const minutes = steps[i]?.match(/(\d+)\s*(?:-\s*\d+\s*)?(minutes?|mins?)\b/i);
  const left = timer ? Math.max(0, Math.round((timer.end - Date.now()) / 1000)) : 0;

  return (
    <motion.div className="fixed inset-0 z-[60] flex flex-col bg-ink text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <header className="flex items-center gap-4 px-6 py-4">
        <ChefHat className="size-5 text-saffron-400" />
        <p className="flex-1 truncate font-display text-lg">{recipe.name}</p>
        {timer && <span className="flex items-center gap-1.5 rounded-full bg-saffron-400 px-3 py-1 text-sm font-semibold text-ink"><Timer className="size-4" />{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</span>}
        <button onClick={onClose} aria-label="Exit cook mode" className="rounded-full p-2 hover:bg-white/10"><X className="size-5" /></button>
      </header>
      <div className="h-1 bg-white/10"><div className="h-full bg-saffron-400 transition-all" style={{ width: `${((i + 1) / Math.max(steps.length, 1)) * 100}%` }} /></div>
      <div className="flex flex-1 items-center justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="max-w-3xl text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-saffron-400">Step {i + 1} of {steps.length}</p>
            <p className="mt-6 font-display text-2xl leading-relaxed sm:text-4xl sm:leading-snug">{steps[i] ?? 'No steps for this recipe yet.'}</p>
            {minutes && !timer && (
              <button onClick={() => setTimer({ end: Date.now() + Number(minutes[1]) * 60_000, label: `step ${i + 1}` })}
                className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm hover:bg-white/10">
                <Timer className="size-4" /> Start {minutes[1]} min timer
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <footer className="flex items-center justify-between px-6 py-6">
        <Button variant="ghost" icon={ChevronLeft} onClick={() => setI(Math.max(i - 1, 0))} disabled={i === 0} className="text-white hover:bg-white/10 hover:text-white">Back</Button>
        <span className="text-xs text-slate-400">Use ← → keys</span>
        {i < steps.length - 1
          ? <Button variant="ai" onClick={() => setI(i + 1)}>Next step <ChevronRight className="size-4" /></Button>
          : <Button variant="ai" icon={Check} onClick={onClose}>Done, enjoy!</Button>}
      </footer>
    </motion.div>
  );
}

export default function RecipePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: recipe, isLoading, isError } = useGetRecipeQuery(id);
  const { data: pantry = [] } = useGetPantryQuery();
  const [setSaved, { isLoading: saving }] = useSetRecipeSavedMutation();
  const [servings, setServings] = useState<number | null>(null);
  const [planTarget, setPlanTarget] = useState<PlanTarget | null>(null);
  const [fixing, setFixing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [cooking, setCooking] = useState(false);

  const pantryNames = useMemo(() => pantry.map(p => p.name.toLowerCase()), [pantry]);
  if (isLoading) return <Spinner label="Loading recipe…" />;
  if (isError || !recipe) return <Card className="p-8 text-center text-sm text-slate-500">Recipe not found. <Link to="/discover" className="text-brand-600 underline">Back to Discover</Link></Card>;

  const portions = servings ?? recipe.defaultServings;
  const factor = portions / recipe.defaultServings;
  const have = (name: string) => pantryNames.some(p => inPantry(name, p));
  const steps = splitSteps(recipe.steps);
  const missing = recipe.ingredients.filter(i => !have(i.name)).length;

  const toggleSaved = async () => {
    try { await setSaved({ id: recipe.id, saved: !recipe.saved }).unwrap(); toast.success(recipe.saved ? 'Removed from My recipes' : 'Saved to My recipes'); }
    catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-ink"><ArrowLeft className="size-4" />Back</button>

      <section className="relative mb-8 overflow-hidden rounded-3xl bg-ink">
        <RecipeImage src={recipe.imageUrl} name={recipe.name} className="h-72 w-full opacity-90 sm:h-96" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
          <div className="mb-3 flex flex-wrap gap-2">
            {[recipe.cuisine, recipe.category].filter(Boolean).map(t => <span key={t} className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">{t}</span>)}
            {recipe.source === 'library' && <span className="rounded-full bg-saffron-400/90 px-3 py-1 text-xs font-medium text-ink">From the cookbook library</span>}
          </div>
          <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">{recipe.name}</h1>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="ai" icon={Play} onClick={() => setCooking(true)} disabled={steps.length === 0}>Cook mode</Button>
            <Button variant="secondary" icon={CalendarPlus} onClick={() => setPlanTarget({ recipeId: recipe.id, name: recipe.name, defaultServings: portions })}>Plan it</Button>
            <Button variant="secondary" icon={Bookmark} loading={saving} onClick={toggleSaved}>{recipe.saved ? 'Saved' : 'Save'}</Button>
            {missing > 0 && <Button variant="secondary" icon={Wand2} onClick={() => setFixing(true)}>Swap {missing} missing</Button>}
            {recipe.source !== 'library' && <Button variant="ghost" icon={Pencil} onClick={() => setEditing(true)} className="text-white hover:bg-white/10 hover:text-white">Edit</Button>}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <Card className="h-fit p-5 lg:sticky lg:top-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-ink">Ingredients</h2>
            <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
              <button aria-label="Fewer servings" onClick={() => setServings(Math.max(1, portions - 1))} className="flex size-7 items-center justify-center rounded-full bg-white shadow-sm"><Minus className="size-3.5" /></button>
              <span className="w-20 text-center text-xs font-medium">{portions} servings</span>
              <button aria-label="More servings" onClick={() => setServings(portions + 1)} className="flex size-7 items-center justify-center rounded-full bg-white shadow-sm"><Plus className="size-3.5" /></button>
            </div>
          </div>
          <p className="mb-3 text-xs text-slate-500">{missing === 0 ? 'You have everything in your pantry.' : `You have ${recipe.ingredients.length - missing} of ${recipe.ingredients.length}. Missing items go on your grocery list when you plan it.`}</p>
          <ul className="divide-y divide-slate-100">
            {recipe.ingredients.map(ing => (
              <li key={ing.id} className="flex items-center gap-3 py-2 text-sm">
                <span className={cx('flex size-5 shrink-0 items-center justify-center rounded-full', have(ing.name) ? 'bg-herb-600 text-white' : 'border border-slate-300')}>
                  {have(ing.name) && <Check className="size-3" />}
                </span>
                <span className="flex-1 text-slate-800">{ing.displayName || ing.name}</span>
                <span className="text-slate-500">{formatQty(ing.quantity * factor)} {ing.unit}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {[...new Set(recipe.ingredients.map(i => sectionOf(i.storeSection).label))].map(s => <Badge key={s}>{s}</Badge>)}
          </div>
        </Card>

        <div>
          <h2 className="mb-4 font-display text-xl font-semibold text-ink">Method</h2>
          {steps.length === 0 ? <p className="text-sm text-slate-500">No steps yet.</p> : (
            <ol className="space-y-4">
              {steps.map((s, n) => (
                <li key={n} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-saffron-100 font-display text-sm font-semibold text-[#8a5a10]">{n + 1}</span>
                  <p className="pt-1 text-[15px] leading-relaxed text-slate-700">{s}</p>
                </li>
              ))}
            </ol>
          )}
          {(recipe.videoUrl || recipe.sourceUrl) && (
            <div className="mt-8 flex flex-wrap gap-2">
              {recipe.videoUrl && <a href={recipe.videoUrl} target="_blank" rel="noreferrer"><Button variant="secondary" icon={Play}>Watch video</Button></a>}
              {recipe.sourceUrl && <a href={recipe.sourceUrl} target="_blank" rel="noreferrer"><Button variant="ghost" icon={ExternalLink}>Original recipe</Button></a>}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>{cooking && <CookMode recipe={recipe} onClose={() => setCooking(false)} />}</AnimatePresence>
      <PlanMealModal target={planTarget} onClose={() => setPlanTarget(null)} />
      <RecipeFixModal recipeId={fixing ? recipe.id : null} onClose={() => setFixing(false)} />
      <RecipeForm recipe={editing ? recipe : undefined} onClose={() => setEditing(false)} />
    </div>
  );
}
