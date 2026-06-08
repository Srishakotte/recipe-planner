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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 transition-colors duration-300">
      <nav className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-sm border-b border-gray-200/50 dark:border-gray-700/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🍽️</span>
              <h1 className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
                Recipe Planner
              </h1>
            </div>
            <div className="flex items-center space-x-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-green-100 text-green-800 shadow-sm dark:bg-green-900/50 dark:text-green-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 hover:scale-[1.02] dark:text-gray-300 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  <span className="mr-1.5">{item.icon}</span>
                  <span className="hidden lg:inline">{item.label}</span>
                </NavLink>
              ))}
              <button
                onClick={() => setDark(!dark)}
                className="ml-3 p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-all duration-200 hover:rotate-12"
                title="Toggle dark mode"
              >
                {dark ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-[fadeIn_0.3s_ease-out]">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
