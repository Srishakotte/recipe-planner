import { useState } from 'react';
import { ArrowRight, Link2, Plus, Repeat, Search, ShieldCheck, Trash2, Wand2, X } from 'lucide-react';
import {
  useCreateConstraintMutation, useCreateSubstitutionMutation, useCreateSynonymMutation, useDeleteConstraintMutation,
  useDeleteSubstitutionMutation, useDeleteSynonymMutation, useGetConstraintsQuery, useGetRecipesQuery, useGetSubstitutionsQuery,
  useGetSynonymsQuery, useSuggestSubstitutesMutation, useToggleConstraintMutation, type FixOption,
} from '../../../app/api';
import { DIETARY_PRESETS } from '../../../shared/constants';
import { Badge, Button, Card, CardHeader, ConfirmButton, EmptyState, Field, IconButton, Input, Modal, PageHeader, Select, SourceBadge, cx } from '../../../shared/ui';
import { errorMessage, toast } from '../../../shared/components/Toast';
import RecipeFixModal from '../../kitchen/RecipeFixModal';

const normalize = (v: string) => v.toLowerCase().trim().replace(/[\s_]+/g, '-');
const fail = (err: unknown) => toast.error(errorMessage(err));

interface RuleDraft { originalIngredient: string; substituteIngredient: string; quantityRatio: number; constraintValue: string }

function RuleModal({ draft, onClose }: { draft: RuleDraft | null; onClose: () => void }) {
  const { data: constraints = [] } = useGetConstraintsQuery();
  const [create, { isLoading }] = useCreateSubstitutionMutation();
  const [value, setValue] = useState<RuleDraft | null>(draft); // remounted via key for each new draft
  if (!value) return null;
  const set = (patch: Partial<RuleDraft>) => setValue({ ...value, ...patch });
  const close = onClose;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create({ ...value, substituteUnit: null, constraintType: DIETARY_PRESETS.includes(normalize(value.constraintValue) as never) ? 'dietary' : 'preference' }).unwrap();
      toast.success('Rule saved. The grocery list will use it.');
      close();
    } catch (err) { fail(err); }
  };

  return (
    <Modal open onClose={close} title="Substitution rule"
      footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button type="submit" form="rule-form" loading={isLoading}>Save rule</Button></>}>
      <form id="rule-form" onSubmit={save} className="grid grid-cols-2 gap-3">
        <Field label="Replace"><Input value={value.originalIngredient} onChange={e => set({ originalIngredient: e.target.value })} required placeholder="milk" /></Field>
        <Field label="With"><Input value={value.substituteIngredient} onChange={e => set({ substituteIngredient: e.target.value })} required placeholder="oat milk" /></Field>
        <Field label="Amount ratio"><Input type="number" step="0.05" min={0.05} value={value.quantityRatio} onChange={e => set({ quantityRatio: Number(e.target.value) })} /></Field>
        <Field label="Applies when">
          <Input list="constraint-options" value={value.constraintValue} onChange={e => set({ constraintValue: e.target.value })} required placeholder="dairy-free" />
          <datalist id="constraint-options">{[...new Set([...constraints.map(c => c.constraintValue), ...DIETARY_PRESETS])].map(v => <option key={v} value={v} />)}</datalist>
        </Field>
        <p className="col-span-2 text-xs text-slate-500">The rule is applied to the grocery list while this constraint is active.</p>
      </form>
    </Modal>
  );
}

function FindSubstitute({ onSave }: { onSave: (d: RuleDraft) => void }) {
  const [query, setQuery] = useState('');
  const [suggest, { data, isLoading }] = useSuggestSubstitutesMutation();
  const { data: recipes = [] } = useGetRecipesQuery();
  const [fixId, setFixId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader icon={Search} title="Find a substitute" subtitle="Out of something? Get swaps, preferring what's in your pantry" action={<SourceBadge source={data?.source} />} />
      <div className="space-y-4 p-5">
        <form onSubmit={e => { e.preventDefault(); if (query.trim()) suggest(query.trim()); }} className="flex gap-2">
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. heavy cream, eggs, soy sauce" />
          <Button type="submit" loading={isLoading} disabled={!query.trim()}>Find</Button>
        </form>
        {data && (data.data.options.length === 0 ? <p className="text-sm text-slate-500">No known substitute for {data.data.ingredient}.</p> : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {data.data.options.map((o: FixOption) => (
              <li key={o.name} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">{data.data.ingredient} <ArrowRight className="inline size-3 text-slate-400" /> <b className="font-medium">{o.name}</b> <span className="text-xs text-slate-400">× {o.ratio}</span></p>
                  {o.note && <p className="text-xs text-slate-500">{o.note}</p>}
                </div>
                {o.inPantry && <Badge tone="green">in pantry</Badge>}
                {o.fromRule ? <Badge tone="violet">your rule</Badge>
                  : <Button size="sm" variant="ghost" icon={Plus} onClick={() => onSave({ originalIngredient: data.data.ingredient, substituteIngredient: o.name, quantityRatio: o.ratio, constraintValue: '' })}>Rule</Button>}
              </li>
            ))}
          </ul>
        ))}
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
          <span className="flex items-center gap-1.5 text-sm text-slate-600"><Wand2 className="size-4 text-violet-600" />Fix a whole recipe:</span>
          <Select value="" onChange={e => setFixId(e.target.value || null)} className="sm:max-w-xs">
            <option value="">Choose a recipe…</option>
            {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </div>
      </div>
      <RecipeFixModal recipeId={fixId} onClose={() => setFixId(null)} />
    </Card>
  );
}

