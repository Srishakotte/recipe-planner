import { NavLink, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import ToastContainer from './Toast';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/meal-plan', label: 'Meal Plan', icon: '📅' },
  { to: '/recipes', label: 'Recipes', icon: '📖' },
  { to: '/grocery-list', label: 'Grocery List', icon: '🛒' },
  { to: '/pantry', label: 'Pantry', icon: '🏠' },
  { to: '/substitutions', label: 'Substitutions', icon: '🔄' },
];

export default function Layout() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-900 dark:via-gray-950 dark:to-slate-900 transition-colors duration-300">
      <nav className="glass sticky top-0 z-40 border-b border-gray-200/60 dark:border-gray-700/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl animate-wiggle cursor-default">🍽️</span>
              <h1 className="text-xl font-bold gradient-text">Recipe Planner</h1>
            </div>
            <div className="flex items-center space-x-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 shadow-sm dark:from-green-900/40 dark:to-emerald-900/40 dark:text-green-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/80 hover:shadow-sm dark:text-gray-300 dark:hover:bg-gray-800/60'
                    }`
                  }
                >
                  <span className="mr-1">{item.icon}</span>
                  <span className="hidden lg:inline">{item.label}</span>
                </NavLink>
              ))}
              <button
                onClick={() => setDark(!dark)}
                className="ml-3 p-2.5 rounded-xl text-gray-500 hover:bg-white/80 hover:shadow-sm dark:text-gray-400 dark:hover:bg-gray-800/60 transition-all duration-200"
                title="Toggle dark mode"
              >
                <span className="text-lg">{dark ? '☀️' : '🌙'}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
