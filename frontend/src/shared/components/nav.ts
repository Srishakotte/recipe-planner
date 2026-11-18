import { BarChart3, BookOpen, CalendarDays, Compass, Home, Refrigerator, Repeat, ShoppingBasket, Sparkles, type LucideIcon } from 'lucide-react';

export interface NavItem { to: string; label: string; icon: LucideIcon; mobile?: boolean }

/** Navigation, grouped by what people come to do. `mobile` items get a bottom tab. */
export const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Cook', items: [
    { to: '/home', label: 'Today', icon: Home, mobile: true },
    { to: '/discover', label: 'Discover', icon: Compass, mobile: true },
    { to: '/chef', label: 'Sous-chef', icon: Sparkles, mobile: true },
  ] },
  { group: 'Plan', items: [
    { to: '/meal-plan', label: 'Meal plan', icon: CalendarDays, mobile: true },
    { to: '/grocery-list', label: 'Groceries', icon: ShoppingBasket, mobile: true },
  ] },
  { group: 'Kitchen', items: [
    { to: '/recipes', label: 'My recipes', icon: BookOpen },
    { to: '/pantry', label: 'Pantry', icon: Refrigerator },
    { to: '/substitutions', label: 'Diet & swaps', icon: Repeat },
    { to: '/dashboard', label: 'Insights', icon: BarChart3 },
  ] },
];
