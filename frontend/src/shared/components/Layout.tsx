import { NavLink, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import ToastContainer from './Toast';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/meal-plan', label: 'Meal Plan' },
  { to: '/recipes', label: 'Recipes' },
  { to: '/grocery-list', label: 'Grocery List' },
  { to: '/pantry', label: 'Pantry' },
  { to: '/substitutions', label: 'Substitutions' },
];

export default function Layout() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-green-700 dark:text-green-400">Recipe Planner</h1>
            </div>
            <div className="flex items-center space-x-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <button
                onClick={() => setDark(!dark)}
                className="ml-2 px-2 py-2 rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                title="Toggle dark mode"
              >
                {dark ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
