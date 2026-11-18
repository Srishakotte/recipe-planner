/**
 * Sous-chef: Gemini answers questions and plans meals by calling tools that read (RAG over the cookbook +
 * your real pantry, plan and list). It never writes directly; changes come back as proposed actions that
 * the user applies with one click in the UI.
 */
import prisma from '../prisma';
import { chatWithTools, ChatMessage, ToolDefinition } from '../ai/client';
import { recommend, whatsForDinner, RecipeMatch } from './kitchen';
import { startOfToday, toIsoDate } from '../lib/http';
import { itemsToBuy } from './grocery';

export type ProposedAction =
  | { type: 'add_meal'; recipeId: string; recipeName: string; planDate: string; mealSlot: string; servings: number }
  | { type: 'remove_meal'; mealId: string; recipeName: string; planDate: string; mealSlot: string };

/** Recipes the assistant retrieved (RAG sources) and the steps it took, shown in the chat. */
export interface SourceRecipe { recipeId: string; name: string; imageUrl: string | null; cuisine: string | null; coverage: number }
interface Session { actions: ProposedAction[]; trace: string[]; retrieved: Map<string, SourceRecipe> }

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const remember = (session: Session, m: RecipeMatch) => session.retrieved.set(m.recipeId, { recipeId: m.recipeId, name: m.name, imageUrl: m.imageUrl, cuisine: m.cuisine, coverage: m.coverage });
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function buildTools(session: Session): ToolDefinition[] {
  const { actions, trace } = session;
  return [
    {
      name: 'search_recipes',
      description: 'Search the cookbook (the user\'s recipes plus a library of ~900 real recipes) by meaning, e.g. "vegetarian curry", "uses spinach", "quick Italian dinner". Results are ranked by match and by what is in the pantry. Leave query empty for the best options right now.',
      parameters: { type: 'object', properties: { query: { type: 'string' } } },
      run: async ({ query }) => {
        trace.push(query ? `Searched the cookbook for "${query}"` : 'Ranked recipes by your pantry');
        const { data } = await recommend({ query: query ?? '', limit: 8 });
        data.forEach(m => remember(session, m));
        return data.map(m => ({
          recipe_id: m.recipeId, name: m.name, cuisine: m.cuisine, category: m.category, servings: m.defaultServings,
          missing: m.missing, expiring_used: m.expiring.map(e => e.name), conflicts: m.conflicts, why: m.reason,
        }));
      },
    },
    {
      name: 'whats_for_dinner',
      description: 'Get the single best dinner suggestion for tonight with alternatives.',
      parameters: { type: 'object', properties: {} },
      run: async () => {
        trace.push('Picked the best dinner for tonight');
        const { data } = await whatsForDinner();
        [data.pick, ...data.alternatives].forEach(m => m && remember(session, m));
        return { pick: data.pick && { recipe_id: data.pick.recipeId, name: data.pick.name, why: data.pick.reason }, alternatives: data.alternatives.map(a => a.name) };
      },
    },
    {
      name: 'get_pantry',
      description: 'List pantry items with quantity and days until expiry.',
      parameters: { type: 'object', properties: {} },
      run: async () => {
        trace.push('Checked your pantry');
        const today = startOfToday().getTime();
        return (await prisma.pantryItem.findMany({ orderBy: { name: 'asc' } })).map(p => ({
          name: p.name, quantity: p.quantity, unit: p.unit,
          days_left: p.expirationDate ? Math.round((p.expirationDate.getTime() - today) / 86_400_000) : null,
        }));
      },
    },
    {
      name: 'get_meal_plan',
      description: 'List planned meals between two dates (inclusive), with meal ids.',
      parameters: {
        type: 'object',
        properties: { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' } },
        required: ['from', 'to'],
      },
      run: async ({ from, to }) => {
        trace.push(`Read your meal plan (${from} to ${to})`);
        const end = new Date(to); end.setDate(end.getDate() + 1);
        const meals = await prisma.mealPlanEntry.findMany({
          where: { planDate: { gte: new Date(from), lt: end } },
          include: { recipe: { select: { name: true } } }, orderBy: [{ planDate: 'asc' }, { mealSlot: 'asc' }],
        });
        return meals.map(m => ({ meal_id: m.id, date: isoDate(m.planDate), slot: m.mealSlot, recipe: m.recipe.name, servings: m.servings, leftover: m.isLeftover }));
      },
    },
    {
      name: 'get_grocery_list',
      description: 'Items still to buy on the current grocery list.',
      parameters: { type: 'object', properties: {} },
      run: async () => { trace.push('Read your grocery list'); return (await itemsToBuy()).map(i => `${i.quantity} ${i.unit} ${i.name}`); },
    },
    {
      name: 'propose_add_meal',
      description: 'Propose adding a recipe (any recipe_id from search_recipes) to the meal plan. The user confirms it in the app; it is not saved yet.',
      parameters: {
        type: 'object',
        properties: {
          recipe_id: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          slot: { type: 'string', enum: SLOTS },
          servings: { type: 'integer', minimum: 1, maximum: 20 },
        },
        required: ['recipe_id', 'date', 'slot'],
      },
      run: async ({ recipe_id, date, slot, servings }) => {
        const recipe = await prisma.recipe.findUnique({ where: { id: recipe_id } });
        if (!recipe) return { error: 'No recipe with that id. Use search_recipes first.' };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'date must be YYYY-MM-DD' };
        actions.push({ type: 'add_meal', recipeId: recipe.id, recipeName: recipe.name, planDate: date, mealSlot: SLOTS.includes(slot) ? slot : 'dinner', servings: servings || recipe.defaultServings });
        return { proposed: true };
      },
    },
    {
      name: 'propose_remove_meal',
      description: 'Propose removing a planned meal by meal_id (from get_meal_plan). The user confirms it in the app.',
      parameters: { type: 'object', properties: { meal_id: { type: 'string' } }, required: ['meal_id'] },
      run: async ({ meal_id }) => {
        const meal = await prisma.mealPlanEntry.findUnique({ where: { id: meal_id }, include: { recipe: { select: { name: true } } } });
        if (!meal) return { error: 'No meal with that id.' };
        actions.push({ type: 'remove_meal', mealId: meal.id, recipeName: meal.recipe.name, planDate: isoDate(meal.planDate), mealSlot: meal.mealSlot });
        return { proposed: true };
      },
    },
  ];
}

