import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ScanModal from '../ScanModal';
import { AlertTriangle, Camera, Clock3, Pencil, Plus, Refrigerator, Search, Trash2 } from 'lucide-react';
import { useAddPantryItemMutation, useDeletePantryItemMutation, useGetPantryQuery, useUpdatePantryItemMutation, type PantryItem } from '../../../app/api';
import { UNITS } from '../../../shared/constants';
import { datePart, daysUntil, formatDay, relativeDay } from '../../../shared/dates';
import { Badge, Button, Card, ConfirmButton, EmptyState, Field, IconButton, Input, Modal, PageHeader, Select, Spinner, Stat } from '../../../shared/ui';
import { errorMessage, toast } from '../../../shared/components/Toast';

const SOON_DAYS = 3;

/** null = no expiry date; days < 0 = expired (an item expiring today is still usable). */
function status(item: PantryItem) {
  if (!item.expirationDate) return null;
  const days = daysUntil(item.expirationDate);
  if (days < 0) return { tone: 'red' as const, text: 'expired', days };
  if (days <= SOON_DAYS) return { tone: 'amber' as const, text: `expires ${relativeDay(days)}`, days };
  return { tone: 'slate' as const, text: `until ${formatDay(datePart(item.expirationDate), { day: 'numeric', month: 'short' })}`, days };
}

interface Group { key: string; name: string; unit: string; total: number; batches: PantryItem[] }

/** Same ingredient + unit with different expiry dates shows as one row with its batches. */
function groupItems(items: PantryItem[]): Group[] {
  const groups = new Map<string, Group>();
  for (const item of items) {
    const key = `${item.name}|${item.unit}`;
    const g = groups.get(key) ?? { key, name: item.name, unit: item.unit, total: 0, batches: [] };
    g.total += item.quantity;
    g.batches.push(item);
    groups.set(key, g);
  }
  for (const g of groups.values()) g.batches.sort((a, b) => (a.expirationDate ?? '9').localeCompare(b.expirationDate ?? '9'));
  return [...groups.values()];
}

const emptyForm = { name: '', quantity: 1, unit: 'piece', expirationDate: '' };

/** `item === undefined` closed, `null` new, otherwise editing. */
function ItemForm({ item, onClose }: { item: PantryItem | null | undefined; onClose: () => void }) {
  if (item === undefined) return null;
  return <ItemFormModal key={item?.id ?? 'new'} item={item} onClose={onClose} />;
}

function ItemFormModal({ item, onClose }: { item: PantryItem | null; onClose: () => void }) {
  const [add, { isLoading: adding }] = useAddPantryItemMutation();
  const [update, { isLoading: updating }] = useUpdatePantryItemMutation();
  const [form, setForm] = useState(item
    ? { name: item.name, quantity: item.quantity, unit: item.unit, expirationDate: item.expirationDate ? datePart(item.expirationDate) : '' }
    : emptyForm);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form, expirationDate: form.expirationDate || null };
    try {
      if (item) await update({ id: item.id, data }).unwrap();
      else await add(data).unwrap();
      toast.success(item ? 'Pantry item updated' : `${form.name} added to pantry`);
      onClose();
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <Modal open onClose={onClose} title={item ? `Edit ${item.name}` : 'Add to pantry'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="pantry-form" loading={adding || updating}>Save</Button></>}>
      <form id="pantry-form" onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Item" className="col-span-2"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. spinach" autoFocus /></Field>
        <Field label="Quantity"><Input type="number" min={0} step="any" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} /></Field>
        <Field label="Unit"><Select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>{UNITS.map(u => <option key={u}>{u}</option>)}</Select></Field>
        <Field label="Expires on (optional)" className="col-span-2"><Input type="date" value={form.expirationDate} onChange={e => setForm({ ...form, expirationDate: e.target.value })} /></Field>
      </form>
    </Modal>
  );
}

export default function PantryPage() {
  const { data: items = [], isLoading } = useGetPantryQuery();
  const [remove] = useDeletePantryItemMutation();
  const [editing, setEditing] = useState<PantryItem | null | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [params, setParams] = useSearchParams();
  const scanning = params.get('scan') === '1';
  const setScanning = (on: boolean) => setParams(on ? { scan: '1' } : {}, { replace: true });

  const groups = useMemo(() => groupItems(items.filter(i => i.name.includes(search.toLowerCase().trim()))), [items, search]);
  const expired = items.filter(i => (status(i)?.days ?? 0) < 0);
  const soon = items.filter(i => { const s = status(i); return s && s.days >= 0 && s.days <= SOON_DAYS; });

  const removeItem = (item: PantryItem) => remove(item.id).unwrap().catch(err => toast.error(errorMessage(err)));
  const clearExpired = async () => {
    await Promise.all(expired.map(removeItem));
    toast.success(`Removed ${expired.length} expired item${expired.length > 1 ? 's' : ''}`);
  };

  return (
    <div>
      <PageHeader title="Pantry" subtitle="What you have at home. The grocery list subtracts it automatically."
        actions={<>
          {expired.length > 0 && <Button size="sm" variant="secondary" icon={Trash2} onClick={clearExpired}>Remove {expired.length} expired</Button>}
          <Button variant="ai" icon={Camera} onClick={() => setScanning(true)}>Scan photo</Button>
          <Button icon={Plus} onClick={() => setEditing(null)}>Add item</Button>
        </>} />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Items" value={items.length} icon={Refrigerator} tone="green" />
        <Stat label="Use soon" value={soon.length} icon={Clock3} tone="amber" />
        <Stat label="Expired" value={expired.length} icon={AlertTriangle} tone="red" />
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pantry" className="pl-9" />
      </div>

      {isLoading ? <Spinner /> : groups.length === 0 ? (
        <Card><EmptyState icon={Refrigerator} title={search ? 'Nothing matches' : 'Your pantry is empty'}
          text="Add what you have so recipes and the grocery list can use it." action={<Button icon={Plus} onClick={() => setEditing(null)}>Add item</Button>} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {groups.map(g => (
              <li key={g.key} className="px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium capitalize text-slate-900">{g.name}</p>
                  <p className="text-sm text-slate-600">{+g.total.toFixed(2)} {g.unit}{g.batches.length > 1 && <span className="ml-1 text-xs text-slate-400">· {g.batches.length} batches</span>}</p>
                </div>
                <ul className="mt-1 space-y-0.5">
                  {g.batches.map(b => {
                    const s = status(b);
                    return (
                      <li key={b.id} className="flex items-center gap-2 text-xs text-slate-500">
                        {g.batches.length > 1 && <span className="w-16">{b.quantity} {b.unit}</span>}
                        {s ? <Badge tone={s.tone} icon={s.days <= SOON_DAYS ? Clock3 : undefined}>{s.text}</Badge> : <span>no expiry</span>}
                        <span className="ml-auto flex items-center">
                          <IconButton icon={Pencil} label="Edit" onClick={() => setEditing(b)} />
                          <ConfirmButton icon={Trash2} onConfirm={() => removeItem(b)} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ItemForm item={editing} onClose={() => setEditing(undefined)} />
      <ScanModal open={scanning} onClose={() => setScanning(false)} />
    </div>
  );
}
