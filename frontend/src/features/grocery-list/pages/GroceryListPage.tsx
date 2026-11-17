import { useState } from 'react';
import { AlertTriangle, Check, Download, Home, IndianRupee, ListChecks, Package, Plus, Repeat, RotateCcw, Search, ShoppingBasket, ShoppingCart, Trash2 } from 'lucide-react';
import {
  useAddAdHocItemMutation, useCheckGroceryItemMutation, useDeleteGroceryItemMutation, useEstimateCostMutation,
  useGetGroceryListQuery, useMarkAlreadyHaveMutation, useOverrideGroceryItemMutation, type GroceryItem,
} from '../../../app/api';
import { STORE_SECTIONS, UNITS, sectionOf } from '../../../shared/constants';
import { Badge, Button, Card, EmptyState, IconButton, Input, PageHeader, Select, SourceBadge, Spinner, Stat, Tabs, cx } from '../../../shared/ui';
import { errorMessage, toast } from '../../../shared/components/Toast';

type Tab = 'all' | 'buy' | 'pantry' | 'done';

/** What the user will actually buy: their edited amount if any, else what the plan needs. */
const qtyOf = (i: GroceryItem) => i.overrideQty ?? i.computedQty;
const isPlanNotice = (type: string) => type === 'override_reset' || type === 'quantity_increased';

const matchesTab: Record<Tab, (i: GroceryItem) => boolean> = {
  all: () => true,
  buy: i => !i.isChecked && !i.isAlreadyHave && qtyOf(i) > 0,
  pantry: i => i.isAlreadyHave || qtyOf(i) === 0,
  done: i => i.isChecked,
};

