import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';

const CATEGORY_ORDER = ['economy', 'military', 'arcane'];
const CATEGORY_LABELS = {
  economy: 'Economy',
  military: 'Military',
  arcane: 'Arcane Arts',
};

export default function ScienceCalculator() {
  const [builds, setBuilds] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [categoryBooks, setCategoryBooks] = useState({ economy: '', military: '', arcane: '' });
  const [effectMap, setEffectMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [buildsRes, rulesRes] = await Promise.all([
        supabase
          .from('ai_builds')
          .select('id, name, race, personality, build_type, science')
          .eq('active', true)
          .order('name'),
        supabase
          .from('science_rules')
          .select('science_name, effect')
          .eq('active', true),
      ]);

      if (!buildsRes.error && buildsRes.data) {
        setBuilds(buildsRes.data.filter(b => b.science && Object.keys(b.science).length > 0));
      }
      if (!rulesRes.error && rulesRes.data) {
        const map = {};
        rulesRes.data.forEach(r => {
          map[r.science_name.toLowerCase()] = r.effect;
        });
        setEffectMap(map);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const selectedBuild = builds.find(b => b.id === selectedId);

  const buildByCategory = useMemo(() => {
    if (!selectedBuild) return null;
    const entries = Object.entries(selectedBuild.science)
      .filter(([, v]) => v && Number(v.books) > 0);

    const byCategory = {};
    entries.forEach(([name, v]) => {
      const cat = v.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push({ name, weight: Number(v.books) });
    });
    Object.values(byCategory).forEach(rows => rows.sort((a, b) => b.weight - a.weight));
    return byCategory;
  }, [selectedBuild]);

  const results = useMemo(() => {
    if (!buildByCategory) return null;
    const out = {};
    Object.entries(buildByCategory).forEach(([cat, rows]) => {
      const catBooks = parseFloat(categoryBooks[cat]);
      if (!catBooks || catBooks <= 0) return;
      const sumWeights = rows.reduce((sum, r) => sum + r.weight, 0);
      if (sumWeights === 0) return;
      const perUnit = catBooks / sumWeights;
      out[cat] = {
        perUnit,
        sumWeights,
        catBooks,
        rows: rows.map(r => ({
          ...r,
          allocated: Math.round(r.weight * perUnit),
          effect: effectMap[r.name.toLowerCase()] || '',
        })),
      };
    });
    return Object.keys(out).length ? out : null;
  }, [buildByCategory, categoryBooks, effectMap]);

  if (loading) return <div className="text-gray-400 p-4">Loading builds...</div>;

  const orderedCategories = buildByCategory
    ? [
        ...CATEGORY_ORDER.filter(c => buildByCategory[c]),
        ...Object.keys(buildByCategory).filter(c => !CATEGORY_ORDER.includes(c)),
      ]
    : [];

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-xl font-bold text-yellow-400">Science Book Calculator</h2>
      <p className="text-xs text-gray-500">
        Pick a build, enter the books available in each category. Each category splits independently:
        category total ÷ (sum of that category's weights) = books per weight-point, then weight × that
        = books to send to each science.
      </p>

      <select
        className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white w-full"
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
      >
        <option value="">Select race / personality build...</option>
        {builds.map(b => (
          <option key={b.id} value={b.id}>
            {b.name}{b.build_type ? ` (${b.build_type})` : ''}
          </option>
        ))}
      </select>

      {buildByCategory && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {orderedCategories.map(cat => (
            <div key={cat}>
              <label className="text-xs text-gray-400 block mb-1">
                {CATEGORY_LABELS[cat] || cat} books
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white w-full"
                value={categoryBooks[cat] || ''}
                onChange={e =>
                  setCategoryBooks(prev => ({ ...prev, [cat]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
      )}

      {results && orderedCategories.map(cat => {
        const r = results[cat];
        if (!r) return null;
        return (
          <div key={cat} className="border border-gray-800 rounded">
            <div className="bg-gray-800 px-3 py-2 text-yellow-400 font-semibold">
              {CATEGORY_LABELS[cat] || cat} — {r.rows.length} sciences — {r.catBooks.toLocaleString()} books
            </div>
            <table className="w-full text-sm">
              <tbody>
                {r.rows.map(row => (
                  <tr key={row.name} className="border-b border-gray-800">
                    <td className="py-2 pl-3 capitalize w-1/4">{row.name}</td>
                    <td className="text-yellow-400 font-semibold w-1/5">{row.allocated.toLocaleString()}</td>
                    <td className="text-gray-400 pr-3">{row.effect}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs text-gray-500 px-3 py-1">
              {r.catBooks.toLocaleString()} ÷ {r.sumWeights} = {r.perUnit.toFixed(2)} books/weight-point
            </div>
          </div>
        );
      })}
    </div>
  );
}
