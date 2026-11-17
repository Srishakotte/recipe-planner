import { useState } from 'react';
import { Recycle } from 'lucide-react';
import { useAddMealPlanEntryMutation, useGetRecipesQuery, useUpdateMealPlanEntryMutation, type MealPlanEntry } from '../../app/api';
import { MEAL_SLOTS } from '../../shared/constants';
import { addDays, formatDay, todayIso, datePart } from '../../shared/dates';
import { Button, Field, Input, Modal, Select, cx } from '../../shared/ui';
import { errorMessage, toast } from '../../shared/components/Toast';
import type { AvailableLeftover } from './leftovers';

const fail = (err: unknown) => toast.error(errorMessage(err));

/** Add a meal to a day. Offers available leftovers first (no new groceries needed). */
export function AddMealModal({ date, leftovers, onClose }: { date: string | null; leftovers: AvailableLeftover[]; onClose: () => void }) {
  const { data: recipes = [] } = useGetRecipesQuery();
  const [addMeal, { isLoading }] = useAddMealPlanEntryMutation();
  const [slot, setSlot] = useState('dinner');
  const [recipeId, setRecipeId] = useState('');
  const [servings, setServings] = useState(2);
  const [leftover, setLeftover] = useState<AvailableLeftover | null>(null);

  const reset = () => { setRecipeId(''); setServings(2); setLeftover(null); onClose(); };
  const pickRecipe = (id: string) => { setRecipeId(id); setLeftover(null); setServings(recipes.find(r => r.id === id)?.defaultServings ?? 2); };
  const pickLeftover = (l: AvailableLeftover) => { setRecipeId(l.recipeId); setLeftover(l); setServings(l.remaining); };

  const save = async () => {
    try {
      await addMeal({ recipeId, planDate: date!, mealSlot: slot, servings, isLeftover: !!leftover }).unwrap();
      reset();
    } catch (err) { fail(err); }
  };

  return (
    <Modal open={!!date} onClose={reset} title={date ? `Add a meal · ${formatDay(date, { weekday: 'long', day: 'numeric', month: 'short' })}` : ''}
      footer={<><Button variant="secondary" onClick={reset}>Cancel</Button><Button onClick={save} disabled={!recipeId} loading={isLoading}>Add to plan</Button></>}>
      <div className="space-y-4">
        {leftovers.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-700"><Recycle className="size-3.5" />Leftovers you can use (no shopping needed)</p>
            <div className="flex flex-wrap gap-2">
              {leftovers.map(l => (
                <button key={l.recipeId} onClick={() => pickLeftover(l)}
                  className={cx('rounded-lg border px-3 py-1.5 text-xs font-medium', leftover?.recipeId === l.recipeId ? 'border-amber-400 bg-amber-100 text-amber-900' : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100')}>
                  {l.recipeName} · {l.remaining} left
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Recipe" className="col-span-2">
            <Select value={recipeId} onChange={e => pickRecipe(e.target.value)}>
              <option value="">Choose a recipe…</option>
              {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          <Field label="Meal">
            <Select value={slot} onChange={e => setSlot(e.target.value)}>{MEAL_SLOTS.map(s => <option key={s}>{s}</option>)}</Select>
          </Field>
          <Field label={leftover ? `Servings (max ${leftover.remaining})` : 'Servings'}>
            <Input type="number" min={1} max={leftover?.remaining ?? 50} value={servings}
              onChange={e => setServings(Math.max(1, Math.min(Number(e.target.value), leftover?.remaining ?? 50)))} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/** Replace the recipe of a planned meal, keeping its day, slot and servings. */
export function SwapMealModal({ entry, onClose }: { entry: MealPlanEntry | null; onClose: () => void }) {
  const { data: recipes = [] } = useGetRecipesQuery();
  const [update, { isLoading }] = useUpdateMealPlanEntryMutation();
  const [recipeId, setRecipeId] = useState('');

  const save = async () => {
    try { await update({ id: entry!.id, data: { recipeId } }).unwrap(); setRecipeId(''); onClose(); }
    catch (err) { fail(err); }
  };

  return (
    <Modal open={!!entry} onClose={onClose} title={`Swap ${entry?.recipe.name ?? ''}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!recipeId} loading={isLoading}>Swap</Button></>}>
      <Field label="Replace with">
        <Select value={recipeId} onChange={e => setRecipeId(e.target.value)}>
          <option value="">Choose a recipe…</option>
          {recipes.filter(r => r.id !== entry?.recipeId).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
      </Field>
    </Modal>
  );
}

/** Mark a cooked meal's remaining servings as leftovers until an expiry date. */
export function LeftoverModal({ entry, onClose }: { entry: MealPlanEntry | null; onClose: () => void }) {
  const [update, { isLoading }] = useUpdateMealPlanEntryMutation();
  const [expiry, setExpiry] = useState('');
  const defaultExpiry = entry ? addDays(datePart(entry.planDate) > todayIso() ? datePart(entry.planDate) : todayIso(), 1) : '';

  const save = async () => {
    try {
      await update({ id: entry!.id, data: { isLeftover: true, leftoverExpiryDate: expiry || defaultExpiry } }).unwrap();
      toast.success('Marked as leftover. Use it when adding meals.');
      setExpiry(''); onClose();
    } catch (err) { fail(err); }
  };

  return (
    <Modal open={!!entry} onClose={onClose} title="Save as leftover"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={isLoading}>Save leftover</Button></>}>
      <p className="mb-3 text-sm text-slate-600">The remaining servings of <b>{entry?.recipe.name}</b> become available when you add meals, without adding groceries.</p>
      <Field label="Good until"><Input type="date" value={expiry || defaultExpiry} min={todayIso()} onChange={e => setExpiry(e.target.value)} /></Field>
    </Modal>
  );
}
