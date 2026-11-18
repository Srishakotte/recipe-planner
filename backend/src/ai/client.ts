/**
 * The only module that talks to Gemini.
 *
 * Every AI feature goes through `withFallback`, so it always answers:
 * with Gemini when a key is configured and the call succeeds, otherwise with the
 * feature's own deterministic fallback. Responses carry `source` so the UI can say which.
 */
import { createHash } from 'crypto';
import { z, ZodType } from 'zod';

export type Source = 'ai' | 'fallback';
export interface Sourced<T> { data: T; source: Source }

// "-latest" aliases always point at a current model, so the default never gets retired
const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
// used once when the main model is overloaded (503/429) or too slow
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-flash-lite-latest';
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;
const REQUESTS_PER_MINUTE = Number(process.env.GEMINI_RPM || 10); // free tier is ~10/min for flash
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 300;
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 25_000); // slow answer -> fall back instead of hanging the UI

/** Rejects if Gemini takes longer than TIMEOUT_MS, so callers fall back to built-in logic. */
function withTimeout<T>(promise: T, label: string, ms = TIMEOUT_MS): Promise<Awaited<T>> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const isTransient = (error: unknown) => /\b(503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|timed out|fetch failed)\b/i.test(String((error as Error)?.message ?? error));

/** generateContent on the main model, retried once on the fallback model if the main one is busy. */
async function generate(ai: any, request: Record<string, unknown>, label: string, ms = TIMEOUT_MS) {
  try {
    return await withTimeout(ai.models.generateContent({ ...request, model: MODEL }), label, ms);
  } catch (error) {
    if (!isTransient(error) || FALLBACK_MODEL === MODEL) throw error;
    console.warn(`[ai] ${MODEL} busy (${String((error as Error).message).slice(0, 60)}), retrying on ${FALLBACK_MODEL}`);
    return withTimeout(ai.models.generateContent({ ...request, model: FALLBACK_MODEL }), label, ms);
  }
}

export function isAiEnabled(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return !!key && !key.startsWith('your-');
}

export function aiStatus() {
  return { enabled: isAiEnabled(), model: MODEL };
}

// ---- client (the SDK is ESM-only; TypeScript would compile `import()` to `require()`) ----
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const esmImport = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<any>;
let clientPromise: Promise<any> | null = null;

function getClient(): Promise<any> {
  if (!clientPromise) {
    clientPromise = esmImport('@google/genai').then(({ GoogleGenAI }) =>
      new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
  }
  return clientPromise;
}

// ---- tiny rate limiter + cache (protects the free quota) ----
const callTimes: number[] = [];
function takeRateSlot(): boolean {
  const now = Date.now();
  while (callTimes.length && now - callTimes[0] > 60_000) callTimes.shift();
  if (callTimes.length >= REQUESTS_PER_MINUTE) return false;
  callTimes.push(now);
  return true;
}

const cache = new Map<string, { value: unknown; expires: number }>();
function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit || hit.expires < Date.now()) { cache.delete(key); return undefined; }
  return hit.value as T;
}
function cacheSet(key: string, value: unknown) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}
const hashOf = (...parts: unknown[]) => createHash('sha1').update(JSON.stringify(parts)).digest('hex');

/** Ask Gemini for JSON matching `schema`. Returns null on any failure (no key, quota, bad output). */
/**
 * Gemini rejects schemas with many numeric/length bounds ("too many states"), especially the
 * lite models. Send the shape only; zod still enforces every bound on the answer.
 */
const BOUND_KEYS = new Set(['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minItems', 'maxItems', 'minLength', 'maxLength', 'pattern', 'format', '$schema']);
function relaxed(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(relaxed);
  if (!schema || typeof schema !== 'object') return schema;
  return Object.fromEntries(Object.entries(schema).filter(([k]) => !BOUND_KEYS.has(k)).map(([k, v]) => [k, relaxed(v)]));
}

/** Text, or text + images (base64) for Gemini Vision. */
export type Prompt = string | ({ text: string } | { inlineData: { mimeType: string; data: string } })[];

