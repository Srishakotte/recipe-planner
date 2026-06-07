import { Router, Request, Response } from 'express';
import prisma from '../prisma';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const items = await prisma.pantryItem.findMany({ orderBy: { name: 'asc' } });
    res.json(items);
  } catch (error) { res.status(500).json({ error: 'Failed to fetch pantry' }); }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, quantity, unit, expirationDate } = req.body;
    if (!name || quantity === undefined || !unit) { res.status(400).json({ error: 'name, quantity, and unit required' }); return; }
    const item = await prisma.pantryItem.create({
      data: { name: name.toLowerCase().trim(), quantity, unit, expirationDate: expirationDate ? new Date(expirationDate) : null },
    });
    res.status(201).json(item);
  } catch (error) { res.status(500).json({ error: 'Failed to add pantry item' }); }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, quantity, unit, expirationDate } = req.body;
    const item = await prisma.pantryItem.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.toLowerCase().trim() }),
        ...(quantity !== undefined && { quantity }), ...(unit && { unit }),
        ...(expirationDate !== undefined && { expirationDate: expirationDate ? new Date(expirationDate) : null }),
      },
    });
    res.json(item);
  } catch (error) { res.status(500).json({ error: 'Failed to update pantry item' }); }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.pantryItem.delete({ where: { id: req.params.id } });
    res.json({ message: 'Pantry item deleted' });
  } catch (error) { res.status(500).json({ error: 'Failed to delete pantry item' }); }
});

export default router;
