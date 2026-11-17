import { Router } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prisma';
import { asyncHandler, HttpError } from '../lib/http';
import { regenerate, serialized, sortItems, collectWarnings, currentGroceryList } from '../services/grocery';

const router = Router();

router.post('/generate', asyncHandler(async (req, res) => {
  const { weekStart, fromToday } = req.body || {};
  const { generation, warnings, cached } = await serialized(() => regenerate({ weekStart, fromToday }));
  const items = sortItems(generation.items);
  res.json({
    generationId: generation.id, version: generation.version, generatedAt: generation.generatedAt,
    items, warnings: warnings ?? collectWarnings(items), cached,
  });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { section, uncheckedOnly, warningsOnly } = req.query;
  // Always bring the list up to date first: recipe edits, pantry changes, new
  // substitution rules or constraints all change the inputs. If nothing changed
  // this is a cheap hash comparison and the stored list (with edits) is returned.
  const generation = await currentGroceryList();
  let items = generation.items;
  if (section) items = items.filter(i => i.storeSection === section);
  if (uncheckedOnly === 'true') items = items.filter(i => !i.isChecked);
  if (warningsOnly === 'true') items = items.filter(i => i.warnings && (i.warnings as any[]).length > 0);
  res.json({ generationId: generation.id, version: generation.version, generatedAt: generation.generatedAt, items });
}));

// drop the one-time 'plan changed' notices once the user acts on the item
function withoutNotices(warnings: any, type: string) {
  if (!Array.isArray(warnings)) return warnings ?? undefined;
  const kept = warnings.filter((w: any) => w?.type !== type);
  return kept.length > 0 ? kept : Prisma.DbNull;
}

router.patch('/items/:id/check', asyncHandler(async (req, res) => {
  const { isChecked } = req.body;
  const existing = await prisma.groceryItem.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new HttpError(404, 'Item not found');
  const item = await prisma.groceryItem.update({
    where: { id: req.params.id },
    data: { isChecked: !!isChecked, warnings: withoutNotices(existing.warnings, 'quantity_increased') },
  });
  res.json(item);
}));

// body: { overrideQty: number } to set, { overrideQty: null } to go back to the computed amount
router.patch('/items/:id/override', asyncHandler(async (req, res) => {
  const { overrideQty } = req.body;
  if (overrideQty !== null && (typeof overrideQty !== 'number' || !isFinite(overrideQty) || overrideQty < 0)) {
    throw new HttpError(400, 'overrideQty must be a non-negative number or null');
  }
  const existing = await prisma.groceryItem.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new HttpError(404, 'Item not found');
  // editing an ad-hoc item just changes its amount
  const data = existing.isAdHoc && overrideQty !== null
    ? { computedQty: overrideQty, overrideQty: null }
    : { overrideQty: overrideQty !== null && Math.abs(overrideQty - existing.computedQty) < 0.001 ? null : overrideQty };
  const item = await prisma.groceryItem.update({
    where: { id: req.params.id },
    data: { ...data, warnings: withoutNotices(existing.warnings, 'override_reset') },
  });
  res.json(item);
}));

router.patch('/items/:id/already-have', asyncHandler(async (req, res) => {
  const item = await prisma.groceryItem.update({ where: { id: req.params.id }, data: { isAlreadyHave: true, isChecked: true } });
  const { addToPantry } = req.body;
  if (addToPantry) {
    await prisma.pantryItem.create({ data: { name: item.ingredientName, quantity: item.overrideQty || item.computedQty, unit: item.unit } });
  }
  res.json(item);
}));

router.post('/items/ad-hoc', asyncHandler(async (req, res) => {
  const { name, quantity, unit, storeSection } = req.body;
  if (!name || !quantity || !unit) throw new HttpError(400, 'name, quantity, and unit required');
  const latestGen = (await prisma.groceryGeneration.findFirst({ orderBy: { version: 'desc' } }))
    ?? (await serialized(() => regenerate({ fromToday: true }))).generation;
  const item = await prisma.groceryItem.create({
    data: { generationId: latestGen.id, ingredientName: name.toLowerCase().trim(), computedQty: Number(quantity), unit, storeSection: storeSection || 'other', isAdHoc: true },
  });
  res.status(201).json(item);
}));

router.delete('/items/:id', asyncHandler(async (req, res) => {
  await prisma.groceryItem.delete({ where: { id: req.params.id } });
  res.json({ message: 'Item deleted' });
}));

export default router;
