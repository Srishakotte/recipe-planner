/**
 * The cookbook library: ~870 real recipes with photos from TheMealDB (free test API key "1",
 * https://www.themealdb.com/api.php). They power Discover and are the knowledge base for RAG.
 * Library recipes have saved=false until the user saves or plans one.
 */
import prisma from '../prisma';
import { parseMeasure, guessStoreSection } from '../engine/parseIngredient';
import { embedAllRecipes } from './kitchen';

const API = 'https://www.themealdb.com/api/json/v1/1';
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

interface MealDbMeal {
  idMeal: string; strMeal: string; strCategory: string | null; strArea: string | null;
  strInstructions: string | null; strMealThumb: string | null; strTags: string | null;
  strYoutube: string | null; strSource: string | null;
  [key: string]: string | null;
}

export interface ImportStatus { running: boolean; fetched: number; saved: number; embedded: number; error: string | null; finishedAt: string | null }
const status: ImportStatus = { running: false, fetched: 0, saved: 0, embedded: 0, error: null, finishedAt: null };

export async function libraryStatus() {
  const [total, embedded] = await Promise.all([
    prisma.recipe.count({ where: { source: 'library' } }),
    prisma.recipe.count({ where: { source: 'library', embeddingKey: { not: null } } }),
  ]);
  return { ...status, total, embeddedTotal: embedded };
}

/** TheMealDB meal -> our recipe shape (ingredients parsed into quantity + unit + store aisle). */
export function toRecipe(meal: MealDbMeal) {
  const ingredients = Array.from({ length: 20 }, (_, i) => ({ name: meal[`strIngredient${i + 1}`]?.trim(), measure: meal[`strMeasure${i + 1}`] }))
    .filter((x): x is { name: string; measure: string | null } => !!x.name)
    .map((x, i) => {
      const { quantity, unit } = parseMeasure(x.measure);
      return { name: x.name.toLowerCase(), displayName: x.name, quantity, unit, storeSection: guessStoreSection(x.name), sortOrder: i };
    });
  const steps = (meal.strInstructions ?? '')
    .split(/\r?\n+/).map(s => s.replace(/^(step\s*)?\d+[.):]?\s*/i, '').trim()).filter(s => s.length > 3)
    .map((s, i) => `${i + 1}. ${s}`).join('\n');
  return {
    name: meal.strMeal.trim(),
    description: [meal.strArea, meal.strCategory].filter(Boolean).join(' · ') || null,
    steps: steps || null,
    defaultServings: 4,
    imageUrl: meal.strMealThumb,
    cuisine: meal.strArea && meal.strArea !== 'Unknown' ? meal.strArea : null,
    category: meal.strCategory,
    tags: meal.strTags?.split(',').map(t => t.trim()).filter(Boolean).join(', ') || null,
    videoUrl: meal.strYoutube || null,
    sourceUrl: meal.strSource || null,
    source: 'library',
    externalId: `mealdb:${meal.idMeal}`,
    ingredients,
  };
}

async function fetchLetter(letter: string): Promise<MealDbMeal[]> {
  const response = await fetch(`${API}/search.php?f=${letter}`, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`TheMealDB returned ${response.status}`);
  return ((await response.json()) as { meals: MealDbMeal[] | null }).meals ?? [];
}

async function upsert(recipe: ReturnType<typeof toRecipe>) {
  const { ingredients, ...data } = recipe;
  const existing = await prisma.recipe.findUnique({ where: { externalId: data.externalId }, select: { id: true, saved: true } });
  if (existing) {
    await prisma.$transaction([
      prisma.ingredient.deleteMany({ where: { recipeId: existing.id } }),
      prisma.recipe.update({ where: { id: existing.id }, data: { ...data, saved: existing.saved, ingredients: { create: ingredients } } }),
    ]);
  } else {
    // a user recipe with the same name keeps priority; the library copy is skipped
    if (await prisma.recipe.findFirst({ where: { name: data.name, source: { not: 'library' } }, select: { id: true } })) return false;
    await prisma.recipe.create({ data: { ...data, saved: false, ingredients: { create: ingredients } } });
  }
  return true;
}

/** Gives saved recipes without a photo the photo of a library recipe with the same name. */
async function borrowPhotos() {
  const withoutPhoto = await prisma.recipe.findMany({ where: { imageUrl: null }, select: { id: true, name: true } });
  for (const r of withoutPhoto) {
    const words = r.name.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const match = await prisma.recipe.findFirst({
      where: { source: 'library', imageUrl: { not: null }, AND: words.map(w => ({ name: { contains: w } })) },
      select: { imageUrl: true },
    });
    if (match) await prisma.recipe.update({ where: { id: r.id }, data: { imageUrl: match.imageUrl } });
  }
}

/** Starts the import in the background; poll libraryStatus() for progress. */
export function startLibraryImport(): ImportStatus {
  if (status.running) return status;
  Object.assign(status, { running: true, fetched: 0, saved: 0, embedded: 0, error: null, finishedAt: null });
  (async () => {
    try {
      for (let i = 0; i < LETTERS.length; i += 4) {
        const batches = await Promise.all(LETTERS.slice(i, i + 4).map(fetchLetter));
        for (const meal of batches.flat()) {
          status.fetched++;
          if (await upsert(toRecipe(meal))) status.saved++;
        }
      }
      await borrowPhotos();
      // 0 without a Gemini key: keyword search still works
      status.embedded = await embedAllRecipes(n => { status.embedded = n; });
    } catch (error) {
      status.error = error instanceof Error ? error.message : String(error);
      console.error('[library] import failed:', status.error);
    } finally {
      status.running = false;
      status.finishedAt = new Date().toISOString();
    }
  })();
  return status;
}

export async function facets() {
  const [cuisines, categories] = await Promise.all([
    prisma.recipe.groupBy({ by: ['cuisine'], _count: true, where: { cuisine: { not: null } }, orderBy: { cuisine: 'asc' } }),
    prisma.recipe.groupBy({ by: ['category'], _count: true, where: { category: { not: null } }, orderBy: { category: 'asc' } }),
  ]);
  return {
    cuisines: cuisines.map(c => ({ name: c.cuisine!, count: c._count })),
    categories: categories.map(c => ({ name: c.category!, count: c._count })),
  };
}
