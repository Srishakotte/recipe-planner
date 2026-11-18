import { useState } from 'react';
import { Camera, Receipt, Trash2, Upload } from 'lucide-react';
import { useBulkAddPantryMutation, useScanGroceriesMutation, type ScannedItem } from '../../app/api';
import { UNITS } from '../../shared/constants';
import { addDays, todayIso } from '../../shared/dates';
import { AiOrb } from '../../shared/components/RecipeVisuals';
import { Button, IconButton, Input, Modal, Select, Tabs } from '../../shared/ui';
import { errorMessage, toast } from '../../shared/components/Toast';

/** Shrinks the photo before upload (phones produce 5-10 MB images). */
async function toBase64Jpeg(file: File, maxSide = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement('canvas'), { width: bitmap.width * scale, height: bitmap.height * scale });
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

/** Gemini Vision: photo of a fridge or a receipt -> editable list -> pantry. */
export default function ScanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<'fridge' | 'receipt'>('fridge');
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<ScannedItem[] | null>(null);
  const [scan, { isLoading: scanning }] = useScanGroceriesMutation();
  const [bulkAdd, { isLoading: adding }] = useBulkAddPantryMutation();

  const close = () => { setPreview(null); setItems(null); onClose(); };
  const onFile = async (file?: File) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setItems(null);
    try {
      const image = await toBase64Jpeg(file);
      setItems((await scan({ image, mimeType: 'image/jpeg', kind }).unwrap()).data);
    } catch (err) { toast.error(errorMessage(err, 'Could not read that photo')); }
  };
  const update = (i: number, patch: Partial<ScannedItem>) => setItems(items!.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const save = async () => {
    try {
      const { added } = await bulkAdd(items!.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit, expirationDate: i.expiresInDays === null ? null : addDays(todayIso(), i.expiresInDays) }))).unwrap();
      toast.success(`Added ${added} items to your pantry`);
      close();
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <Modal open={open} onClose={close} wide title="Scan groceries"
      footer={items && <><Button variant="secondary" onClick={() => setItems(null)}>Rescan</Button><Button onClick={save} loading={adding} disabled={!items.length}>Add {items.length} to pantry</Button></>}>
      <div className="space-y-4">
        <Tabs value={kind} onChange={setKind} options={[{ value: 'fridge', label: <span className="flex items-center gap-1.5"><Camera className="size-3.5" />Fridge or shelf</span> }, { value: 'receipt', label: <span className="flex items-center gap-1.5"><Receipt className="size-3.5" />Receipt</span> }]} />
        {!preview && (
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 px-6 py-12 text-center hover:border-brand-500 hover:bg-brand-50">
            <AiOrb size="lg" />
            <p className="font-display text-lg font-semibold text-ink">Take or upload a photo</p>
            <p className="max-w-sm text-sm text-slate-500">Gemini Vision lists what it sees with amounts and typical shelf life. You can edit everything before saving.</p>
            <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"><Upload className="size-4" />Choose photo</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
          </label>
        )}
        {preview && (
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <img src={preview} alt="Your photo" className="h-48 w-full rounded-xl object-cover sm:h-full" />
            {scanning ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-sm text-slate-500"><AiOrb size="lg" /><span className="animate-pulse">Gemini is looking at your photo…</span></div>
            ) : items && (
              <ul className="space-y-2">
                {items.length === 0 && <p className="text-sm text-slate-500">No food items found. Try a clearer photo.</p>}
                {items.map((it, i) => (
                  <li key={i} className="grid grid-cols-[1fr_70px_90px_auto] items-center gap-2">
                    <Input value={it.name} onChange={e => update(i, { name: e.target.value })} className="h-9" />
                    <Input type="number" min={0} step="any" value={it.quantity} onChange={e => update(i, { quantity: Number(e.target.value) })} className="h-9" />
                    <Select value={it.unit} onChange={e => update(i, { unit: e.target.value })} className="h-9">{UNITS.map(u => <option key={u}>{u}</option>)}</Select>
                    <IconButton icon={Trash2} label="Remove" onClick={() => setItems(items.filter((_, j) => j !== i))} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
