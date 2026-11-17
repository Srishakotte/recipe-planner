import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { asyncHandler, parseBody } from '../lib/http';

const router = Router();

const pantrySchema = z.object({
  name: z.string().trim().min(1).transform(s => s.toLowerCase()),
  quantity: z.coerce.number().min(0),
  unit: z.string().trim().min(1),
  expirationDate: z.string().optional().nullable(),
});

const toDate = (value: string | null | undefined) => (value ? new Date(value) : null);

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await prisma.pantryItem.findMany({ orderBy: { name: 'asc' } }));
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = parseBody(pantrySchema, req.body);
  res.status(201).json(await prisma.pantryItem.create({ data: { ...body, expirationDate: toDate(body.expirationDate) } }));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { expirationDate, ...rest } = parseBody(pantrySchema.partial(), req.body);
  res.json(await prisma.pantryItem.update({
    where: { id: req.params.id },
    data: { ...rest, ...(expirationDate !== undefined && { expirationDate: toDate(expirationDate) }) },
  }));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.pantryItem.delete({ where: { id: req.params.id } });
  res.json({ message: 'Pantry item deleted' });
}));

export default router;
