import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, Flame, Refrigerator, ShoppingCart, Utensils } from 'lucide-react';
import { useGetAnalyticsQuery, useGetNutritionQuery } from '../../../app/api';
import { sectionOf } from '../../../shared/constants';
import { addDays, formatDay, weekStartOf } from '../../../shared/dates';
import { Card, CardHeader, EmptyState, IconButton, PageHeader, SourceBadge, Spinner, Stat } from '../../../shared/ui';

const BRAND = '#059669';
const axis = { fontSize: 11, fill: '#64748b' };
const tooltipStyle = { borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: 12 };

/** Horizontal bar list: one hue, sorted by size, label + value in text colours. */
function BarList({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <ul className="space-y-2.5 p-5">
      {rows.map(r => (
        <li key={r.label} className="text-sm">
          <div className="mb-1 flex justify-between"><span className="capitalize text-slate-700">{r.label}</span><span className="font-medium text-slate-900">{r.value}</span></div>
          <div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

function Nutrition({ weekStart }: { weekStart: string }) {
  const { data, isFetching } = useGetNutritionQuery(weekStart);
  const days = data?.data ?? [];
  const planned = days.filter(d => d.meals > 0);
  const avg = (key: 'calories' | 'protein' | 'carbs' | 'fats') => planned.length ? Math.round(planned.reduce((s, d) => s + d[key], 0) / planned.length) : 0;
  const lowCoverage = data?.source === 'fallback' && planned.some(d => d.coverage < 0.8);

  return (
    <Card className="lg:col-span-2">
      <CardHeader icon={Flame} title="Nutrition per person" subtitle="One serving of each planned meal, per day" action={<SourceBadge source={data?.source} />} />
      {isFetching && !data ? <Spinner /> : planned.length === 0 ? <EmptyState icon={Flame} title="No meals planned this week" /> : (
        <div className="p-5">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([['calories', 'kcal / day'], ['protein', 'g protein'], ['carbs', 'g carbs'], ['fats', 'g fat']] as const).map(([key, label]) => (
              <div key={key} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-lg font-semibold text-slate-900">{avg(key)}</p>
                <p className="text-xs text-slate-500">avg {label}</p>
              </div>
            ))}
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={days} margin={{ left: -16, right: 4 }}>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={axis} axisLine={false} tickLine={false} />
                <YAxis tick={axis} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} formatter={v => [`${v} kcal`, 'Calories']} />
                <Bar dataKey="calories" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {lowCoverage && <p className="mt-2 text-xs text-slate-500">Some ingredients are not in the built-in nutrition table, so totals are a lower bound. Add a Gemini key for full estimates.</p>}
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const [weekStart, setWeekStart] = useState(weekStartOf());
  const { data, isLoading } = useGetAnalyticsQuery(weekStart);

  return (
    <div>
      <PageHeader title="Insights" subtitle="How your week looks"
        actions={<div className="flex items-center gap-1">
          <IconButton icon={ChevronLeft} label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))} />
          <button onClick={() => setWeekStart(weekStartOf())} className="rounded-lg px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100">
            {formatDay(weekStart, { day: 'numeric', month: 'short' })} – {formatDay(addDays(weekStart, 6), { day: 'numeric', month: 'short' })}
          </button>
          <IconButton icon={ChevronRight} label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))} />
        </div>} />

      {isLoading || !data ? <Spinner /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Meals this week" value={data.overview.totalMealsPlanned} icon={CalendarDays} tone="green" />
            <Stat label="Recipes" value={data.overview.totalRecipes} icon={BookOpen} tone="violet" />
            <Stat label="Pantry items" value={data.overview.totalPantryItems} icon={Refrigerator} tone="blue" />
            <Stat label="On grocery list" value={data.overview.groceryListItems} icon={ShoppingCart} tone="amber" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Nutrition weekStart={weekStart} />
            <Card>
              <CardHeader icon={CalendarDays} title="Meals per day" />
              <div className="h-64 p-4">
                <ResponsiveContainer>
                  <BarChart data={data.mealsPerDay} margin={{ left: -24, right: 4 }}>
                    <CartesianGrid vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" tick={axis} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} formatter={v => [v, 'Meals']} />
                    <Bar dataKey="meals" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader icon={ShoppingCart} title="Grocery list by aisle" />
              {data.sectionBreakdown.length === 0 ? <EmptyState icon={ShoppingCart} title="Grocery list is empty" />
                : <BarList rows={[...data.sectionBreakdown].sort((a, b) => b.value - a.value).map(s => ({ label: sectionOf(s.name).label, value: s.value }))} />}
            </Card>
            <Card>
              <CardHeader icon={Utensils} title="Most used ingredients" subtitle="Across this week's meals" />
              {data.topIngredients.length === 0 ? <EmptyState icon={Utensils} title="No meals planned" />
                : <BarList rows={data.topIngredients.map(i => ({ label: i.name, value: i.count }))} />}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
