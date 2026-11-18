/**
 * Kitchen intelligence: ranks recipes against what you have, what's expiring,
 * your dietary constraints and what you ate recently. Every feature works without AI;
 * Gemini only adds semantic search (RAG over your recipes) and nicer wording.
 */
import { createHash } from 'crypto';
import { z } from 'zod';
import prisma from '../prisma';
import { normalizeIngredientName } from '../engine/normalize';
import { conflictsWithConstraint, normalizeConstraintValue, findSubstitution, CONSTRAINT_KEYWORDS } from '../engine/generate';
import { SynonymMap } from '../engine/types';
import { ask, withFallback, embed, cosineSimilarity, isAiEnabled, Sourced } from '../ai/client';
import { findCommonSwaps } from '../ai/data/commonSwaps';
import { estimateIngredient, addMacros, roundMacros, ZERO_MACROS, Macros } from '../ai/data/nutrition';
import { startOfToday, HttpError } from '../lib/http';

// basics nearly every kitchen has; they don't count as "missing"
const ALWAYS_AVAILABLE = new Set(['water', 'ice', 'salt', 'pepper', 'black pepper', 'salt and pepper', 'sea salt']);
const EXPIRING_SOON_DAYS = 3;
const DAY_MS = 86_400_000;

// ---------------------------------------------------------------- context

export async function loadSynonymMap(): Promise<SynonymMap> {
  const synonyms = await prisma.ingredientSynonym.findMany();
  return Object.fromEntries(synonyms.map(s => [s.synonym.toLowerCase(), s.canonicalName.toLowerCase()]));
}

export type Scope = 'all' | 'mine';
type RecipeWithIngredients = Awaited<ReturnType<typeof loadRecipes>>[number];
// embeddings are large; they live in an in-memory cache (see vectorsFor), not in every query
const loadRecipes = (scope: Scope = 'all') => prisma.recipe.findMany({
  where: scope === 'mine' ? { saved: true } : {},
  include: { ingredients: { orderBy: { sortOrder: 'asc' } } },
  omit: { embedding: true },
  orderBy: { name: 'asc' },
});

export interface PantryStock { name: string; quantity: number; unit: string; daysLeft: number | null }

async function loadContext(scope: Scope = 'all') {
  const today = startOfToday();
  const [recipes, pantryRows, constraints, rules, synonymMap, nearbyMeals, slotHistory] = await Promise.all([
    loadRecipes(scope),
    prisma.pantryItem.findMany(),
    prisma.userConstraint.findMany({ where: { isActive: true } }),
    prisma.substitution.findMany(),
    loadSynonymMap(),
    prisma.mealPlanEntry.findMany({
      where: { isLeftover: false, planDate: { gte: new Date(today.getTime() - 3 * DAY_MS), lt: new Date(today.getTime() + 4 * DAY_MS) } },
      select: { recipeId: true },
    }),
    prisma.mealPlanEntry.groupBy({ by: ['recipeId', 'mealSlot'] }),
  ]);

  const pantry: PantryStock[] = pantryRows
    .map(p => ({
      name: normalizeIngredientName(p.name, synonymMap), quantity: p.quantity, unit: p.unit,
      daysLeft: p.expirationDate ? Math.round((p.expirationDate.getTime() - today.getTime()) / DAY_MS) : null,
    }))
    .filter(p => p.daysLeft === null || p.daysLeft >= 0);

  const constraintValues = constraints.map(c => normalizeConstraintValue(c.constraintValue));
  const activeRules = rules
    .filter(r => constraintValues.includes(normalizeConstraintValue(r.constraintValue)))
    .map(r => ({ ...r, original: normalizeIngredientName(r.originalIngredient, synonymMap) }));

  return { recipes, pantry, constraintValues, activeRules, allRules: rules, synonymMap, recentRecipeIds: new Set(nearbyMeals.map(m => m.recipeId)),
    breakfastOnly: breakfastOnlyRecipes(slotHistory) };
}
type KitchenContext = Awaited<ReturnType<typeof loadContext>>;

/** Recipes that have only ever been planned for breakfast (so not a dinner idea). */
function breakfastOnlyRecipes(history: { recipeId: string; mealSlot: string }[]): Set<string> {
  const slots = new Map<string, Set<string>>();
  for (const h of history) slots.set(h.recipeId, (slots.get(h.recipeId) ?? new Set()).add(h.mealSlot));
  return new Set([...slots].filter(([, s]) => s.size === 1 && s.has('breakfast')).map(([id]) => id));
}