export async function ask<T>(schema: ZodType<T>, prompt: Prompt, options: { system?: string; cache?: boolean; timeoutMs?: number } = {}): Promise<T | null> {
  if (!isAiEnabled()) return null;
  const key = hashOf('ask', MODEL, options.system, prompt);
  if (options.cache !== false) {
    const cached = cacheGet<T>(key);
    if (cached !== undefined) return cached;
  }
  if (!takeRateSlot()) return null;
  try {
    const ai = await getClient();
    const response = await generate(ai, {
      contents: typeof prompt === 'string' ? prompt : [{ role: 'user', parts: prompt }],
      config: {
        systemInstruction: options.system,
        responseMimeType: 'application/json',
        responseJsonSchema: relaxed(z.toJSONSchema(schema as never)),
        temperature: 0.4,
      },
    }, 'generateContent', options.timeoutMs);
    const parsed = schema.safeParse(JSON.parse(response.text ?? ''));
    if (!parsed.success) {
      console.warn('[ai] response did not match schema:', parsed.error.issues[0]?.message);
      return null;
    }
    if (options.cache !== false) cacheSet(key, parsed.data);
    return parsed.data;
  } catch (error) {
    console.warn('[ai] request failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/** Run the AI version, fall back to the deterministic one if it returns null. */
export async function withFallback<T>(aiFn: () => Promise<T | null>, fallbackFn: () => T | Promise<T>): Promise<Sourced<T>> {
  const fromAi = await aiFn();
  if (fromAi !== null) return { data: fromAi, source: 'ai' };
  return { data: await fallbackFn(), source: 'fallback' };
}

/** Embeddings for semantic search. Returns null when AI is unavailable. */
export async function embed(texts: string[], taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'): Promise<number[][] | null> {
  if (!isAiEnabled() || texts.length === 0) return texts.length === 0 ? [] : null;
  const key = hashOf('embed', EMBEDDING_MODEL, taskType, texts);
  const cached = cacheGet<number[][]>(key);
  if (cached) return cached;
  try {
    const ai = await getClient();
    const response = await withTimeout(ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: texts,
      config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS },
    }), 'embedContent');
    const vectors: number[][] = (response.embeddings ?? []).map((e: { values?: number[] }) => e.values ?? []);
    if (vectors.length !== texts.length) return null;
    cacheSet(key, vectors);
    return vectors;
  } catch (error) {
    console.warn('[ai] embedding failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// ---- tool calling (used by the kitchen assistant) ----
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON schema
  run: (args: any) => Promise<unknown>;
}
export interface ChatMessage { role: 'user' | 'model'; text: string }

/**
 * Multi-turn chat where Gemini may call tools. Loops until the model answers in text
 * (max `maxSteps` tool rounds). Returns null if AI is unavailable or fails.
 */
export async function chatWithTools(messages: ChatMessage[], tools: ToolDefinition[], system: string, maxSteps = 5): Promise<string | null> {
  if (!isAiEnabled()) return null;
  const ai = await getClient().catch(() => null);
  if (!ai) return null;
  const contents: any[] = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
  const config = {
    systemInstruction: system,
    temperature: 0.3,
    tools: [{ functionDeclarations: tools.map(({ name, description, parameters }) => ({ name, description, parametersJsonSchema: parameters })) }],
  };
  try {
    for (let step = 0; step <= maxSteps; step++) {
      if (!takeRateSlot()) return 'I hit the free Gemini rate limit. Please try again in a minute.';
      const response = await generate(ai, { contents, config }, 'chat');
      const calls: { name: string; args?: Record<string, unknown> }[] = response.functionCalls ?? [];
      if (calls.length === 0) return response.text ?? '';
      contents.push(response.candidates[0].content);
      const results = await Promise.all(calls.map(async call => {
        const tool = tools.find(t => t.name === call.name);
        const output = tool
          ? await tool.run(call.args ?? {}).catch(e => ({ error: e instanceof Error ? e.message : String(e) }))
          : { error: `Unknown tool ${call.name}` };
        return { functionResponse: { name: call.name, response: { output } } };
      }));
      contents.push({ role: 'user', parts: results });
    }
    return 'That needed too many steps. Could you ask in a simpler way?';
  } catch (error) {
    console.warn('[ai] chat failed:', error instanceof Error ? error.message : error);
    return null;
  }
}
