import { CheckCircle2, Plus } from 'lucide-react';
import { useCreateSubstitutionMutation, useGetConstraintsQuery, useGetRecipeFixQuery, type FixOption } from '../../app/api';
import { Badge, Button, EmptyState, Modal, SourceBadge, Spinner } from '../../shared/ui';
import { errorMessage, toast } from '../../shared/components/Toast';

/**
 * "What can I use instead?" for every ingredient a recipe is missing or that breaks
 * a dietary constraint. One click turns a suggestion into a substitution rule.
 */
export default function RecipeFixModal({ recipeId, onClose }: { recipeId: string | null; onClose: () => void }) {
  const { data, isFetching } = useGetRecipeFixQuery(recipeId ?? '', { skip: !recipeId });
  const { data: constraints = [] } = useGetConstraintsQuery();
  const [createRule] = useCreateSubstitutionMutation();
  const fix = data?.data;

  const saveRule = async (ingredient: string, option: FixOption) => {
    // a rule needs a constraint to hang off; use the one this ingredient conflicts with, else "preference"
    const conflict = fix?.recipe.conflicts.find(c => c.ingredient === ingredient)?.constraint;
    const constraintValue = conflict ?? constraints[0]?.constraintValue ?? 'preference';
    try {
      await createRule({
        originalIngredient: ingredient, substituteIngredient: option.name, quantityRatio: option.ratio,
        substituteUnit: null, constraintType: conflict ? 'dietary' : 'preference', constraintValue,
      }).unwrap();
      toast.success(`Rule saved: ${ingredient} → ${option.name} (${constraintValue})`);
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <Modal open={!!recipeId} onClose={onClose} wide title={fix ? `Fix ${fix.recipe.name}` : 'Recipe fixer'}>
      {isFetching || !fix ? <Spinner label="Finding substitutes…" /> : fix.fixes.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nothing to fix" text="You have every ingredient and nothing conflicts with your constraints." />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{fix.recipe.reason}</p>
            <SourceBadge source={data?.source} />
          </div>
          {fix.fixes.map(({ ingredient, options }) => (
            <div key={ingredient} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-800">{ingredient}</p>
                {fix.recipe.conflicts.some(c => c.ingredient === ingredient)
                  ? <Badge tone="red">breaks {fix.recipe.conflicts.find(c => c.ingredient === ingredient)!.constraint}</Badge>
                  : <Badge>missing</Badge>}
              </div>
              {options.length === 0 ? <p className="mt-2 text-xs text-slate-500">No good substitute known. Add it to your grocery list.</p> : (
                <ul className="mt-2 divide-y divide-slate-100">
                  {options.map(o => (
                    <li key={o.name} className="flex items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800">
                          {o.name} <span className="text-xs text-slate-400">× {o.ratio}</span>
                        </p>
                        {o.note && <p className="text-xs text-slate-500">{o.note}</p>}
                      </div>
                      {o.inPantry && <Badge tone="green">in pantry</Badge>}
                      {o.fromRule
                        ? <Badge tone="violet">your rule</Badge>
                        : <Button size="sm" variant="ghost" icon={Plus} onClick={() => saveRule(ingredient, o)}>Rule</Button>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
