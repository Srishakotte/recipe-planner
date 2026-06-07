import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/meal-plan', label: 'Meal Plan' },
  { to: '/recipes', label: 'Recipes' },
  { to: '/grocery-list', label: 'Grocery List' },
  { to: '/pantry', label: 'Pantry' },
  { to: '/substitutions', label: 'Substitutions' },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-green-700">Recipe Planner</h1>
            </div>
            <div className="flex items-center space-x-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
