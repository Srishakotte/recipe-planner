import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/home', label: 'Home', icon: '🏡' },
  { to: '/meal-plan', label: 'Meal Plan', icon: '📅' },
  { to: '/grocery-list', label: 'Grocery List', icon: '🛒' },
  { to: '/recipes', label: 'Recipes', icon: '📖' },
  { to: '/pantry', label: 'Pantry', icon: '🏠' },
  { to: '/substitutions', label: 'Substitutions', icon: '🔄' },
  { to: '/dashboard', label: 'Analytics', icon: '📊' },
];

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8f5]">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-gradient-to-b from-[#1a3a2a] to-[#0f2318] flex flex-col shadow-2xl">
        {/* Logo */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg">
              <span className="text-white text-lg">🍽️</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">Meal</h1>
              <h1 className="text-green-300 font-bold text-lg leading-tight -mt-1">Planner</h1>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm backdrop-blur-sm'
                    : 'text-green-200/70 hover:text-white hover:bg-white/8'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Bottom motivational card */}
        <div className="p-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
            <p className="text-green-100 text-xs font-medium leading-relaxed">
              "Good food,<br/>Good mood,<br/>Good life"
            </p>
            <div className="mt-3 flex gap-1">
              <span className="text-sm">🥗</span>
              <span className="text-sm">🥑</span>
              <span className="text-sm">🍊</span>
              <span className="text-sm">🥦</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
