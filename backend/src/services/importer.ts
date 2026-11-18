/**
 * Import a recipe from any web page. Most food sites embed schema.org Recipe data (JSON-LD),
 * which is read directly; otherwise Gemini extracts the recipe from the page text.
 * Returns a draft for the user to review; nothing is saved here.
 */
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { z } from 'zod';
import { ask, withFallback, Sourced } from '../ai/client';
import { parseIngredientLine, guessStoreSection } from '../engine/parseIngredient';
import { HttpError } from '../lib/http';

export interface RecipeDraft {
  name: string; description: string | null; steps: string | null; defaultServings: number;
  imageUrl: string | null; sourceUrl: string; cuisine: string | null; category: string | null;
  ingredients: { name: string; displayName: string; quantity: number; unit: string; storeSection: string }[];
}

const MAX_BYTES = 3_000_000;

/** Only public http(s) hosts: never localhost or private networks (SSRF guard). */
async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new HttpError(400, 'That is not a valid link'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new HttpError(400, 'Only http and https links are supported');
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new HttpError(400, 'Could not find that website');
  const isPrivate = (ip: string) => /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(ip);
  if (addresses.some(a => isPrivate(a.address))) throw new HttpError(400, 'Links to local or private addresses are not allowed');
  return url;
}

async function fetchPage(url: URL): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (RecipePlanner importer)', accept: 'text/html' } });
  if (!response.ok) throw new HttpError(400, `The website answered ${response.status}`);
  const text = await response.text();
  return text.slice(0, MAX_BYTES);
}

const asText = (v: unknown): string => typeof v === 'string' ? v : Array.isArray(v) ? v.map(asText).join(' ') : (v as { text?: string; name?: string })?.text ?? (v as { name?: string })?.name ?? '';
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '').trim();

function stepsFrom(instructions: unknown): string[] {
  if (!instructions) return [];
  if (typeof instructions === 'string') return instructions.split(/\n+|(?<=\.)\s+(?=[A-Z])/).map(decode).filter(Boolean);
  if (Array.isArray(instructions)) return instructions.flatMap(i => (i as { itemListElement?: unknown })?.itemListElement ? stepsFrom((i as { itemListElement: unknown }).itemListElement) : [decode(asText(i))]).filter(Boolean);
  return [decode(asText(instructions))];
}

/** Finds the schema.org Recipe object in the page's JSON-LD blocks. */
function findJsonLdRecipe(html: string): Record<string, unknown> | null {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const isRecipe = (node: Record<string, unknown>) => [node['@type']].flat().some(t => String(t).toLowerCase() === 'recipe');
  const walk = (node: unknown): Record<string, unknown> | null => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) { for (const n of node) { const r = walk(n); if (r) return r; } return null; }
    const obj = node as Record<string, unknown>;
    if (isRecipe(obj)) return obj;
    return walk(obj['@graph']) ?? walk(obj.mainEntity);
  };
  for (const block of blocks) {
    try { const found = walk(JSON.parse(block.trim())); if (found) return found; } catch { /* broken JSON-LD on some sites */ }
  }
  return null;
}

function draftFromJsonLd(recipe: Record<string, unknown>, url: string): RecipeDraft {
  const image = recipe.image;
  const imageUrl = typeof image === 'string' ? image : Array.isArray(image) ? asText(image[0]) || String(image[0]) : (image as { url?: string })?.url ?? null;
  const servings = parseInt(asText(recipe.recipeYield).match(/\d+/)?.[0] ?? '4', 10);
  return {
    name: decode(asText(recipe.name)) || 'Imported recipe',
    description: decode(asText(recipe.description)).slice(0, 300) || null,
    steps: stepsFrom(recipe.recipeInstructions).map((s, i) => `${i + 1}. ${s}`).join('\n') || null,
    defaultServings: Math.min(Math.max(servings || 4, 1), 50),
    imageUrl, sourceUrl: url,
    cuisine: decode(asText(recipe.recipeCuisine)).split(',')[0] || null,
    category: decode(asText(recipe.recipeCategory)).split(',')[0] || null,
    ingredients: [recipe.recipeIngredient ?? recipe.ingredients].flat().filter(Boolean).map(line => {
      const p = parseIngredientLine(decode(String(line)));
      return { name: p.name, displayName: p.name, quantity: p.quantity, unit: p.unit, storeSection: guessStoreSection(p.name) };
    }),
  };
}

const aiDraftSchema = z.object({
  name: z.string(), description: z.string(), servings: z.number().int().min(1).max(50),
  ingredients: z.array(z.string()).min(1), steps: z.array(z.string()).min(1),
  cuisine: z.string().nullable(), category: z.string().nullable(),
});

export async function importFromUrl(raw: string): Promise<Sourced<RecipeDraft>> {
  const url = await assertPublicUrl(raw);
  const html = await fetchPage(url);
  const jsonLd = findJsonLdRecipe(html);
  if (jsonLd) return { data: draftFromJsonLd(jsonLd, url.href), source: 'fallback' };

  const pageText = html.replace(/<(script|style|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 15_000);
  const result = await withFallback(async () => {
    const ai = await ask(aiDraftSchema, `Extract the recipe from this web page text. Ingredient lines should keep their amounts (e.g. "2 cups flour").\n\n${pageText}`, { cache: false });
    if (!ai) return null;
    return draftFromJsonLd({ name: ai.name, description: ai.description, recipeYield: String(ai.servings), recipeIngredient: ai.ingredients, recipeInstructions: ai.steps, recipeCuisine: ai.cuisine ?? '', recipeCategory: ai.category ?? '' }, url.href);
  }, () => null);
  if (!result.data) throw new HttpError(422, 'No recipe found on that page. Try another link, or add a Gemini key so AI can read pages without recipe data.');
  return { data: result.data, source: result.source };
}
