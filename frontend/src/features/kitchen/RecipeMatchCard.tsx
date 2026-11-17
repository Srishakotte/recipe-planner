import { AlertTriangle, CalendarPlus, Clock3, Wand2 } from 'lucide-react';
import type { RecipeMatch } from '../../app/api';
import { relativeDay } from '../../shared/dates';
import { Badge, Button, Card } from '../../shared/ui';

interface Props {
  match: RecipeMatch;
  onPlan: (match: RecipeMatch) => void;
  onFix?: (match: RecipeMatch) => void;
}

/** One recipe scored against your kitchen: coverage, expiring items, missing items, conflicts. */
export default function RecipeMatchCard({ match, onPlan, onFix }: Props) {
  const total = match.have.length + match.missing.length;
  const pct = Math.round(match.coverage * 100);
  const needsFix = match.missing.length > 0 || match.conflicts.length > 0;

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{match.name}</h3>
        <span className="shrink-0 text-xs font-medium text-slate-500">{match.have.length}/{total}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" title={`You have ${pct}% of the ingredients`}>
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">{match.reason}</p>

      <div className="mt-3 flex flex-wrap gap-1">
        {match.expiring.map(e => <Badge key={e.name} tone="amber" icon={Clock3}>{e.name} · {relativeDay(e.daysLeft)}</Badge>)}
        {match.conflicts.map(c => <Badge key={c.ingredient} tone="red" icon={AlertTriangle}>{c.ingredient} · {c.constraint}</Badge>)}
        {match.missing.slice(0, 4).map(m => <Badge key={m}>need {m}</Badge>)}
        {match.missing.length > 4 && <Badge>+{match.missing.length - 4} more</Badge>}
      </div>

      <div className="mt-auto flex gap-2 pt-4">
        <Button size="sm" icon={CalendarPlus} onClick={() => onPlan(match)}>Plan</Button>
        {onFix && needsFix && <Button size="sm" variant="secondary" icon={Wand2} onClick={() => onFix(match)}>Fix with swaps</Button>}
      </div>
    </Card>
  );
}
