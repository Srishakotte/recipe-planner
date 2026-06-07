import { useState } from 'react';
import {
  useGetSubstitutionsQuery,
  useCreateSubstitutionMutation,
  useDeleteSubstitutionMutation,
  useGetConstraintsQuery,
  useCreateConstraintMutation,
  useDeleteConstraintMutation,
} from '../../../app/api';

const constraintTypes = ['allergy', 'dietary', 'preference', 'medical'];

export default function SubstitutionsPage() {
  const [showSubForm, setShowSubForm] = useState(false);
  const [showConstraintForm, setShowConstraintForm] = useState(false);

  // Substitution form state
  const [originalIngredient, setOriginalIngredient] = useState('');
  const [substituteIngredient, setSubstituteIngredient] = useState('');
  const [quantityRatio, setQuantityRatio] = useState(1);
  const [substituteUnit, setSubstituteUnit] = useState('');
  const [subConstraintType, setSubConstraintType] = useState('dietary');
  const [subConstraintValue, setSubConstraintValue] = useState('');

  // Constraint form state
  const [constraintType, setConstraintType] = useState('dietary');
  const [constraintValue, setConstraintValue] = useState('');

  const { data: substitutions, isLoading: subsLoading } = useGetSubstitutionsQuery();
  const { data: constraints, isLoading: constraintsLoading } = useGetConstraintsQuery();
  const [createSubstitution, { isLoading: isCreatingSub }] = useCreateSubstitutionMutation();
  const [deleteSubstitution] = useDeleteSubstitutionMutation();
  const [createConstraint, { isLoading: isCreatingConstraint }] = useCreateConstraintMutation();
  const [deleteConstraint] = useDeleteConstraintMutation();

  const handleCreateSubstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    await createSubstitution({
      originalIngredient,
      substituteIngredient,
      quantityRatio,
      substituteUnit: substituteUnit || undefined,
      constraintType: subConstraintType,
      constraintValue: subConstraintValue,
    });
    setOriginalIngredient('');
    setSubstituteIngredient('');
    setQuantityRatio(1);
    setSubstituteUnit('');
    setSubConstraintValue('');
    setShowSubForm(false);
  };

  const handleCreateConstraint = async (e: React.FormEvent) => {
    e.preventDefault();
    await createConstraint({
      constraintType,
      constraintValue,
      isActive: true,
    });
    setConstraintValue('');
    setShowConstraintForm(false);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Substitutions & Dietary Constraints</h1>

      {/* Dietary Constraints Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-700">My Dietary Constraints</h2>
          <button
            onClick={() => setShowConstraintForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            + Add Constraint
          </button>
        </div>

        {showConstraintForm && (
          <form onSubmit={handleCreateConstraint} className="mb-4 bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={constraintType}
                  onChange={(e) => setConstraintType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                >
                  {constraintTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                <input
                  type="text"
                  value={constraintValue}
                  onChange={(e) => setConstraintValue(e.target.value)}
                  placeholder="e.g., gluten-free, nut allergy, vegan"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isCreatingConstraint}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {isCreatingConstraint ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => setShowConstraintForm(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {constraintsLoading ? (
          <div className="flex items-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
            <span className="ml-2 text-gray-500 text-sm">Loading...</span>
          </div>
        ) : !constraints || constraints.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No dietary constraints set.</p>
            <p className="text-gray-400 text-sm mt-1">Add constraints to automatically apply substitutions.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {constraints.map((c) => (
              <div
                key={c.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                  c.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <span className="font-medium">{c.constraintValue}</span>
                <span className="text-xs opacity-70">({c.constraintType})</span>
                <button
                  onClick={() => deleteConstraint(c.id)}
                  className="text-red-400 hover:text-red-600 ml-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Substitution Rules Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-700">Substitution Rules</h2>
          <button
            onClick={() => setShowSubForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            + Add Rule
          </button>
        </div>

        {showSubForm && (
          <form onSubmit={handleCreateSubstitution} className="mb-4 bg-white border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Original Ingredient</label>
                <input
                  type="text"
                  value={originalIngredient}
                  onChange={(e) => setOriginalIngredient(e.target.value)}
                  placeholder="e.g., milk"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Substitute Ingredient</label>
                <input
                  type="text"
                  value={substituteIngredient}
                  onChange={(e) => setSubstituteIngredient(e.target.value)}
                  placeholder="e.g., oat milk"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Ratio</label>
                <input
                  type="number"
                  value={quantityRatio}
                  onChange={(e) => setQuantityRatio(Number(e.target.value))}
                  step="0.1"
                  min={0.1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Substitute Unit (optional)</label>
                <input
                  type="text"
                  value={substituteUnit}
                  onChange={(e) => setSubstituteUnit(e.target.value)}
                  placeholder="e.g., ml, cups"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Constraint Type</label>
                <select
                  value={subConstraintType}
                  onChange={(e) => setSubConstraintType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                >
                  {constraintTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Constraint Value</label>
                <input
                  type="text"
                  value={subConstraintValue}
                  onChange={(e) => setSubConstraintValue(e.target.value)}
                  placeholder="e.g., lactose-free"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isCreatingSub}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {isCreatingSub ? 'Creating...' : 'Create Rule'}
              </button>
              <button
                type="button"
                onClick={() => setShowSubForm(false)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {subsLoading ? (
          <div className="flex items-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
            <span className="ml-2 text-gray-500 text-sm">Loading...</span>
          </div>
        ) : !substitutions || substitutions.length === 0 ? (
          <div className="text-center py-6 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No substitution rules defined.</p>
            <p className="text-gray-400 text-sm mt-1">Add rules to auto-substitute ingredients based on your constraints.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Original</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Substitute</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Ratio</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Applies When</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {substitutions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{sub.originalIngredient}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {sub.substituteIngredient}
                      {sub.substituteUnit && <span className="text-gray-400 text-sm ml-1">({sub.substituteUnit})</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{sub.quantityRatio}×</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800">
                        {sub.constraintType}: {sub.constraintValue}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => deleteSubstitution(sub.id)}
                        className="text-sm text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
