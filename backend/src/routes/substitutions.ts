import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prisma';
import { normalizeConstraintValue } from '../engine/generate';
import { asyncHandler, parseBody, HttpError } from '../lib/http';

const router = Router();

const lower = z.string().trim().min(1).transform(s => s.toLowerCase());
const constraintValue = z.string().trim().min(1).transform(normalizeConstraintValue);

const substitutionSchema = z.object({
  originalIngredient: lower,
  substituteIngredient: lower,
  quantityRatio: z.coerce.number().positive().default(1),
  substituteUnit: z.string().trim().optional().nullable().transform(v => v || null),
  constraintType: z.string().min(1),
  constraintValue,
});
const constraintSchema = z.object({ constraintType: z.string().min(1), constraintValue });
const synonymSchema = z.object({ synonym: lower, canonicalName: lower });

// ---- substitution rules
router.get('/', asyncHandler(async (_req, res) => { res.json(await prisma.substitution.findMany()); }));

router.post('/', asyncHandler(async (req, res) => {
  res.status(201).json(await prisma.substitution.create({ data: parseBody(substitutionSchema, req.body) }));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await prisma.substitution.delete({ where: { id: req.params.id } });
  res.json({ message: 'Substitution deleted' });
}));

// ---- dietary constraints
router.get('/constraints', asyncHandler(async (_req, res) => { res.json(await prisma.userConstraint.findMany()); }));

router.post('/constraints', asyncHandler(async (req, res) => {
  const body = parseBody(constraintSchema, req.body);
  if (await prisma.userConstraint.findFirst({ where: { constraintValue: body.constraintValue } })) {
    throw new HttpError(409, `Constraint "${body.constraintValue}" is already active`);
  }
  res.status(201).json(await prisma.userConstraint.create({ data: { ...body, isActive: true } }));
}));

router.patch('/constraints/:id', asyncHandler(async (req, res) => {
  const { isActive } = parseBody(z.object({ isActive: z.boolean() }), req.body);
  res.json(await prisma.userConstraint.update({ where: { id: req.params.id }, data: { isActive } }));
}));

router.delete('/constraints/:id', asyncHandler(async (req, res) => {
  await prisma.userConstraint.delete({ where: { id: req.params.id } });
  res.json({ message: 'Constraint deleted' });
}));

// ---- ingredient synonyms
router.get('/synonyms', asyncHandler(async (_req, res) => { res.json(await prisma.ingredientSynonym.findMany()); }));

router.post('/synonyms', asyncHandler(async (req, res) => {
  const body = parseBody(synonymSchema, req.body);
  if (await prisma.ingredientSynonym.findUnique({ where: { synonym: body.synonym } })) {
    throw new HttpError(409, `"${body.synonym}" is already mapped`);
  }
  res.status(201).json(await prisma.ingredientSynonym.create({ data: body }));
}));

router.delete('/synonyms/:id', asyncHandler(async (req, res) => {
  await prisma.ingredientSynonym.delete({ where: { id: req.params.id } });
  res.json({ message: 'Synonym deleted' });
}));

export default router;