/** "unsalted butter" -> butter, "red onion" -> onion; but "coconut milk" is not milk. */
const DESCRIPTORS = new Set(['unsalted', 'salted', 'red', 'white', 'yellow', 'green', 'brown', 'fresh', 'large', 'small', 'medium', 'whole', 'free-range', 'organic', 'chopped', 'minced', 'grated', 'plain', 'full-fat', 'skimmed', 'semi-skimmed', 'boneless', 'skinless', 'baby', 'ripe', 'dried', 'frozen']);
export const describes = (ingredient: string, base: string) =>
  ingredient.endsWith(' ' + base) && ingredient.slice(0, -base.length - 1).split(' ').every(w => DESCRIPTORS.has(w));

/** "chicken" in the pantry covers "chicken breast" and "unsalted butter" is covered by "butter". */
function findInPantry(ingredient: string, pantry: PantryStock[]): PantryStock | undefined {
  return pantry.find(p => p.name === ingredient || ingredient.startsWith(p.name + ' ') || p.name.startsWith(ingredient + ' ') || describes(ingredient, p.name));
}

// ---------------------------------------------------------------- scoring

export interface RecipeMatch {
  recipeId: string;
  name: string;
  description: string | null;
  defaultServings: number;
  imageUrl: string | null;
  cuisine: string | null;
  category: string | null;
  saved: boolean;
  have: string[];
  missing: string[];
  expiring: { name: string; daysLeft: number }[];
  conflicts: { ingredient: string; constraint: string }[];
  coverage: number;
  recentlyPlanned: boolean;
  relevance: number;
  score: number;
  reason: string;
}

function analyzeRecipe(recipe: RecipeWithIngredients, ctx: KitchenContext): Omit<RecipeMatch, 'relevance' | 'score' | 'reason'> {
  const have: string[] = [], missing: string[] = [];
  const expiring: RecipeMatch['expiring'] = [];
  const conflicts: RecipeMatch['conflicts'] = [];

  for (const ing of recipe.ingredients) {
    const name = normalizeIngredientName(ing.name, ctx.synonymMap);
    if (ALWAYS_AVAILABLE.has(name)) continue;
    const stock = findInPantry(name, ctx.pantry);
    if (stock) {
      have.push(name);
      if (stock.daysLeft !== null && stock.daysLeft <= EXPIRING_SOON_DAYS) expiring.push({ name, daysLeft: stock.daysLeft });
    } else {
      missing.push(name);
    }
    // a conflict only counts if no active substitution rule handles it
    if (!findSubstitution(name, ctx.activeRules)) {
      const constraint = ctx.constraintValues.find(c => conflictsWithConstraint(name, c));
      if (constraint) conflicts.push({ ingredient: name, constraint });
    }
  }
  const total = have.length + missing.length;
  return {
    recipeId: recipe.id, name: recipe.name, description: recipe.description, defaultServings: recipe.defaultServings,
    imageUrl: recipe.imageUrl, cuisine: recipe.cuisine, category: recipe.category, saved: recipe.saved,
    have, missing, expiring, conflicts,
    coverage: total ? have.length / total : 0,
    recentlyPlanned: ctx.recentRecipeIds.has(recipe.id),
  };
}

