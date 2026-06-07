import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try { res.json(await prisma.substitution.findMany()); }
  catch (error) { res.status(500).json({ error: 'Failed to fetch substitutions' }); }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { originalIngredient, substituteIngredient, quantityRatio, substituteUnit, constraintType, constraintValue } = req.body;
    if (!originalIngredient || !substituteIngredient || !constraintType || !constraintValue) {
      res.status(400).json({ error: 'originalIngredient, substituteIngredient, constraintType, constraintValue required' }); return;
    }
    const sub = await prisma.substitution.create({
      data: { originalIngredient: originalIngredient.toLowerCase().trim(), substituteIngredient: substituteIngredient.toLowerCase().trim(), quantityRatio: quantityRatio || 1.0, substituteUnit: substituteUnit || null, constraintType, constraintValue },
    });
    res.status(201).json(sub);
  } catch (error) { res.status(500).json({ error: 'Failed to create substitution' }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try { await prisma.substitution.delete({ where: { id: req.params.id } }); res.json({ message: 'Substitution deleted' }); }
  catch (error) { res.status(500).json({ error: 'Failed to delete substitution' }); }
});

router.get('/constraints', async (req: Request, res: Response) => {
  try { res.json(await prisma.userConstraint.findMany()); }
  catch (error) { res.status(500).json({ error: 'Failed to fetch constraints' }); }
});

router.post('/constraints', async (req: Request, res: Response) => {
  try {
    const { constraintType, constraintValue } = req.body;
    if (!constraintType || !constraintValue) { res.status(400).json({ error: 'constraintType and constraintValue required' }); return; }
    const constraint = await prisma.userConstraint.create({ data: { constraintType, constraintValue, isActive: true } });
    res.status(201).json(constraint);
  } catch (error) { res.status(500).json({ error: 'Failed to create constraint' }); }
});

router.delete('/constraints/:id', async (req: Request, res: Response) => {
  try { await prisma.userConstraint.delete({ where: { id: req.params.id } }); res.json({ message: 'Constraint deleted' }); }
  catch (error) { res.status(500).json({ error: 'Failed to delete constraint' }); }
});

export default router;
