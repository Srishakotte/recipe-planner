import { useState } from 'react';
import { BookmarkPlus, Check, ChevronDown, Lightbulb } from 'lucide-react';
import { useCreateRecipeMutation, useGetRecipeIdeasMutation, type RecipeIdea } from '../../app/api';
import { Badge, Button, Card, CardHeader, EmptyState, SourceBadge, Spinner, cx } from '../../shared/ui';
import { errorMessage, toast } from '../../shared/components/Toast';

/** New recipe ideas built around your pantry (Gemini), or your best-matching recipes without AI. */
export default function RecipeIdeas() {
  const [generate, { data, isLoading }] = useGetRecipeIdeasMutation();
  const [createRecipe] = useCreateRecipeMutation();
  const [open, setOpen] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const save = async (idea: RecipeIdea) => {
    try {
      await createRecipe({
        name: idea.name, description: idea.description, defaultServings: idea.servings,
        steps: idea.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
        ingredients: idea.ingredients.map(i => ({ ...i, displayName: i.name })),
      }).unwrap();
      setSaved(prev => new Set(prev).add(idea.name));
      toast.success(`${idea.name} saved to your recipes`);
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <Card>
      <CardHeader icon={Lightbulb} title="Ideas from your pantry" subtitle="New dishes that use what you already have"
        action={<div className="flex items-center gap-2"><SourceBadge source={data?.source} />
          <Button size="sm" variant="ai" onClick={() => generate()} loading={isLoading}>{data ? 'More ideas' : 'Get ideas'}</Button></div>} />
      {isLoading ? <Spinner label="Thinking of recipes…" /> : !data ? (
        <EmptyState icon={Lightbulb} title="Out of ideas for dinner?" text="Get recipes built around your pantry, starting with what expires soon." />
      ) : data.data.length === 0 ? (
        <EmptyState icon={Lightbulb} title="No ideas yet" text="Add a few pantry items first." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.data.map(idea => (
            <li key={idea.name} className="px-5 py-3">
              <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(open === idea.name ? null : idea.name)}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{idea.name}</p>
                  <p className="truncate text-xs text-slate-500">{idea.description}</p>
                </div>
                {idea.cookingTime > 0 && <Badge>{idea.cookingTime} min</Badge>}
                {idea.existingRecipeId && <Badge tone="green">your recipe</Badge>}
                <ChevronDown className={cx('size-4 text-slate-400 transition-transform', open === idea.name && 'rotate-180')} />
              </button>
              {open === idea.name && (
                <div className="mt-3 grid gap-4 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Ingredients</p>
                    <ul className="space-y-0.5 text-slate-700">{idea.ingredients.map(i => <li key={i.name}>{i.quantity} {i.unit} {i.name}</li>)}</ul>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Steps</p>
                    {idea.steps.length ? <ol className="list-decimal space-y-1 pl-4 text-slate-700">{idea.steps.map((s, i) => <li key={i}>{s.replace(/^\d+\.\s*/, '')}</li>)}</ol>
                      : <p className="text-slate-500">No steps saved.</p>}
                  </div>
                  {!idea.existingRecipeId && (
                    <div className="sm:col-span-2">
                      {saved.has(idea.name)
                        ? <Badge tone="green" icon={Check}>Saved to recipes</Badge>
                        : <Button size="sm" icon={BookmarkPlus} onClick={() => save(idea)}>Save recipe</Button>}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