function describe(m: Omit<RecipeMatch, 'reason'>): string {
  const parts: string[] = [];
  const total = m.have.length + m.missing.length;
  if (m.expiring.length) {
    const e = [...m.expiring].sort((a, b) => a.daysLeft - b.daysLeft)[0];
    parts.push(`uses your ${e.name} before it expires ${e.daysLeft === 0 ? 'today' : e.daysLeft === 1 ? 'tomorrow' : `in ${e.daysLeft} days`}`);
  }
  parts.push(m.missing.length === 0 ? 'you have everything' : `you have ${m.have.length} of ${total} ingredients`);
  if (m.conflicts.length) parts.push(`contains ${m.conflicts[0].ingredient} (${m.conflicts[0].constraint})`);
  else if (m.recentlyPlanned) parts.push('you had it recently');
  const text = parts.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function scoreOf(m: Omit<RecipeMatch, 'score' | 'reason'>, hasQuery: boolean): number {
  const pantryScore = m.coverage * 60 + Math.min(m.expiring.length, 3) * 15 - m.conflicts.length * 50 - (m.recentlyPlanned ? 20 : 0) + (m.saved ? 5 : 0);
  return hasQuery ? m.relevance * 100 + pantryScore * 0.4 : pantryScore;
}

// ---------------------------------------------------------------- hybrid search (RAG): embeddings + keywords

const STOPWORDS = new Set(['the', 'and', 'with', 'for', 'something', 'some', 'want', 'make', 'can', 'what', 'using', 'use', 'that', 'have', 'quick', 'easy', 'dish', 'recipe', 'recipes', 'food', 'tonight', 'today', 'like', 'good', 'nice', 'cook', 'meal', 'eat']);

/** The text that represents a recipe for retrieval. Changing it re-embeds the recipe. */
function recipeText(r: RecipeWithIngredients): string {
  return [
    r.name,
    [r.cuisine, r.category, r.tags].filter(Boolean).join(', '),
    r.description ?? '',
    `Ingredients: ${r.ingredients.map(i => i.name).join(', ')}`,
    (r.steps ?? '').slice(0, 600),
  ].filter(Boolean).join('. ');
}

/** Keyword relevance 0..1: name and tags weigh more than ingredients and steps. */
function keywordRelevance(query: string, r: RecipeWithIngredients): number {
  const constraintWords = new Set(Object.keys(CONSTRAINT_KEYWORDS).flatMap(c => c.split('-')));
  const tokens = query.toLowerCase().split(/[^a-z]+/).filter(t => t.length > 2 && !STOPWORDS.has(t) && !constraintWords.has(t)).map(t => t.replace(/(es|s)$/, ''));
  if (tokens.length === 0) return 0;
  const name = r.name.toLowerCase();
  const labels = [r.cuisine, r.category, r.tags].filter(Boolean).join(' ').toLowerCase();
  const ingredients = r.ingredients.map(i => i.name).join(' ').toLowerCase();
  const body = `${r.description ?? ''} ${r.steps ?? ''}`.toLowerCase();
  const score = tokens.reduce((sum, t) => sum + (name.includes(t) ? 1 : labels.includes(t) ? 0.8 : ingredients.includes(t) ? 0.6 : body.includes(t) ? 0.25 : 0), 0);
  return score / tokens.length;
}

// recipe id -> { key of embedded text, vector }; filled from the DB once, then kept in sync
const vectorCache = new Map<string, { key: string; vector: number[] }>();
let vectorCacheLoaded = false;
// free tier allows 100 embedded texts per minute, so work in batches below that
const EMBED_BATCH = 90;

/**
 * Vectors for these recipes; embeds (and stores) up to `budget` new or changed ones per call,
 * so a search never waits on hundreds of embeddings. null if AI is unavailable.
 */
async function vectorsFor(recipes: RecipeWithIngredients[], budget = EMBED_BATCH): Promise<Map<string, number[]> | null> {
  if (!isAiEnabled()) return null;
  if (!vectorCacheLoaded) {
    const rows = await prisma.recipe.findMany({ where: { embeddingKey: { not: null } }, select: { id: true, embeddingKey: true, embedding: true } });
    for (const row of rows) if (Array.isArray(row.embedding)) vectorCache.set(row.id, { key: row.embeddingKey!, vector: row.embedding as number[] });
    vectorCacheLoaded = true;
  }
  const keyOf = (r: RecipeWithIngredients) => createHash('sha1').update(recipeText(r)).digest('hex');
  const stale = recipes.filter(r => vectorCache.get(r.id)?.key !== keyOf(r)).slice(0, budget);
  for (let i = 0; i < stale.length; i += EMBED_BATCH) {
    const batch = stale.slice(i, i + EMBED_BATCH);
    const vectors = await embed(batch.map(recipeText), 'RETRIEVAL_DOCUMENT');
    if (!vectors) return vectorCache.size ? new Map([...vectorCache].map(([id, v]) => [id, v.vector])) : null;
    await prisma.$transaction(batch.map((r, j) => prisma.recipe.update({ where: { id: r.id }, data: { embedding: vectors[j], embeddingKey: keyOf(r) } })));
    batch.forEach((r, j) => vectorCache.set(r.id, { key: keyOf(r), vector: vectors[j] }));
  }
  return new Map([...vectorCache].map(([id, v]) => [id, v.vector]));
}

/**
 * Embeds every recipe that isn't embedded yet (after importing the library), one batch per
 * minute to stay inside the free quota. Reports progress through `onProgress`.
 */
export async function embedAllRecipes(onProgress: (embedded: number) => void = () => {}): Promise<number> {
  const recipes = await loadRecipes('all');
  let embedded = 0;
  for (let attempt = 0; attempt < 30; attempt++) {
    const vectors = await vectorsFor(recipes);
    if (!vectors) return embedded;
    embedded = recipes.filter(r => vectors.has(r.id)).length;
    onProgress(embedded);
    if (embedded >= recipes.length) break;
    await new Promise(resolve => setTimeout(resolve, 61_000));
  }
  return embedded;
}

/** Words in the query like "vegetarian" or "dairy free" act as hard filters. */
function constraintsInQuery(query: string): string[] {
  const q = normalizeConstraintValue(query);
  return Object.keys(CONSTRAINT_KEYWORDS).filter(c => q.includes(c));
}

export interface SearchOptions { query?: string; limit?: number; scope?: Scope; cuisine?: string; category?: string }

export async function recommend(options: SearchOptions = {}): Promise<Sourced<RecipeMatch[]> & { semantic: boolean }> {
  return rankRecipes(await loadContext(options.scope), options);
}

async function rankRecipes(ctx: KitchenContext, { query = '', limit = 12, cuisine, category }: SearchOptions): Promise<Sourced<RecipeMatch[]> & { semantic: boolean }> {
  const trimmed = query.trim();
  const queryConstraints = trimmed ? constraintsInQuery(trimmed) : [];
  const recipes = ctx.recipes.filter(r =>
    (!cuisine || r.cuisine === cuisine) && (!category || r.category === category) &&
    queryConstraints.every(c => !r.ingredients.some(i => conflictsWithConstraint(normalizeIngredientName(i.name, ctx.synonymMap), c))));

  let relevance = new Map<string, number>();
  let semantic = false;
  if (trimmed) {
    const keyword = new Map(recipes.map(r => [r.id, keywordRelevance(trimmed, r)]));
    const vectors = await vectorsFor(recipes);
    const queryVector = vectors ? (await embed([trimmed], 'RETRIEVAL_QUERY'))?.[0] : null;
    if (vectors && queryVector) {
      semantic = true;
      // cosine for this model sits ~0.5 (unrelated) .. ~0.8 (very related); spread it to 0..1, then blend with keywords
      relevance = new Map(recipes.map(r => {
        const v = vectors.get(r.id);
        const sem = v ? Math.max(0, Math.min(1, (cosineSimilarity(queryVector, v) - 0.5) / 0.3)) : 0;
        return [r.id, 0.7 * sem + 0.3 * Math.min(1, keyword.get(r.id) ?? 0)];
      }));
    } else {
      relevance = keyword;
    }
  }

  let matches = recipes.map(r => {
    const analysis = analyzeRecipe(r, ctx);
    const withRelevance = { ...analysis, relevance: Math.round((relevance.get(r.id) ?? 0) * 100) / 100 };
    const scored = { ...withRelevance, score: Math.round(scoreOf(withRelevance, !!trimmed)) };
    return { ...scored, reason: describe(scored) };
  });
  if (trimmed) {
    // keep results close to the best match, so pantry coverage can't pull in unrelated dishes
    const best = Math.max(0, ...matches.map(m => m.relevance));
    matches = best > 0 ? matches.filter(m => m.relevance >= best * (semantic ? 0.75 : 0.5)) : [];
  }
  matches.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return { data: matches.slice(0, limit), source: semantic ? 'ai' : 'fallback', semantic };
}


// ---------------------------------------------------------------- what's for dinner

export interface DinnerPick { pick: RecipeMatch | null; pitch: string; alternatives: RecipeMatch[] }

const NOT_DINNER = new Set(['Breakfast', 'Dessert', 'Side', 'Starter']);

export async function whatsForDinner(): Promise<Sourced<DinnerPick>> {
  const ctx = await loadContext();
  const { data: ranked } = await rankRecipes(ctx, { limit: 50 });
  // best first: no constraint conflicts, not a breakfast dish, not eaten in the last few days
  const ok = ranked.filter(m => m.conflicts.length === 0 && !ctx.breakfastOnly.has(m.recipeId) && !NOT_DINNER.has(m.category ?? ''));
  const ordered = [...ok.filter(m => !m.recentlyPlanned), ...ok.filter(m => m.recentlyPlanned)];
  const [pick, ...alternatives] = ordered.length ? ordered : ranked;
  if (!pick) return { data: { pick: null, pitch: 'Add a few recipes and pantry items and I will suggest dinner.', alternatives: [] }, source: 'fallback' };

  const result = await withFallback(
    () => ask(z.object({ pitch: z.string().max(220) }),
      `Write one friendly sentence (max 25 words) recommending "${pick.name}" for dinner tonight. ` +
      `Facts: have ${pick.have.join(', ') || 'nothing'}; missing ${pick.missing.join(', ') || 'nothing'}; ` +
      `expiring soon: ${pick.expiring.map(e => e.name).join(', ') || 'none'}. Do not invent other facts.`, { timeoutMs: 6000 })
      .then(r => r?.pitch ?? null),
    () => `${pick.reason}.`,
  );
  return { data: { pick, pitch: result.data, alternatives: alternatives.slice(0, 2) }, source: result.source };
}

// ---------------------------------------------------------------- recipe fixer

const swapSchema = z.object({
  fixes: z.array(z.object({
    ingredient: z.string(),
    options: z.array(z.object({ name: z.string(), ratio: z.number(), note: z.string() })).max(3),
  })),
});

export interface FixOption { name: string; ratio: number; note: string; inPantry: boolean; fromRule: boolean }
export interface IngredientFix { ingredient: string; options: FixOption[] }
export interface RecipeFix { recipe: RecipeMatch; fixes: IngredientFix[] }

/**
 * Substitutes for each ingredient: your own rules first, then Gemini (or the built-in
 * swap list without AI). Options you already have in the pantry are ranked first.
 */
async function substitutesFor(ingredients: string[], ctx: KitchenContext, dish?: string): Promise<Sourced<IngredientFix[]>> {
  const inPantry = (name: string) => !!findInPantry(normalizeIngredientName(name, ctx.synonymMap), ctx.pantry);
  const ruleOptions = (ingredient: string): FixOption[] => ctx.allRules
    .filter(r => findSubstitution(ingredient, [{ ...r, original: normalizeIngredientName(r.originalIngredient, ctx.synonymMap) }]))
    .map(r => ({ name: r.substituteIngredient, ratio: r.quantityRatio, note: `Your rule (${r.constraintValue})`, inPantry: inPantry(r.substituteIngredient), fromRule: true }));
  const build = (ingredient: string, extra: { name: string; ratio: number; note: string }[]): IngredientFix => {
    const seen = new Set<string>();
    const options = [...ruleOptions(ingredient), ...extra.map(o => ({ ...o, name: o.name.toLowerCase(), inPantry: inPantry(o.name), fromRule: false }))]
      .filter(o => o.name !== ingredient && !seen.has(o.name) && seen.add(o.name))
      .sort((a, b) => Number(b.inPantry) - Number(a.inPantry) || Number(b.fromRule) - Number(a.fromRule))
      .slice(0, 4);
    return { ingredient, options };
  };

  return withFallback(async () => {
    if (ingredients.length === 0) return [];
    const reply = await ask(swapSchema,
      (dish ? `Recipe: ${dish}. ` : '') + `Ingredients needing substitutes: ${ingredients.join(', ')}. ` +
      `Pantry: ${ctx.pantry.map(p => p.name).join(', ') || 'empty'}. Dietary constraints: ${ctx.constraintValues.join(', ') || 'none'}. ` +
      `For each ingredient give up to 3 practical cooking substitutes, preferring pantry items and respecting the constraints. ` +
      `ratio = amount of substitute per 1 unit of the original. Keep notes under 12 words.`);
    if (!reply) return null;
    return ingredients.map(i => build(i, reply.fixes.find(f => f.ingredient.toLowerCase() === i)?.options ?? findCommonSwaps(i)));
  }, () => ingredients.map(i => build(i, findCommonSwaps(i))));
}

export async function fixRecipe(recipeId: string): Promise<Sourced<RecipeFix>> {
  const ctx = await loadContext();
  const recipe = ctx.recipes.find(r => r.id === recipeId);
  if (!recipe) throw new HttpError(404, 'Recipe not found');
  const analysis = analyzeRecipe(recipe, ctx);
  const scored = { ...analysis, relevance: 0, score: 0 };
  // missing ingredients and ones that break a constraint both need a fix
  const needsFix = [...new Set([...analysis.missing, ...analysis.conflicts.map(c => c.ingredient)])];
  const fixes = await substitutesFor(needsFix, ctx, recipe.name);
  return { data: { recipe: { ...scored, reason: describe(scored) }, fixes: fixes.data }, source: fixes.source };
}

export async function suggestSubstitutes(ingredient: string): Promise<Sourced<IngredientFix>> {
  const ctx = await loadContext();
  const name = normalizeIngredientName(ingredient, ctx.synonymMap);
  const result = await substitutesFor([name], ctx);
  return { data: result.data[0], source: result.source };
}

// ---------------------------------------------------------------- new recipe ideas from the pantry

const ideaSchema = z.object({
  ideas: z.array(z.object({
    name: z.string(),
    description: z.string(),
    servings: z.number().int().min(1).max(12),
    cookingTime: z.number().int().min(1).max(600),
    ingredients: z.array(z.object({
      name: z.string(), quantity: z.number().positive(), unit: z.string(),
      storeSection: z.enum(['produce', 'dairy', 'meat', 'pantry', 'bakery', 'frozen', 'other']),
    })).min(1),
    steps: z.array(z.string()).min(1),
  })).max(3),
});
export type RecipeIdea = z.infer<typeof ideaSchema>['ideas'][number] & { existingRecipeId?: string };

export async function pantryIdeas(): Promise<Sourced<RecipeIdea[]>> {
  const ctx = await loadContext();
  const expiring = ctx.pantry.filter(p => p.daysLeft !== null && p.daysLeft <= EXPIRING_SOON_DAYS).map(p => p.name);
  return withFallback(
    async () => (await ask(ideaSchema,
      `Pantry: ${ctx.pantry.map(p => `${p.name} (${p.quantity} ${p.unit})`).join(', ') || 'empty'}. ` +
      `Use first (expiring): ${expiring.join(', ') || 'none'}. Dietary constraints: ${ctx.constraintValues.join(', ') || 'none'}. ` +
      `Existing recipes (do not repeat): ${ctx.recipes.map(r => r.name).join(', ')}. ` +
      `Suggest 3 realistic home recipes that mostly use the pantry. Use lowercase ingredient names and units from: g, kg, ml, l, cup, tbsp, tsp, piece, clove, can, bunch.`,
      { cache: false }))?.ideas ?? null,
    async () => {
      // without AI: the best-matching recipes you already have
      const { data } = await recommend({ limit: 3 });
      return data.map(m => {
        const recipe = ctx.recipes.find(r => r.id === m.recipeId)!;
        return {
          name: m.name, description: m.reason, servings: recipe.defaultServings, cookingTime: 0,
          ingredients: recipe.ingredients.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit, storeSection: i.storeSection as RecipeIdea['ingredients'][number]['storeSection'] })),
          steps: recipe.steps ? recipe.steps.split(/\n+/).filter(Boolean) : [],
          existingRecipeId: recipe.id,
        };
      });
    },
  );
}