function Constraints() {
  const { data: constraints = [] } = useGetConstraintsQuery();
  const [create] = useCreateConstraintMutation();
  const [toggle] = useToggleConstraintMutation();
  const [remove] = useDeleteConstraintMutation();
  const [custom, setCustom] = useState('');
  const active = new Set(constraints.map(c => normalize(c.constraintValue)));

  const add = (value: string) => create({ constraintType: DIETARY_PRESETS.includes(value as never) ? 'dietary' : 'preference', constraintValue: value }).unwrap()
    .then(() => toast.success(`${value} added`)).catch(fail);

  return (
    <Card>
      <CardHeader icon={ShieldCheck} title="My dietary constraints" subtitle="Recipes, swaps and the grocery list respect these" />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {constraints.length === 0 && <p className="text-sm text-slate-500">None yet.</p>}
          {constraints.map(c => (
            <span key={c.id} className={cx('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium', c.isActive ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-slate-200 bg-slate-50 text-slate-400 line-through')}>
              <button onClick={() => toggle({ id: c.id, isActive: !c.isActive }).unwrap().catch(fail)} title={c.isActive ? 'Pause' : 'Resume'}>{c.constraintValue}</button>
              <button onClick={() => remove(c.id).unwrap().catch(fail)} aria-label={`Remove ${c.constraintValue}`} className="text-slate-400 hover:text-red-600"><X className="size-3" /></button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DIETARY_PRESETS.filter(p => !active.has(p)).map(p => (
            <button key={p} onClick={() => add(p)} className="rounded-lg border border-dashed border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-brand-400 hover:text-brand-700">+ {p}</button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); if (custom.trim()) { add(normalize(custom)); setCustom(''); } }} className="flex gap-2">
          <Input value={custom} onChange={e => setCustom(e.target.value)} placeholder='Custom, e.g. "no mushrooms"' />
          <Button type="submit" variant="secondary" disabled={!custom.trim()}>Add</Button>
        </form>
        <p className="text-xs text-slate-500">Click a constraint to pause it without deleting.</p>
      </div>
    </Card>
  );
}

function Rules({ onAdd }: { onAdd: () => void }) {
  const { data: rules = [] } = useGetSubstitutionsQuery();
  const { data: constraints = [] } = useGetConstraintsQuery();
  const [remove] = useDeleteSubstitutionMutation();
  const active = new Set(constraints.filter(c => c.isActive).map(c => normalize(c.constraintValue)));

  return (
    <Card>
      <CardHeader icon={Repeat} title="Substitution rules" subtitle="Applied automatically to the grocery list"
        action={<Button size="sm" variant="secondary" icon={Plus} onClick={onAdd}>Add rule</Button>} />
      {rules.length === 0 ? <EmptyState icon={Repeat} title="No rules yet" text="Save a swap as a rule and the grocery list will use it." /> : (
        <ul className="divide-y divide-slate-100">
          {rules.map(r => (
            <li key={r.id} className="flex items-center gap-3 px-5 py-2.5">
              <div className="min-w-0 flex-1 text-sm">
                <span className="text-slate-800">{r.originalIngredient}</span>
                <ArrowRight className="mx-1.5 inline size-3.5 text-slate-400" />
                <span className="font-medium text-brand-700">{r.substituteIngredient}</span>
                {r.quantityRatio !== 1 && <span className="ml-1 text-xs text-slate-400">× {r.quantityRatio}</span>}
              </div>
              <Badge tone={active.has(normalize(r.constraintValue)) ? 'green' : 'slate'}
                title={active.has(normalize(r.constraintValue)) ? 'Applied now' : `Add "${r.constraintValue}" to your constraints to apply`}>
                {r.constraintValue}{!active.has(normalize(r.constraintValue)) && ' · off'}
              </Badge>
              <ConfirmButton icon={Trash2} onConfirm={() => remove(r.id).unwrap().catch(fail)} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Synonyms() {
  const { data: synonyms = [] } = useGetSynonymsQuery();
  const [create, { isLoading }] = useCreateSynonymMutation();
  const [remove] = useDeleteSynonymMutation();
  const [synonym, setSynonym] = useState('');
  const [canonical, setCanonical] = useState('');

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await create({ synonym, canonicalName: canonical }).unwrap(); setSynonym(''); setCanonical(''); }
    catch (err) { fail(err); }
  };

  return (
    <Card>
      <CardHeader icon={Link2} title="Ingredient synonyms" subtitle="Different names for the same thing are merged on the grocery list" />
      <div className="space-y-4 p-5">
        <form onSubmit={add} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
          <Input value={synonym} onChange={e => setSynonym(e.target.value)} placeholder="dahi" required />
          <span className="text-sm text-slate-400">=</span>
          <Input value={canonical} onChange={e => setCanonical(e.target.value)} placeholder="yogurt" required />
          <Button type="submit" variant="secondary" loading={isLoading}>Add</Button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {synonyms.map(s => (
            <span key={s.id} className="group inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">
              {s.synonym} <span className="text-slate-400">=</span> <b className="font-medium text-slate-800">{s.canonicalName}</b>
              <IconButton icon={X} label="Remove" onClick={() => remove(s.id).unwrap().catch(fail)} className="size-4 opacity-0 group-hover:opacity-100" />
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function SubstitutionsPage() {
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  return (
    <div>
      <PageHeader title="Swaps & diet" subtitle="Substitutes, dietary constraints and ingredient names" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <FindSubstitute onSave={setDraft} />
          <Synonyms />
        </div>
        <div className="space-y-4">
          <Constraints />
          <Rules onAdd={() => setDraft({ originalIngredient: '', substituteIngredient: '', quantityRatio: 1, constraintValue: '' })} />
        </div>
      </div>
      <RuleModal key={draft ? JSON.stringify(draft) : 'none'} draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}
