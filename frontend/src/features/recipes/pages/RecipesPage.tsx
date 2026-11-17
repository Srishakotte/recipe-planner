import { useState } from 'react';
import { BookOpen, CalendarPlus, Pencil, Plus, Search, Trash2, Users, Wand2 } from 'lucide-react';
import { useDeleteRecipeMutation, useGetRecipesQuery, type Recipe } from '../../../app/api';
import { sectionOf } from '../../../shared/constants';
import { Badge, Button, Card, ConfirmButton, EmptyState, IconButton, Input, Modal, PageHeader, Skeleton } from '../../../shared/ui';
import { errorMessage, toast } from '../../../shared/components/Toast';
import RecipeForm from '../components/RecipeForm';
import PlanMealModal, { type PlanTarget } from '../../kitchen/PlanMealModal';
import RecipeFixModal from '../../kitchen/RecipeFixModal';
import RecipeIdeas from '../../kitchen/RecipeIdeas';

// a stable soft colour per recipe instead of the same stock photo for everything
const TILE_COLOURS = ['bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700', 'bg-sky-100 text-sky-700', 'bg-rose-100 text-rose-700', 'bg-violet-100 text-violet-700', 'bg-lime-100 text-lime-700'];
const tileColour = (name: string) => TILE_COLOURS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TILE_COLOURS.length];
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

function RecipeDetail({ recipe, onClose, onEdit, onPlan, onFix }: { recipe: Recipe | null; onClose: () => void; onEdit: () => void; onPlan: () => void; onFix: () => void }) {
  if (!recipe) return null;
  const steps = (recipe.steps ?? '').split(/\n+/).map(s => s.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean);
  return (
    <Modal open onClose={onClose} wide title={recipe.name}
      footer={<>
        <Button variant="secondary" icon={Pencil} onClick={onEdit}>Edit</Button>
        <Button variant="secondary" icon={Wand2} onClick={onFix}>Check pantry</Button>
        <Button icon={CalendarPlus} onClick={onPlan}>Plan</Button>
      </>}>
      {recipe.description && <p className="mb-4 text-sm text-slate-600">{recipe.description}</p>}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ingredients · {recipe.defaultServings} servings</p>
          <ul className="space-y-1.5 text-sm">
            {recipe.ingredients.map(i => (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <span className="text-slate-800">{i.displayName || i.name}</span>
                <span className="flex items-center gap-2 text-slate-500">{i.quantity} {i.unit}<Badge>{sectionOf(i.storeSection).label}</Badge></span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Steps</p>
          {steps.length ? <ol className="list-decimal space-y-1.5 pl-4 text-sm text-slate-700">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            : <p className="text-sm text-slate-500">No steps yet. Edit the recipe to add them.</p>}
        </div>
      </div>
    </Modal>
  );
}

export default function RecipesPage() {
  const [search, setSearch] = useState('');
  const { data: recipes = [], isLoading } = useGetRecipesQuery(search.trim() || undefined);
  const [deleteRecipe] = useDeleteRecipeMutation();
  const [editing, setEditing] = useState<Recipe | null | undefined>(undefined); // undefined = closed, null = new
  const [viewing, setViewing] = useState<Recipe | null>(null);
  const [planTarget, setPlanTarget] = useState<PlanTarget | null>(null);
  const [fixId, setFixId] = useState<string | null>(null);

  const remove = async (recipe: Recipe) => {
    try { await deleteRecipe(recipe.id).unwrap(); toast.success(`${recipe.name} deleted`); }
    catch (err) { toast.error(errorMessage(err)); }
  };
  const plan = (r: Recipe) => setPlanTarget({ recipeId: r.id, name: r.name, defaultServings: r.defaultServings });

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Recipes" subtitle={`${recipes.length} saved`}
          actions={<Button icon={Plus} onClick={() => setEditing(null)}>New recipe</Button>} />

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipes by name" className="pl-9" />
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-36" />)}</div>
        ) : recipes.length === 0 ? (
          <Card><EmptyState icon={BookOpen} title={search ? 'No recipes match' : 'No recipes yet'}
            text={search ? 'Try another name.' : 'Create one, or get ideas from your pantry below.'}
            action={!search && <Button icon={Plus} onClick={() => setEditing(null)}>New recipe</Button>} /></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map(recipe => (
              <Card key={recipe.id} className="group flex flex-col p-4 transition-shadow hover:shadow-md">
                <button className="flex items-start gap-3 text-left" onClick={() => setViewing(recipe)}>
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${tileColour(recipe.name)}`}>{initials(recipe.name)}</span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 group-hover:text-brand-700">{recipe.name}</h3>
                    {recipe.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{recipe.description}</p>}
                  </div>
                </button>
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Users className="size-3.5" />{recipe.defaultServings}</span>
                  <span>{recipe.ingredients.length} ingredients</span>
                </div>
                <div className="mt-auto flex items-center gap-1 pt-4">
                  <Button size="sm" icon={CalendarPlus} onClick={() => plan(recipe)}>Plan</Button>
                  <Button size="sm" variant="ghost" icon={Wand2} onClick={() => setFixId(recipe.id)}>Pantry check</Button>
                  <span className="ml-auto flex items-center">
                    <IconButton icon={Pencil} label="Edit" onClick={() => setEditing(recipe)} />
                    <ConfirmButton icon={Trash2} onConfirm={() => remove(recipe)} />
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <RecipeIdeas />

      <RecipeForm recipe={editing} onClose={() => setEditing(undefined)} />
      <RecipeDetail recipe={viewing} onClose={() => setViewing(null)}
        onEdit={() => { setEditing(viewing); setViewing(null); }}
        onPlan={() => { if (viewing) plan(viewing); setViewing(null); }}
        onFix={() => { setFixId(viewing?.id ?? null); setViewing(null); }} />
      <PlanMealModal target={planTarget} onClose={() => setPlanTarget(null)} />
      <RecipeFixModal recipeId={fixId} onClose={() => setFixId(null)} />
    </div>
  );
}