// ---------------------------------------------------------------- nutrition

export interface DayNutrition extends Macros { date: string; day: string; meals: number; coverage: number }

const nutritionSchema = z.object({
  days: z.array(z.object({ date: z.string(), calories: z.number(), protein: z.number(), carbs: z.number(), fats: z.number() })),
});

/** Per-person nutrition for each day of a week (sum of one serving of every planned meal). */
export async function weeklyNutrition(weekStart: string): Promise<Sourced<DayNutrition[]>> {
  const start = new Date(weekStart);
  const end = new Date(start.getTime() + 7 * DAY_MS);
  const [entries, synonymMap] = await Promise.all([
    prisma.mealPlanEntry.findMany({
      where: { planDate: { gte: start, lt: end } },
      include: { recipe: { include: { ingredients: true } } }, orderBy: { planDate: 'asc' },
    }),
    loadSynonymMap(),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    const meals = entries.filter(e => e.planDate.toISOString().slice(0, 10) === date);
    return { date, day: new Date(date).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }), meals };
  });

  const perServingLines = (e: typeof entries[number]) => e.recipe.ingredients.map(i => ({
    name: normalizeIngredientName(i.name, synonymMap), quantity: i.quantity / e.recipe.defaultServings, unit: i.unit,
  }));

  const fallback = (): DayNutrition[] => days.map(d => {
    let total = ZERO_MACROS, known = 0, lines = 0;
    for (const meal of d.meals) for (const line of perServingLines(meal)) {
      lines++;
      const m = estimateIngredient(line.name, line.quantity, line.unit);
      if (m) { total = addMacros(total, m); known++; }
    }
    return { date: d.date, day: d.day, meals: d.meals.length, coverage: lines ? Math.round((known / lines) * 100) / 100 : 1, ...roundMacros(total) };
  });

  return withFallback(async () => {
    const planned = days.filter(d => d.meals.length);
    if (planned.length === 0) return fallback();
    const description = planned.map(d => `${d.date}: ` + d.meals.map(m =>
      `${m.recipe.name} [${perServingLines(m).map(l => `${+l.quantity.toFixed(2)} ${l.unit} ${l.name}`).join(', ')}]`).join(' | ')).join('\n');
    const reply = await ask(nutritionSchema,
      `Estimate nutrition for ONE person per day. Each meal lists ingredients for one serving.\n${description}\n` +
      `Return calories (kcal) and protein, carbs, fats (grams) per date.`);
    if (!reply) return null;
    return days.map(d => {
      const ai = reply.days.find(x => x.date === d.date);
      return { date: d.date, day: d.day, meals: d.meals.length, coverage: 1, ...roundMacros(ai && d.meals.length ? ai : ZERO_MACROS) };
    });
  }, fallback);
}

