import { useSearchParams } from 'react-router-dom';
import { AiOrb } from '../../shared/components/RecipeVisuals';
import ChefChat from './ChefChat';

export default function ChefPage() {
  const [params] = useSearchParams();
  return (
    <div className="flex h-[calc(100vh-11rem)] flex-col lg:h-[calc(100vh-5rem)]">
      <div className="mb-5 flex items-center gap-4">
        <AiOrb size="lg" />
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Sous-chef</h1>
          <p className="text-sm text-slate-500">Searches ~900 recipes by meaning, reads your pantry, plan and list, and answers with sources.</p>
        </div>
      </div>
      <div className="min-h-0 flex-1"><ChefChat key={params.get('q') ?? ''} initialPrompt={params.get('q') ?? undefined} /></div>
    </div>
  );
}
