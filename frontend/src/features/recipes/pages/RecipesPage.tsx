import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Compass, Link2, Plus, Search, Trash2 } from 'lucide-react';
import { useDeleteRecipeMutation, useGetRecipesQuery, useImportRecipeUrlMutation, type Recipe } from '../../../app/api';
import { RecipeImage } from '../../../shared/components/RecipeVisuals';
import { Button, Card, ConfirmButton, EmptyState, Field, Input, Modal, PageHeader, Skeleton } from '../../../shared/ui';
import { errorMessage, toast } from '../../../shared/components/Toast';
import RecipeForm from '../components/RecipeForm';

/** Paste a link -> the server reads the recipe (schema.org data, or Gemini) -> review it in the form. */
function ImportModal({ open, onClose, onDraft }: { open: boolean; onClose: () => void; onDraft: (r: Recipe) => void }) {
  const [url, setUrl] = useState('');
  const [importUrl, { isLoading }] = useImportRecipeUrlMutation();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await importUrl(url.trim()).unwrap();
      onDraft({ ...data, id: '', createdAt: '', ingredients: data.ingredients.map((i, n) => ({ ...i, id: String(n), sortOrder: n })) } as Recipe);
      setUrl('');
      onClose();
    } catch (err) { toast.error(errorMessage(err, 'Could not import that page')); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Import a recipe from a link"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="import-form" loading={isLoading} disabled={!url.trim()}>Import</Button></>}>
      <form id="import-form" onSubmit={submit} className="space-y-3">
        <Field label="Recipe page URL"><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.bbcgoodfood.com/recipes/…" autoFocus /></Field>
        <p className="text-xs text-slate-500">Works with most food blogs and recipe sites. Ingredients are converted to amounts the grocery list understands; you can review everything before saving.</p>
      </form>
    </Modal>
  );
}

export default function RecipesPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const { data: recipes = [], isLoading } = useGetRecipesQuery(search.trim() || undefined);
  const [remove] = useDeleteRecipeMutation();
  const [editing, setEditing] = useState<Recipe | null | undefined>(undefined);
  const importing = params.get('import') === '1';

  const removeRecipe = (r: Recipe) => remove(r.id).unwrap().then(() => toast.success(`${r.name} removed`)).catch(err => toast.error(errorMessage(err)));

  return (
    <div>
      <PageHeader title="My recipes" subtitle={`${recipes.length} saved · save more from Discover or import any link`}
        actions={<>
          <Button variant="secondary" icon={Link2} onClick={() => setParams({ import: '1' }, { replace: true })}>Import link</Button>
          <Button icon={Plus} onClick={() => setEditing(null)}>New recipe</Button>
        </>} />

      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search my recipes" className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="aspect-square rounded-2xl" />)}</div>
      ) : recipes.length === 0 ? (
        <Card><EmptyState icon={BookOpen} title={search ? 'No recipes match' : 'Your cookbook is empty'} text="Save recipes from Discover, import a link, or write your own."
          action={<Link to="/discover"><Button icon={Compass}>Explore recipes</Button></Link>} /></Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {recipes.map(r => (
            <div key={r.id} className="group relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70 transition hover:-translate-y-1 hover:shadow-lg">
              <Link to={`/recipes/${r.id}`}>
                <RecipeImage src={r.imageUrl} name={r.name} className="aspect-[4/3] w-full" />
                <div className="p-3">
                  <p className="truncate font-display text-base font-semibold text-ink">{r.name}</p>
                  <p className="text-xs text-slate-500">{[r.cuisine, `${r.ingredients.length} ingredients`, `${r.defaultServings} servings`].filter(Boolean).join(' · ')}</p>
                </div>
              </Link>
              <div className="absolute right-2 top-2 rounded-full bg-white/90 opacity-0 transition group-hover:opacity-100">
                <ConfirmButton icon={Trash2} label="Remove" onConfirm={() => removeRecipe(r)} />
              </div>
            </div>
          ))}
        </div>
      )}

      <ImportModal open={importing} onClose={() => setParams({}, { replace: true })} onDraft={setEditing} />
      <RecipeForm recipe={editing} onClose={() => setEditing(undefined)} />
    </div>
  );
}
