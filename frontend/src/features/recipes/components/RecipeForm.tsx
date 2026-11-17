import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useCreateRecipeMutation, useUpdateRecipeMutation, type Recipe, type RecipeInput } from '../../../app/api';
import { STORE_SECTIONS, UNITS } from '../../../shared/constants';
import { Button, Field, IconButton, Input, Modal, Select, Textarea } from '../../../shared/ui';
import { errorMessage, toast } from '../../../shared/components/Toast';

type IngredientRow = RecipeInput['ingredients'][number];
const emptyRow = (): IngredientRow => ({ name: '', displayName: '', quantity: 1, unit: 'piece', storeSection: 'produce' });

/** Create or edit a recipe. `recipe === undefined` means closed, `null` means new. */
export default function RecipeForm({ recipe, onClose }: { recipe: Recipe | null | undefined; onClose: () => void }) {
  if (recipe === undefined) return null;
  return <RecipeFormModal key={recipe?.id ?? 'new'} recipe={recipe} onClose={onClose} />;
}

function RecipeFormModal({ recipe, onClose }: { recipe: Recipe | null; onClose: () => void }) {
  const [name, setName] = useState(recipe?.name ?? '');
  const [description, setDescription] = useState(recipe?.description ?? '');
  const [steps, setSteps] = useState(recipe?.steps ?? '');
  const [servings, setServings] = useState(recipe?.defaultServings ?? 2);
  const [rows, setRows] = useState<IngredientRow[]>(
    recipe?.ingredients.map(({ name, displayName, quantity, unit, storeSection }) => ({
      name, displayName, quantity, unit,
      storeSection: STORE_SECTIONS[storeSection.toLowerCase()] ? storeSection.toLowerCase() : 'other',
    })) ?? [emptyRow()],
  );
  const [create, { isLoading: creating }] = useCreateRecipeMutation();
  const [update, { isLoading: updating }] = useUpdateRecipeMutation();

  const setRow = (index: number, patch: Partial<IngredientRow>) => setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: RecipeInput = {
      name: name.trim(), description, steps, defaultServings: servings,
      ingredients: rows.filter(r => r.name.trim()).map(r => ({ ...r, displayName: r.displayName || r.name })),
    };
    try {
      if (recipe) await update({ id: recipe.id, data }).unwrap();
      else await create(data).unwrap();
      toast.success(recipe ? 'Recipe updated' : 'Recipe created');
      onClose();
    } catch (err) { toast.error(errorMessage(err, 'Could not save recipe')); }
  };

  return (
    <Modal open onClose={onClose} wide title={recipe ? `Edit ${recipe.name}` : 'New recipe'}
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="recipe-form" loading={creating || updating}>{recipe ? 'Save changes' : 'Create recipe'}</Button>
      </>}>
      <form id="recipe-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field label="Name"><Input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Chicken stir fry" autoFocus /></Field>
          <Field label="Servings"><Input type="number" min={1} max={50} value={servings} onChange={e => setServings(Math.max(1, Number(e.target.value)))} /></Field>
        </div>
        <Field label="Description"><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="One line about the dish" /></Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Ingredients</span>
            <Button type="button" size="sm" variant="ghost" icon={Plus} onClick={() => setRows([...rows, emptyRow()])}>Add</Button>
          </div>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-[1fr_80px_96px_140px_auto] sm:bg-transparent sm:p-0">
                <Input value={row.name} onChange={e => setRow(i, { name: e.target.value })} placeholder="Ingredient" required={i === 0} className="col-span-1" />
                <IconButton icon={Trash2} label="Remove ingredient" onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={rows.length === 1} className="sm:order-last" />
                <Input type="number" min={0.01} step="any" value={row.quantity} onChange={e => setRow(i, { quantity: Number(e.target.value) })} aria-label="Quantity" />
                <Select value={row.unit} onChange={e => setRow(i, { unit: e.target.value })} aria-label="Unit">{UNITS.map(u => <option key={u}>{u}</option>)}</Select>
                <Select value={row.storeSection} onChange={e => setRow(i, { storeSection: e.target.value })} aria-label="Store section" className="col-span-2 sm:col-span-1">
                  {Object.entries(STORE_SECTIONS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
                </Select>
              </div>
            ))}
          </div>
        </div>

        <Field label="Steps"><Textarea rows={5} value={steps} onChange={e => setSteps(e.target.value)} placeholder={'1. Chop the onions\n2. …'} /></Field>
      </form>
    </Modal>
  );
}
