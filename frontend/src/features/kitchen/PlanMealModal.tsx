import { useEffect, useState } from 'react';
import { useAddMealPlanEntryMutation } from '../../app/api';
import { MEAL_SLOTS } from '../../shared/constants';
import { todayIso } from '../../shared/dates';
import { Button, Field, Input, Modal, Select } from '../../shared/ui';
import { errorMessage, toast } from '../../shared/components/Toast';

export interface PlanTarget { recipeId: string; name: string; defaultServings: number }

/** Adds a recipe to the meal plan. Used from Today, Recipes, search results and ideas. */
export default function PlanMealModal({ target, onClose, defaultSlot = 'dinner' }: { target: PlanTarget | null; onClose: () => void; defaultSlot?: string }) {
  const [addMeal, { isLoading }] = useAddMealPlanEntryMutation();
  const [date, setDate] = useState(todayIso());
  const [slot, setSlot] = useState(defaultSlot);
  const [servings, setServings] = useState(2);

  useEffect(() => {
    if (target) { setDate(todayIso()); setSlot(defaultSlot); setServings(target.defaultServings); }
  }, [target, defaultSlot]);

  const save = async () => {
    if (!target) return;
    try {
      await addMeal({ recipeId: target.recipeId, planDate: date, mealSlot: slot, servings }).unwrap();
      toast.success(`${target.name} added to your plan`);
      onClose();
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <Modal open={!!target} onClose={onClose} title={`Plan ${target?.name ?? ''}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={isLoading}>Add to plan</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" className="col-span-2"><Input type="date" value={date} min={todayIso()} onChange={e => setDate(e.target.value)} /></Field>
        <Field label="Meal">
          <Select value={slot} onChange={e => setSlot(e.target.value)}>
            {MEAL_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Servings"><Input type="number" min={1} max={50} value={servings} onChange={e => setServings(Math.max(1, Number(e.target.value)))} /></Field>
      </div>
    </Modal>
  );
}