export interface AssistantReply { reply: string; actions: ProposedAction[]; sources: SourceRecipe[]; trace: string[] }

export async function askAssistant(messages: ChatMessage[]): Promise<AssistantReply | null> {
  const session: Session = { actions: [], trace: [], retrieved: new Map() };
  const today = new Date();
  const system =
    `You are "Sous-chef", the AI cooking assistant inside a meal planning app. Today is ${today.toDateString()} (${toIsoDate(today)}). ` +
    `Ground every answer in the tools: search the cookbook before recommending dishes, and never invent recipes, pantry items or meal ids. ` +
    `Recommend only recipes the tools returned, using their exact names. To change the plan call propose_add_meal / propose_remove_meal; ` +
    `the user confirms in the app, so describe them as suggestions. Respect dietary constraints and prefer recipes that use expiring items. ` +
    `Be warm, brief and practical; use short bullet lists for plans and **bold** dish names.`;
  const reply = await chatWithTools(messages, buildTools(session), system);
  if (reply === null) return null;
  // sources = retrieved recipes the answer actually talks about (or proposes)
  const text = reply.toLowerCase();
  const proposed = new Set(session.actions.filter(a => a.type === 'add_meal').map(a => (a as { recipeId: string }).recipeId));
  const sources = [...session.retrieved.values()].filter(s => text.includes(s.name.toLowerCase()) || proposed.has(s.recipeId)).slice(0, 6);
  return { reply, actions: session.actions, sources, trace: [...new Set(session.trace)] };
}