function sourceSummary(item: GroceryItem): string {
  const counts = new Map<string, number>();
  for (const s of item.sourceRecipes ?? []) counts.set(s.recipeName, (counts.get(s.recipeName) ?? 0) + 1);
  return [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(', ');
}

function GroceryRow({ item }: { item: GroceryItem }) {
  const [check] = useCheckGroceryItemMutation();
  const [override] = useOverrideGroceryItemMutation();
  const [haveIt] = useMarkAlreadyHaveMutation();
  const [remove] = useDeleteGroceryItemMutation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(qtyOf(item));

  const covered = item.computedQty === 0 && item.overrideQty == null;
  const done = item.isChecked || covered;
  const substitutedFrom = [...new Set((item.sourceRecipes ?? []).map(s => s.substitutedFrom).filter(Boolean))];
  const warnings = (item.warnings ?? []).filter(w => !isPlanNotice(w.type));

  const act = (p: Promise<unknown>) => p.catch(err => toast.error(errorMessage(err)));
  const saveQty = () => { act(override({ id: item.id, overrideQty: value }).unwrap()); setEditing(false); };

  return (
    <li className={cx('flex items-start gap-3 px-4 py-3 sm:px-5', covered && 'bg-brand-50/40')}>
      <button
        onClick={() => !covered && act(check({ id: item.id, isChecked: !item.isChecked }).unwrap())}
        disabled={covered} aria-label={item.isChecked ? 'Uncheck' : 'Check off'}
        className={cx('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors',
          done ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 hover:border-brand-500')}>
        {done && <Check className="size-3.5" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cx('text-sm font-medium capitalize', done ? 'text-slate-400 line-through' : 'text-slate-800')}>{item.ingredientName}</span>
          {covered && <Badge tone="green">in pantry</Badge>}
          {item.isAdHoc && <Badge tone="blue">added by you</Badge>}
          {item.overrideQty != null && <Badge tone="violet" title={`Plan needs ${item.computedQty} ${item.unit}`}>edited</Badge>}
          {item.isAlreadyHave && !covered && <Badge tone="green">have it</Badge>}
        </div>
        {substitutedFrom.length > 0 && <p className="mt-0.5 flex items-center gap-1 text-xs text-violet-600"><Repeat className="size-3" />instead of {substitutedFrom.join(', ')}</p>}
        {item.sourceRecipes && item.sourceRecipes.length > 0 && <p className="mt-0.5 text-xs text-slate-400">For {sourceSummary(item)}</p>}
        {warnings.map((w, i) => <p key={i} className="mt-0.5 flex items-start gap-1 text-xs text-red-600"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{w.message}</p>)}
      </div>

      {editing ? (
        <form onSubmit={e => { e.preventDefault(); saveQty(); }} className="flex items-center gap-1">
          <Input type="number" step="0.25" min={0} value={value} onChange={e => setValue(Number(e.target.value))} className="h-8 w-20 text-xs" autoFocus />
          <IconButton icon={Check} label="Save" type="submit" className="text-brand-600" />
        </form>
      ) : (
        <div className="flex items-center gap-1">
          {item.overrideQty != null && <span className="text-xs text-slate-400 line-through">{item.computedQty}</span>}
          <button onClick={() => { setValue(qtyOf(item)); setEditing(true); }} title="Change amount"
            className={cx('rounded-md px-2 py-1 text-sm font-medium hover:bg-slate-100', item.overrideQty != null ? 'text-violet-700' : 'text-slate-700')}>
            {qtyOf(item)} {item.unit}
          </button>
          {item.overrideQty != null && <IconButton icon={RotateCcw} label={`Reset to ${item.computedQty} ${item.unit}`} onClick={() => act(override({ id: item.id, overrideQty: null }).unwrap())} />}
        </div>
      )}

      <div className="flex items-center">
        {!item.isAlreadyHave && !covered && (
          <IconButton icon={Home} label="I have this (add to pantry)"
            onClick={() => act(haveIt({ id: item.id, addToPantry: true }).unwrap().then(() => toast.success(`${item.ingredientName} added to pantry`)))} />
        )}
        <IconButton icon={Trash2} label="Remove" className="hover:text-red-600" onClick={() => act(remove(item.id).unwrap())} />
      </div>
    </li>
  );
}

function AddItemForm({ onDone }: { onDone: () => void }) {
  const [add, { isLoading }] = useAddAdHocItemMutation();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('piece');
  const [section, setSection] = useState('other');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await add({ name, quantity, unit, storeSection: section }).unwrap();
      toast.success(`${name} added`);
      onDone();
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <Card className="animate-fade-in p-4">
      <form onSubmit={submit} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_90px_110px_150px_auto]">
        <Input className="col-span-2 sm:col-span-1" value={name} onChange={e => setName(e.target.value)} placeholder="Item, e.g. paper towels" required autoFocus />
        <Input type="number" min={0.25} step="0.25" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
        <Select value={unit} onChange={e => setUnit(e.target.value)}>{UNITS.map(u => <option key={u}>{u}</option>)}</Select>
        <Select value={section} onChange={e => setSection(e.target.value)} className="col-span-2 sm:col-span-1">
          {Object.entries(STORE_SECTIONS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
        </Select>
        <div className="col-span-2 flex gap-2 sm:col-span-1">
          <Button type="submit" loading={isLoading}>Add</Button>
          <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

export default function GroceryListPage() {
  const { data, isLoading } = useGetGroceryListQuery(undefined, { refetchOnMountOrArgChange: true });
  const [estimate, { data: cost, isLoading: costing }] = useEstimateCostMutation();
  const [tab, setTab] = useState<Tab>('buy');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const items = data?.items ?? [];
  const count = (t: Tab) => items.filter(matchesTab[t]).length;
  const visible = items.filter(i => matchesTab[tab](i) && i.ingredientName.includes(search.toLowerCase()));
  const sections = Object.keys(STORE_SECTIONS).map(key => ({ key, items: visible.filter(i => (STORE_SECTIONS[i.storeSection] ? i.storeSection : 'other') === key) })).filter(s => s.items.length);
  const notices = items.flatMap(i => (i.warnings ?? []).filter(w => isPlanNotice(w.type)).map(w => ({ item: i, w })));
  const progress = items.length ? Math.round((count('done') / items.length) * 100) : 0;

  const exportCsv = () => {
    const rows = items.filter(matchesTab.buy).map(i => `"${i.ingredientName}",${qtyOf(i)},"${i.unit}","${sectionOf(i.storeSection).label}"`);
    const url = URL.createObjectURL(new Blob([['Item,Quantity,Unit,Section', ...rows].join('\n')], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: 'grocery-list.csv' }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader title="Groceries" subtitle="Built from your meal plan, minus what's in your pantry"
        actions={<>
          <Button size="sm" variant="secondary" icon={Download} onClick={exportCsv} disabled={!count('buy')}>Export CSV</Button>
          <Button size="sm" icon={Plus} onClick={() => setAdding(a => !a)}>Add item</Button>
        </>} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="To buy" value={count('buy')} icon={ShoppingCart} tone="amber" />
        <Stat label="Covered by pantry" value={count('pantry')} icon={Package} tone="green" />
        <Stat label="Checked off" value={count('done')} icon={ListChecks} tone="blue" />
        <Card className="flex items-center justify-between gap-2 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><IndianRupee className="size-4" /></span>
            <div>
              <p className="text-xl font-semibold leading-tight text-slate-900">{cost ? (cost.data.total === null ? '—' : `₹${Math.round(cost.data.total)}`) : '—'}</p>
              <p className="text-xs text-slate-500">{cost?.data.total === null ? 'Needs a Gemini key' : 'Estimated cost'}</p>
            </div>
          </div>
          {cost ? <SourceBadge source={cost.source} /> : <Button size="sm" variant="ghost" loading={costing} onClick={() => estimate()} disabled={!count('buy')}>Estimate</Button>}
        </Card>
      </div>

      {adding && <div className="mb-4"><AddItemForm onDone={() => setAdding(false)} /></div>}

      {notices.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">Your meal plan changed, so {notices.length} edited item{notices.length > 1 ? 's were' : ' was'} updated</p>
          <ul className="mt-1.5 space-y-0.5">{notices.map(({ item, w }, i) => <li key={i} className="text-xs text-amber-800"><b className="capitalize">{item.ingredientName}:</b> {w.message}</li>)}</ul>
          <p className="mt-2 text-[11px] text-amber-700">Edit the amount or tick the item again to dismiss.</p>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Tabs value={tab} onChange={setTab} options={[
          { value: 'buy', label: `To buy (${count('buy')})` },
          { value: 'all', label: `All (${items.length})` },
          { value: 'pantry', label: `In pantry (${count('pantry')})` },
          { value: 'done', label: `Done (${count('done')})` },
        ]} />
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items" className="pl-9" />
        </div>
      </div>

      {items.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} /></div>
          <span className="text-xs font-medium text-slate-500">{progress}% done</span>
        </div>
      )}

      {isLoading ? <Spinner label="Building your list…" /> : sections.length === 0 ? (
        <Card><EmptyState icon={ShoppingBasket}
          title={items.length === 0 ? 'Your list is empty' : 'Nothing here'}
          text={items.length === 0 ? 'Plan some meals and the list fills itself.' : 'Try another tab or search.'} /></Card>
      ) : (
        <div className="space-y-3">
          {sections.map(({ key, items: sectionItems }) => {
            const { label, icon: Icon } = sectionOf(key);
            return (
              <Card key={key} className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 sm:px-5">
                  <Icon className="size-4 text-slate-500" />
                  <h2 className="text-sm font-semibold text-slate-700">{label}</h2>
                  <span className="ml-auto text-xs text-slate-400">{sectionItems.length}</span>
                </div>
                <ul className="divide-y divide-slate-100">{sectionItems.map(item => <GroceryRow key={item.id} item={item} />)}</ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
