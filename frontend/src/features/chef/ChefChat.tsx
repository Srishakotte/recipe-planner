import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarMinus, CalendarPlus, Check, Search, Send, Wrench } from 'lucide-react';
import {
  useAddMealPlanEntryMutation, useAskAssistantMutation, useDeleteMealPlanEntryMutation, useGetAiStatusQuery,
  type AssistantReply, type ChatMessage, type ProposedAction,
} from '../../app/api';
import { formatDay } from '../../shared/dates';
import { AiOrb, RecipeImage } from '../../shared/components/RecipeVisuals';
import { Button, cx } from '../../shared/ui';
import { errorMessage, toast } from '../../shared/components/Toast';

type Turn = ChatMessage & Partial<Omit<AssistantReply, 'reply'>>;

export const CHEF_PROMPTS = [
  'What should I cook tonight?',
  'Plan 3 vegetarian dinners for this week',
  'Something warm and comforting with what I have',
  'What is expiring and how can I use it?',
  'A quick Italian dinner under 30 minutes',
  'What do I still need to buy?',
];

function ActionCard({ action }: { action: ProposedAction }) {
  const [addMeal, { isLoading: adding }] = useAddMealPlanEntryMutation();
  const [removeMeal, { isLoading: removing }] = useDeleteMealPlanEntryMutation();
  const [done, setDone] = useState(false);
  const isAdd = action.type === 'add_meal';

  const apply = async () => {
    try {
      if (isAdd) await addMeal({ recipeId: action.recipeId, planDate: action.planDate, mealSlot: action.mealSlot, servings: action.servings }).unwrap();
      else await removeMeal(action.mealId).unwrap();
      setDone(true);
      toast.success(isAdd ? `${action.recipeName} added to your plan` : `${action.recipeName} removed`);
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      {isAdd ? <CalendarPlus className="size-4 text-herb-600" /> : <CalendarMinus className="size-4 text-red-500" />}
      <div className="min-w-0 flex-1 text-xs">
        <p className="truncate font-medium text-ink">{isAdd ? 'Add' : 'Remove'} {action.recipeName}</p>
        <p className="text-slate-500">{formatDay(action.planDate)} · {action.mealSlot}{isAdd && ` · ${action.servings} servings`}</p>
      </div>
      {done
        ? <span className="flex items-center gap-1 text-xs font-medium text-herb-700"><Check className="size-3.5" />Done</span>
        : <Button size="sm" variant={isAdd ? 'primary' : 'secondary'} loading={adding || removing} onClick={apply}>{isAdd ? 'Add' : 'Remove'}</Button>}
    </div>
  );
}

/** The Sous-chef conversation: grounded answers, the tools it used, recipe sources and one-click plan changes. */
export default function ChefChat({ initialPrompt, compact }: { initialPrompt?: string; compact?: boolean }) {
  const { data: status } = useGetAiStatusQuery();
  const [ask, { isLoading }] = useAskAssistantMutation();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns, isLoading]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || isLoading) return;
    const history: Turn[] = [...turns, { role: 'user', text: message }];
    setTurns(history);
    setInput('');
    try {
      const { reply, ...rest } = await ask(history.map(({ role, text }) => ({ role, text }))).unwrap();
      setTurns([...history, { role: 'model', text: reply, ...rest }]);
    } catch (err) {
      setTurns([...history, { role: 'model', text: errorMessage(err, 'Sorry, I could not answer that.') }]);
    }
  };

  useEffect(() => {
    if (initialPrompt && status?.enabled && !sentInitial.current) { sentInitial.current = true; send(initialPrompt); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, status?.enabled]);

  if (status && !status.enabled) {
    return (
      <div className="m-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <p className="font-display text-lg font-semibold text-ink">Sous-chef needs a free Gemini key</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Get a key at aistudio.google.com/apikey</li>
          <li>Add <code className="rounded bg-slate-100 px-1">GEMINI_API_KEY="..."</code> to <code className="rounded bg-slate-100 px-1">backend/.env</code></li>
          <li>Restart the backend</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">Everything else in the app keeps working without it.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cx('flex-1 space-y-5 overflow-y-auto', compact ? 'px-4 py-4' : 'px-1 py-2')}>
        {turns.length === 0 && (
          <div className={cx('grid gap-2', !compact && 'sm:grid-cols-2')}>
            {CHEF_PROMPTS.slice(0, compact ? 4 : 6).map(p => (
              <button key={p} onClick={() => send(p)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-brand-200 hover:bg-brand-50">{p}</button>
            ))}
          </div>
        )}
        <AnimatePresence initial={false}>
          {turns.map((turn, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cx('flex gap-2.5', turn.role === 'user' ? 'justify-end' : 'items-start')}>
              {turn.role === 'model' && <AiOrb size="sm" />}
              <div className={cx('min-w-0 space-y-2', turn.role === 'user' ? 'max-w-[85%]' : 'flex-1')}>
                {turn.trace && turn.trace.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {turn.trace.map(t => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        {t.startsWith('Searched') ? <Search className="size-3" /> : <Wrench className="size-3" />}{t}
                      </span>
                    ))}
                  </div>
                )}
                <div className={cx('rounded-2xl px-4 py-3 text-sm leading-relaxed',
                  turn.role === 'user' ? 'rounded-br-md bg-ink text-white' : 'rounded-tl-md border border-slate-200 bg-white text-slate-700')}>
                  {turn.role === 'user' ? turn.text : (
                    <div className="space-y-2 [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-ink">
                      <ReactMarkdown>{turn.text}</ReactMarkdown>
                    </div>
                  )}
                </div>
                {turn.sources && turn.sources.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {turn.sources.map(s => (
                      <Link key={s.recipeId} to={`/recipes/${s.recipeId}`} className="group w-36 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
                        <RecipeImage src={s.imageUrl} name={s.name} className="aspect-[4/3] w-full transition group-hover:scale-105" />
                        <p className="truncate px-2 pt-1.5 text-xs font-medium text-ink">{s.name}</p>
                        <p className="px-2 pb-1.5 text-[10px] text-slate-500">{s.cuisine ?? 'Recipe'} · {Math.round(s.coverage * 100)}% in pantry</p>
                      </Link>
                    ))}
                  </div>
                )}
                {turn.actions && turn.actions.length > 0 && <div className="space-y-1.5">{turn.actions.map((a, j) => <ActionCard key={j} action={a} />)}</div>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <div className="flex items-center gap-2.5 text-sm text-slate-500">
            <AiOrb size="sm" /> <span className="animate-pulse">Checking your kitchen and cookbook…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={e => { e.preventDefault(); send(input); }} className={cx('flex gap-2 border-t border-slate-200 bg-white/80 backdrop-blur', compact ? 'p-3' : 'rounded-2xl border p-2 shadow-sm')}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask your sous-chef anything about cooking, your plan or pantry…"
          className="h-10 min-w-0 flex-1 rounded-full bg-transparent px-3 text-sm focus:outline-none" />
        <Button type="submit" variant="ai" icon={Send} disabled={!input.trim()} loading={isLoading} aria-label="Send" />
      </form>
    </div>
  );
}
