import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, BookOpen, CalendarDays, ChefHat, Home, Refrigerator, Repeat, ShoppingCart, Sparkles } from 'lucide-react';
import { useGetAiStatusQuery } from '../../app/api';
import { cx } from '../ui';
import ToastContainer from './Toast';
import AssistantPanel from './AssistantPanel';

const NAV = [
  { to: '/home', label: 'Today', icon: Home },
  { to: '/meal-plan', label: 'Plan', icon: CalendarDays },
  { to: '/grocery-list', label: 'Groceries', icon: ShoppingCart },
  { to: '/recipes', label: 'Recipes', icon: BookOpen },
  { to: '/pantry', label: 'Pantry', icon: Refrigerator },
  { to: '/substitutions', label: 'Swaps', icon: Repeat },
  { to: '/dashboard', label: 'Insights', icon: BarChart3 },
];

function AiStatusPill() {
  const { data } = useGetAiStatusQuery();
  if (!data) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
      <div className="flex items-center gap-2 font-medium text-slate-700">
        <span className={cx('size-2 rounded-full', data.enabled ? 'bg-violet-500' : 'bg-slate-300')} />
        {data.enabled ? 'AI on' : 'AI off'}
      </div>
      <p className="mt-1 text-slate-500">{data.enabled ? `Gemini · ${data.model}` : 'Add GEMINI_API_KEY to backend/.env for AI features'}</p>
    </div>
  );
}

export default function Layout() {
  const [assistantOpen, setAssistantOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white"><ChefHat className="size-5" /></span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">Recipe Planner</p>
            <p className="text-xs text-slate-500">Plan · Shop · Cook</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
            )}>
              <Icon className="size-4" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-3 p-3">
          <button onClick={() => setAssistantOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2.5 text-sm font-medium text-white hover:from-violet-700 hover:to-indigo-700">
            <Sparkles className="size-4" /> Kitchen assistant
          </button>
          <AiStatusPill />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white"><ChefHat className="size-4" /></span>
          <span className="text-sm font-semibold text-slate-900">Recipe Planner</span>
        </div>
        <button onClick={() => setAssistantOpen(true)} aria-label="Open kitchen assistant"
          className="flex size-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><Sparkles className="size-4" /></button>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cx(
            'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
            isActive ? 'text-brand-700' : 'text-slate-500',
          )}>
            <Icon className="size-5" />{label}
          </NavLink>
        ))}
      </nav>

      <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
      <ToastContainer />
    </div>
  );
}
