import { useState } from 'react';
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, Copy, Minus, Package, Plus, Recycle, Repeat, Trash2, Users } from 'lucide-react';
import {
  useAddMealPlanEntryMutation, useDeleteMealPlanEntryMutation, useGetLeftoversQuery, useGetMealPlanQuery,
  useUpdateMealPlanEntryMutation, type MealPlanEntry,
} from '../../../app/api';
import { MEAL_SLOTS } from '../../../shared/constants';
import { addDays, datePart, formatDay, todayIso, weekStartOf } from '../../../shared/dates';
import { Badge, Button, Card, IconButton, PageHeader, Spinner, Stat, cx } from '../../../shared/ui';
import { errorMessage, toast } from '../../../shared/components/Toast';
import { availableLeftovers, consumersOf, isLeftoverConsumer, isLeftoverSource } from '../leftovers';
import { AddMealModal, LeftoverModal, SwapMealModal } from '../MealPlanModals';

const slotOrder = (slot: string) => { const i = MEAL_SLOTS.indexOf(slot as typeof MEAL_SLOTS[number]); return i === -1 ? 99 : i; };
const fail = (err: unknown) => toast.error(errorMessage(err));

function MealCard({ entry, locked, today, allLeftovers, onSwap, onMarkLeftover }: {
  entry: MealPlanEntry; locked: boolean; today: string; allLeftovers: MealPlanEntry[];
  onSwap: () => void; onMarkLeftover: () => void;
}) {
  const [update] = useUpdateMealPlanEntryMutation();
  const [remove] = useDeleteMealPlanEntryMutation();
  const source = isLeftoverSource(entry);
  const consumer = isLeftoverConsumer(entry);
  const cooked = datePart(entry.planDate) <= today;

  const setServings = (n: number) => (n < 1 ? remove(entry.id) : update({ id: entry.id, data: { servings: n } })).unwrap().catch(fail);

  const toggleLeftover = () => {
    if (!source) return onMarkLeftover();
    const consumers = consumersOf(entry, allLeftovers, today);
    if (consumers.length) return toast.warning(`${consumers.length} upcoming meal(s) use this leftover. Remove them first.`);
    update({ id: entry.id, data: { isLeftover: false, leftoverExpiryDate: null } }).unwrap().catch(fail);
  };

  return (
    <div className={cx('group rounded-lg border px-2.5 py-2 text-xs',
      source ? 'border-amber-200 bg-amber-50' : consumer ? 'border-slate-200 bg-slate-50' : 'border-brand-100 bg-brand-50/60')}>
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{entry.mealSlot}</p>
          <p className="truncate font-medium text-slate-800" title={entry.recipe.name}>{entry.recipe.name}</p>
        </div>
        {(source || consumer) && <Badge tone={source ? 'amber' : 'slate'} icon={source ? Package : Recycle}>{source ? 'leftover' : 'reused'}</Badge>}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        {locked ? <span className="text-slate-500">{entry.servings} servings</span> : (
          <span className="flex items-center gap-1">
            <button aria-label="Fewer servings" onClick={() => setServings(entry.servings - 1)} className="flex size-5 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-100"><Minus className="size-3" /></button>
            <span className="w-5 text-center text-slate-700">{entry.servings}</span>
            <button aria-label="More servings" onClick={() => setServings(entry.servings + 1)} className="flex size-5 items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-100"><Plus className="size-3" /></button>
          </span>
        )}
        <span className="flex items-center opacity-70 group-hover:opacity-100">
          {cooked && !consumer && <IconButton icon={Package} label={source ? 'Unmark leftover' : 'Save as leftover'} onClick={toggleLeftover} className={cx('size-6', source && 'text-amber-600')} />}
          {!locked && <IconButton icon={Repeat} label="Swap recipe" onClick={onSwap} className="size-6" />}
          {!locked && <IconButton icon={Trash2} label="Remove" onClick={() => remove(entry.id).unwrap().catch(fail)} className="size-6 hover:text-red-600" />}
        </span>
      </div>
    </div>
  );
}

