import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, Search, X } from 'lucide-react';
import { useGetAiStatusQuery } from '../../app/api';
import { cx } from '../ui';
import ToastContainer from './Toast';
import CommandPalette from './CommandPalette';
import ChefChat from '../../features/chef/ChefChat';
import { AiOrb } from './RecipeVisuals';
import { NAV } from './nav';

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-saffron-400 to-brand-600 font-display text-lg font-bold text-white">M</span>
      <div className="leading-tight">
        <p className="font-display text-lg font-semibold text-white">Mise</p>
        <p className="text-[11px] text-slate-400">AI kitchen planner</p>
      </div>
    </div>
  );
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { data: ai } = useGetAiStatusQuery();
  return (
    <>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3">
        {NAV.map(({ group, items }) => (
          <div key={group}>
            <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">{group}</p>
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={onNavigate} className={({ isActive }) => cx(
                'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
              )}>
                <Icon className="size-4" />{label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="m-3 rounded-xl bg-white/5 px-3 py-2.5 text-xs">
        <p className="flex items-center gap-2 font-medium text-white">
          <span className={cx('size-2 rounded-full', ai?.enabled ? 'bg-saffron-400 shadow-[0_0_8px_#f4b740]' : 'bg-slate-500')} />
          {ai?.enabled ? 'Gemini connected' : 'AI off'}
        </p>
        <p className="mt-0.5 text-slate-400">{ai?.enabled ? ai.model : 'Add GEMINI_API_KEY to enable AI'}</p>
      </div>
    </>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [chefOpen, setChefOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const askChef = (q?: string) => navigate(q ? `/chef?q=${encodeURIComponent(q)}` : '/chef');

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-ink lg:flex">
        <div className="px-5 py-6"><Brand /></div>
        <button onClick={() => setPaletteOpen(true)} className="mx-3 mb-5 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-left text-sm text-slate-400 hover:bg-white/10">
          <Search className="size-4" /> Search… <kbd className="ml-auto rounded border border-white/10 px-1.5 text-[10px]">Ctrl K</kbd>
        </button>
        <SideNav />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <button onClick={() => setPaletteOpen(true)} aria-label="Search" className="flex size-9 items-center justify-center rounded-lg text-slate-300"><Search className="size-5" /></button>
          <button onClick={() => setMenuOpen(true)} aria-label="Menu" className="flex size-9 items-center justify-center rounded-lg text-slate-300"><Menu className="size-5" /></button>
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="mx-auto max-w-6xl">
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating sous-chef (opens the side panel) */}
      {location.pathname !== '/chef' && (
        <button onClick={() => setChefOpen(true)} aria-label="Ask the sous-chef"
          className="fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-ink py-1.5 pl-1.5 pr-4 text-sm font-medium text-white shadow-xl shadow-ink/20 lg:bottom-6 lg:right-6">
          <AiOrb /> Ask sous-chef
        </button>
      )}

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.flatMap(g => g.items).filter(i => i.mobile).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium', isActive ? 'text-brand-600' : 'text-slate-500')}>
            <Icon className="size-5" />{label}
          </NavLink>
        ))}
      </nav>

      {/* Mobile full menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex bg-ink/40 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="animate-slide-in-right ml-auto flex h-full w-72 flex-col bg-ink py-4">
            <div className="flex items-center justify-between px-5 pb-4"><Brand /><button onClick={() => setMenuOpen(false)} aria-label="Close" className="text-slate-400"><X className="size-5" /></button></div>
            <SideNav onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      {/* Sous-chef side panel */}
      <AnimatePresence>
        {chefOpen && (
          <motion.div className="fixed inset-0 z-50 flex justify-end bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setChefOpen(false)}>
            <motion.aside initial={{ x: 40 }} animate={{ x: 0 }} exit={{ x: 40 }} onMouseDown={e => e.stopPropagation()} className="flex h-full w-full max-w-md flex-col bg-canvas shadow-2xl">
              <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
                <AiOrb />
                <div className="flex-1 leading-tight">
                  <p className="font-display text-base font-semibold text-ink">Sous-chef</p>
                  <p className="text-xs text-slate-500">Knows your cookbook, pantry and plan</p>
                </div>
                <button onClick={() => setChefOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="size-4" /></button>
              </header>
              <ChefChat compact />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onAskChef={askChef} />
      <ToastContainer />
    </div>
  );
}
