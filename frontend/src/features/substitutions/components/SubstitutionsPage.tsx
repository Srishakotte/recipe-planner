import { useState, useEffect } from 'react';
import {
  useGetSubstitutionsQuery,
  useCreateSubstitutionMutation,
  useDeleteSubstitutionMutation,
  useGetConstraintsQuery,
  useCreateConstraintMutation,
  useDeleteConstraintMutation,
  useGetSynonymsQuery,
  useCreateSynonymMutation,
  useDeleteSynonymMutation,
} from '../../../app/api';

const constraintTypes = ['dietary', 'allergen', 'preference'];
const commonSubstitutions = [
  { original: 'Eggs', substitute: 'Flax Egg (1 tbsp ground flax + 3 tbsp water)', similarity: 85 },
  { original: 'Milk', substitute: 'Oat Milk', similarity: 90 },
  { original: 'Butter', substitute: 'Coconut Oil', similarity: 88 },
  { original: 'Cream', substitute: 'Coconut Cream', similarity: 82 },
  { original: 'Sugar', substitute: 'Honey (3/4 ratio)', similarity: 78 },
  { original: 'Flour', substitute: 'Almond Flour', similarity: 70 },
];

export default function SubstitutionsPage() {
  const [showSubForm, setShowSubForm] = useState(false);
  const [showConstraintForm, setShowConstraintForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Form state
  const [originalIngredient, setOriginalIngredient] = useState('');
  const [substituteIngredient, setSubstituteIngredient] = useState('');
  const [quantityRatio, setQuantityRatio] = useState(1);
  const [substituteUnit, setSubstituteUnit] = useState('');
  const [subConstraintType, setSubConstraintType] = useState('dietary');
  const [subConstraintValue, setSubConstraintValue] = useState('');
  const [constraintType, setConstraintType] = useState('dietary');
  const [constraintValue, setConstraintValue] = useState('');

  const { data: substitutions, isLoading: subsLoading } = useGetSubstitutionsQuery();
  const { data: constraints } = useGetConstraintsQuery();
  const { data: synonyms = [] } = useGetSynonymsQuery();
  const [createSubstitution] = useCreateSubstitutionMutation();
  const [deleteSubstitution] = useDeleteSubstitutionMutation();
  const [createConstraint] = useCreateConstraintMutation();
  const [deleteConstraint] = useDeleteConstraintMutation();
  const [createSynonym] = useCreateSynonymMutation();
  const [deleteSynonym] = useDeleteSynonymMutation();
  const [showSynonymForm, setShowSynonymForm] = useState(false);
  const [synSynonym, setSynSynonym] = useState('');
  const [synCanonical, setSynCanonical] = useState('');

  const handleCreateSub = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSubstitution({ originalIngredient, substituteIngredient, quantityRatio, substituteUnit: substituteUnit || undefined, constraintType: subConstraintType, constraintValue: subConstraintValue });
    setOriginalIngredient(''); setSubstituteIngredient(''); setQuantityRatio(1); setSubstituteUnit(''); setSubConstraintValue('');
    setShowSubForm(false);
  };

  const handleCreateConstraint = async (e: React.FormEvent) => {
    e.preventDefault();
    await createConstraint({ constraintType, constraintValue });
    setConstraintValue(''); setShowConstraintForm(false);
  };

  // Filter common subs by search
  const filteredCommon = searchQuery
    ? commonSubstitutions.filter(s => s.original.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🔄 Substitutions</h1>
          <p className="text-gray-500 mt-1">Find alternatives for missing ingredients</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAiPanel(!showAiPanel)}
            className="px-4 py-2.5 bg-gradient-to-r from-purple-500 to-violet-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg transition-all hover:scale-[1.02]">
            🤖 Smart Recipe Fixer
          </button>
          <button onClick={() => setShowSubForm(!showSubForm)}
            className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:shadow-lg transition-all hover:scale-[1.02]">
            + Add Rule
          </button>
        </div>
      </div>

      {/* AI Smart Recipe Fixer */}
      {showAiPanel && (
        <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-purple-100 animate-scale-in">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">🔧</span>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-800">Smart Recipe Fixer</h3>
              <p className="text-sm text-gray-600 mt-1">Select a recipe and AI will suggest substitutions for missing ingredients using what's in your pantry</p>
              <div className="mt-4 bg-white rounded-xl p-4 border border-purple-100">
                <p className="text-xs font-medium text-gray-500 mb-2">Example: Chicken Alfredo</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 bg-red-50 rounded-lg">
                    <span className="text-xs font-medium text-red-600">Missing:</span>
                    <span className="text-sm text-gray-800">Heavy Cream</span>
                    <span className="text-xs text-gray-400 mx-2">→</span>
                    <span className="text-sm text-green-700 font-medium">Milk + Butter (in pantry ✓)</span>
                    <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">92% similar</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-red-50 rounded-lg">
                    <span className="text-xs font-medium text-red-600">Missing:</span>
                    <span className="text-sm text-gray-800">Parmesan</span>
                    <span className="text-xs text-gray-400 mx-2">→</span>
                    <span className="text-sm text-green-700 font-medium">Cheddar Cheese (close match)</span>
                    <span className="ml-auto text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">75% similar</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Substitutions */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        <input
          type="text"
          placeholder="Search for an ingredient to find substitutes (e.g. Heavy Cream, Eggs, Butter)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none text-sm shadow-sm"
        />
      </div>

      {/* Search Results */}
      {filteredCommon.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm animate-scale-in">
          <h3 className="font-bold text-gray-800 mb-4">Found Substitutes</h3>
          <div className="space-y-3">
            {filteredCommon.map((sub, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-green-50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{sub.original}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-green-700">{sub.substitute}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${sub.similarity}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 mt-0.5">{sub.similarity}% match</span>
                  </div>
                  <button className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-200">
                    Use This
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Substitution Chips */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-800 text-sm mb-3">Common Substitutions — Quick Search</h3>
        <div className="flex flex-wrap gap-2">
          {['Eggs', 'Milk', 'Butter', 'Cream', 'Sugar', 'Honey', 'Flour', 'Soy Sauce', 'Yogurt'].map(item => (
            <button
              key={item}
              onClick={() => setSearchQuery(item)}
              className="px-3.5 py-2 bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 rounded-xl text-sm font-medium text-gray-700 hover:text-green-700 transition-all"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Active Dietary Constraints */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-sm">My Dietary Constraints</h3>
          <button onClick={() => setShowConstraintForm(!showConstraintForm)}
            className="text-xs text-green-600 font-semibold hover:text-green-700">+ Add</button>
        </div>

        {showConstraintForm && (
          <form onSubmit={handleCreateConstraint} className="mb-4 flex gap-3 items-end bg-gray-50 p-3 rounded-xl">
            <select value={constraintType} onChange={(e) => setConstraintType(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm">
              {constraintTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="text" value={constraintValue} onChange={(e) => setConstraintValue(e.target.value)}
              placeholder="e.g. dairy-free, no-peanuts" required
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm" />
            <button type="submit" className="px-4 py-2 bg-green-600 text-white text-sm rounded-xl font-semibold">Add</button>
          </form>
        )}

        {!constraints || constraints.length === 0 ? (
          <p className="text-gray-400 text-sm">No constraints set. Add one to auto-apply substitutions.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {constraints.map(c => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-xl">
                <span className="text-xs font-medium text-green-700">{c.constraintType}: {c.constraintValue}</span>
                <button onClick={() => deleteConstraint(c.id)} className="text-red-400 hover:text-red-600 text-sm">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Substitution Rules Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-sm">Active Substitution Rules</h3>
          <button onClick={() => setShowSubForm(!showSubForm)} className="text-xs text-green-600 font-semibold">+ Add Rule</button>
        </div>

        {showSubForm && (
          <form onSubmit={handleCreateSub} className="p-5 bg-gray-50 border-b border-gray-100">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
              <input type="text" value={originalIngredient} onChange={(e) => setOriginalIngredient(e.target.value)}
                placeholder="Original ingredient" required className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              <input type="text" value={substituteIngredient} onChange={(e) => setSubstituteIngredient(e.target.value)}
                placeholder="Substitute" required className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              <input type="number" step="0.1" value={quantityRatio} onChange={(e) => setQuantityRatio(Number(e.target.value))}
                placeholder="Ratio" className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              <select value={subConstraintType} onChange={(e) => setSubConstraintType(e.target.value)}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm">
                {constraintTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="text" value={subConstraintValue} onChange={(e) => setSubConstraintValue(e.target.value)}
                placeholder="Constraint value (e.g. dairy-free)" required className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
              <button type="submit" className="px-4 py-2.5 bg-green-600 text-white text-sm rounded-xl font-semibold">Create Rule</button>
            </div>
          </form>
        )}

        {subsLoading ? (
          <div className="p-8 text-center"><span className="animate-pulse text-xl">🔄</span></div>
        ) : !substitutions || substitutions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <span className="text-3xl block mb-2">🔄</span>
            <p className="text-sm">No rules yet. Add dietary constraints to see automatic substitutions.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Original</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">→ Substitute</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Ratio</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Applies When</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {substitutions.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-gray-800 text-sm">{sub.originalIngredient}</td>
                  <td className="px-5 py-3.5 text-green-700 font-medium text-sm">{sub.substituteIngredient}</td>
                  <td className="px-5 py-3.5 text-gray-600 text-sm">{sub.quantityRatio}×</td>
                  <td className="px-5 py-3.5">
                    <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium">
                      {sub.constraintType}: {sub.constraintValue}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button onClick={() => deleteSubstitution(sub.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {/* Ingredient Synonyms */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800 text-sm">📝 Ingredient Synonyms</h3>
            <p className="text-xs text-gray-400 mt-0.5">Map different names to the same ingredient (e.g. scallion = green onion)</p>
          </div>
          <button onClick={() => setShowSynonymForm(!showSynonymForm)} className="text-xs text-green-600 font-semibold">+ Add Synonym</button>
        </div>

        {showSynonymForm && (
          <div className="p-5 bg-gray-50 border-b border-gray-100 flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-[10px] font-medium text-gray-500 block mb-1">Synonym (what user might type)</label>
              <input type="text" value={synSynonym} onChange={(e) => setSynSynonym(e.target.value)}
                placeholder="e.g. scallion, lady finger, dahi" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-medium text-gray-500 block mb-1">Canonical name (standard name)</label>
              <input type="text" value={synCanonical} onChange={(e) => setSynCanonical(e.target.value)}
                placeholder="e.g. green onion, okra, yogurt" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
            </div>
            <button
              onClick={async () => {
                if (synSynonym && synCanonical) {
                  await createSynonym({ synonym: synSynonym, canonicalName: synCanonical });
                  setSynSynonym(''); setSynCanonical(''); setShowSynonymForm(false);
                }
              }}
              className="px-4 py-2.5 bg-green-600 text-white text-sm rounded-xl font-semibold whitespace-nowrap">Add</button>
          </div>
        )}

        {synonyms.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No synonyms yet. Add some to help the engine merge ingredients correctly.</div>
        ) : (
          <div className="p-4 flex flex-wrap gap-2">
            {synonyms.map((s: any) => (
              <div key={s.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-xl group">
                <span className="text-xs text-gray-700">{s.synonym}</span>
                <span className="text-xs text-gray-400">=</span>
                <span className="text-xs font-medium text-blue-700">{s.canonicalName}</span>
                <button onClick={() => deleteSynonym(s.id)} className="text-red-400 hover:text-red-600 ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-sm">×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
