import { useEffect, useRef, useState } from 'react';
import { CalendarMinus, CalendarPlus, Check, Send, Sparkles, X } from 'lucide-react';
import {
  useAddMealPlanEntryMutation, useAskAssistantMutation, useDeleteMealPlanEntryMutation, useGetAiStatusQuery,
  type ChatMessage, type ProposedAction,
} from '../../app/api';
import { formatDay } from '../dates';
import { Button, IconButton, cx } from '../ui';
import { errorMessage, toast } from './Toast';

interface Turn extends ChatMessage { actions?: ProposedAction[] }

const EXAMPLES = [
  'What should I cook tonight?',
  'Plan vegetarian dinners for the next 3 days',
  'What is expiring soon and how can I use it?',
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
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
      {isAdd ? <CalendarPlus className="size-4 text-brand-600" /> : <CalendarMinus className="size-4 text-red-500" />}
      <div className="min-w-0 flex-1 text-xs">
        <p className="truncate font-medium text-slate-800">{isAdd ? 'Add' : 'Remove'} {action.recipeName}</p>
        <p className="text-slate-500">{formatDay(action.planDate)} · {action.mealSlot}{isAdd && ` · ${action.servings} servings`}</p>
      </div>
      {done
        ? <span className="flex items-center gap-1 text-xs font-medium text-brand-700"><Check className="size-3.5" />Done</span>
        : <Button size="sm" variant={isAdd ? 'primary' : 'secondary'} loading={adding || removing} onClick={apply}>{isAdd ? 'Add' : 'Remove'}</Button>}
    </div>
  );
}

export default function AssistantPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: status } = useGetAiStatusQuery();
  const [ask, { isLoading }] = useAskAssistantMutation();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, isLoading]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || isLoading) return;
    const history: Turn[] = [...turns, { role: 'user', text: message }];
    setTurns(history);
    setInput('');
    try {
      const { reply, actions } = await ask(history.map(({ role, text }) => ({ role, text }))).unwrap();
      setTurns([...history, { role: 'model', text: reply, actions }]);
    } catch (err) {
      setTurns([...history, { role: 'model', text: errorMessage(err, 'Sorry, I could not answer that.') }]);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onMouseDown={onClose}>
      <aside onMouseDown={e => e.stopPropagation()} className="animate-slide-in-right flex h-full w-full max-w-md flex-col bg-canvas shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white"><Sparkles className="size-4" /></span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">Kitchen assistant</p>
              <p className="text-xs text-slate-500">Knows your recipes, pantry and plan</p>
            </div>
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {status && !status.enabled ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
              <p className="font-medium text-slate-800">The assistant needs a free Gemini API key</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-600">
                <li>Get a key at aistudio.google.com/apikey</li>
                <li>Add <code className="rounded bg-slate-100 px-1">GEMINI_API_KEY="..."</code> to <code className="rounded bg-slate-100 px-1">backend/.env</code></li>
                <li>Restart the backend</li>
              </ol>
              <p className="mt-3 text-xs text-slate-500">Everything else in the app keeps working without it.</p>
            </div>
          ) : turns.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">Try asking:</p>
              {EXAMPLES.map(e => (
                <button key={e} onClick={() => send(e)} className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-violet-300 hover:bg-violet-50">{e}</button>
              ))}
            </div>
          ) : turns.map((turn, i) => (
            <div key={i} className={cx('flex flex-col gap-2', turn.role === 'user' ? 'items-end' : 'items-start')}>
              <div className={cx('max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm',
                turn.role === 'user' ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700')}>
                {turn.text}
              </div>
              {turn.actions && turn.actions.length > 0 && (
                <div className="w-full space-y-1.5">{turn.actions.map((a, j) => <ActionCard key={j} action={a} />)}</div>
              )}
            </div>
          ))}
          {isLoading && <div className="flex gap-1 px-2">{[0, 1, 2].map(i => <span key={i} className="size-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: `${i * 120}ms` }} />)}</div>}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-2 border-t border-slate-200 bg-white p-3">
          <input value={input} onChange={e => setInput(e.target.value)} disabled={!status?.enabled}
            placeholder={status?.enabled ? 'Ask about meals, pantry, groceries…' : 'Add a Gemini key to chat'}
            className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100" />
          <Button type="submit" variant="ai" icon={Send} disabled={!input.trim() || !status?.enabled} loading={isLoading} aria-label="Send" />
        </form>
      </aside>
    </div>
  );
}