export default function MealPlanPage() {
  const today = todayIso();
  const [weekStart, setWeekStart] = useState(weekStartOf(today));
  const { data: entries = [], isLoading } = useGetMealPlanQuery(weekStart);
  const { data: prevEntries = [] } = useGetMealPlanQuery(addDays(weekStart, -7));
  const { data: leftoverEntries = [] } = useGetLeftoversQuery();
  const [addMeal, { isLoading: copying }] = useAddMealPlanEntryMutation();
  const [addDate, setAddDate] = useState<string | null>(null);
  const [swapEntry, setSwapEntry] = useState<MealPlanEntry | null>(null);
  const [leftoverEntry, setLeftoverEntry] = useState<MealPlanEntry | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const leftovers = availableLeftovers(leftoverEntries, today);
  const mealsOn = (day: string) => entries.filter(e => datePart(e.planDate) === day).sort((a, b) => slotOrder(a.mealSlot) - slotOrder(b.mealSlot));

  const copyLastWeek = async () => {
    try {
      await Promise.all(prevEntries.filter(e => !e.isLeftover).map(e =>
        addMeal({ recipeId: e.recipeId, planDate: addDays(datePart(e.planDate), 7), mealSlot: e.mealSlot, servings: e.servings }).unwrap()));
      toast.success('Copied last week');
    } catch (err) { fail(err); }
  };

  return (
    <div>
      <PageHeader title="Meal plan" subtitle="Your grocery list updates as you plan"
        actions={<>
          {entries.length === 0 && prevEntries.some(e => !e.isLeftover) && <Button size="sm" variant="secondary" icon={Copy} loading={copying} onClick={copyLastWeek}>Copy last week</Button>}
          <div className="flex items-center gap-1">
            <IconButton icon={ChevronLeft} label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))} />
            <button onClick={() => setWeekStart(weekStartOf(today))} className="rounded-lg px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100">
              {formatDay(weekStart, { day: 'numeric', month: 'short' })} – {formatDay(addDays(weekStart, 6), { day: 'numeric', month: 'short' })}
            </button>
            <IconButton icon={ChevronRight} label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))} />
          </div>
        </>} />

      {leftovers.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <Package className="size-4" /> Leftovers ready to use:
          {leftovers.map(l => <span key={l.recipeId} className="font-medium">{l.recipeName} ({l.remaining})</span>)}
        </div>
      )}

      {isLoading ? <Spinner /> : (
        <div className="grid gap-3 lg:grid-cols-7">
          {days.map(day => {
            const isToday = day === today;
            const locked = day < today;
            const meals = mealsOn(day);
            return (
              <Card key={day} className={cx('flex flex-col p-2.5', isToday && 'ring-2 ring-brand-400', locked && 'opacity-60')}>
                <div className="mb-2 flex items-baseline justify-between px-0.5 lg:block">
                  <p className={cx('text-xs font-semibold uppercase', isToday ? 'text-brand-700' : 'text-slate-500')}>{formatDay(day, { weekday: 'short' })}</p>
                  <p className={cx('text-lg font-semibold', isToday ? 'text-brand-700' : 'text-slate-900')}>{formatDay(day, { day: 'numeric' })}
                    {isToday && <span className="ml-1.5 text-[10px] font-medium uppercase text-brand-600">today</span>}</p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {meals.map(e => (
                    <MealCard key={e.id} entry={e} locked={locked} today={today} allLeftovers={leftoverEntries}
                      onSwap={() => setSwapEntry(e)} onMarkLeftover={() => setLeftoverEntry(e)} />
                  ))}
                </div>
                {!locked && (
                  <button onClick={() => setAddDate(day)}
                    className="mt-2 flex h-8 items-center justify-center gap-1 rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">
                    <Plus className="size-3.5" />Add
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {entries.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Meals" value={entries.length} icon={CalendarDays} tone="green" />
          <Stat label="Servings" value={entries.reduce((n, e) => n + e.servings, 0)} icon={Users} tone="blue" />
          <Stat label="Leftover meals" value={entries.filter(e => e.isLeftover).length} icon={Package} tone="amber" />
          <Stat label="Different recipes" value={new Set(entries.map(e => e.recipeId)).size} icon={BookOpen} tone="violet" />
        </div>
      )}

      <AddMealModal date={addDate} leftovers={leftovers} onClose={() => setAddDate(null)} />
      <SwapMealModal entry={swapEntry} onClose={() => setSwapEntry(null)} />
      <LeftoverModal entry={leftoverEntry} onClose={() => setLeftoverEntry(null)} />
    </div>
  );
}