// ---------------------------------------------------------------- cost

const costSchema = z.object({
  total: z.number(),
  items: z.array(z.object({ item: z.string(), cost: z.number() })),
});

/** Grocery cost in INR. AI only: a made-up fallback number would be misleading. */
export interface CostEstimate { total: number | null; items: { item: string; cost: number }[] }

export async function estimateCost(items: { name: string; quantity: number; unit: string }[]): Promise<Sourced<CostEstimate>> {
  return withFallback<CostEstimate>(
    async () => items.length === 0 ? null : ask(costSchema,
      `Estimate typical 2025 retail prices in India (INR) for buying these grocery quantities: ` +
      `${items.map(i => `${i.quantity} ${i.unit} ${i.name}`).join(', ')}. Give a cost per item and the total.`),
    () => ({ total: items.length === 0 ? 0 : null, items: [] }),
  );
}

// ---------------------------------------------------------------- scan a fridge / receipt photo (Gemini Vision)

const scanSchema = z.object({
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number().positive(),
    unit: z.enum(['g', 'kg', 'ml', 'l', 'piece', 'packet', 'can', 'bunch', 'cup']),
    expiresInDays: z.number().int().min(0).max(365).nullable(),
  })).max(60),
});
export type ScannedItem = z.infer<typeof scanSchema>['items'][number];

/** Reads groceries from a photo. Needs AI (there is no non-AI way to read an image); null otherwise. */
export async function scanGroceries(imageBase64: string, mimeType: string, kind: 'fridge' | 'receipt'): Promise<ScannedItem[] | null> {
  const instruction = kind === 'receipt'
    ? 'This is a grocery receipt. List each food item bought with its quantity and unit (use the pack size when shown). Skip non-food items, prices and totals.'
    : 'This is a photo of a fridge, pantry shelf or groceries. List each food item you can clearly see with a realistic quantity and unit. Do not guess hidden items.';
  const result = await ask(scanSchema, [
    { text: `${instruction} Use simple lowercase ingredient names (e.g. "tomato", "milk", "chicken breast"). ` +
      'expiresInDays: typical shelf life from today for fresh items (milk 5, leafy greens 4, meat 2, eggs 21), null for long-life items.' },
    { inlineData: { mimeType, data: imageBase64 } },
  ], { cache: false });
  return result?.items ?? null;
}
