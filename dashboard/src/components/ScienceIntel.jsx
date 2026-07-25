import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const CATEGORY_EMOJI = {
  economy: "💰",
  military: "⚔️",
  arcane_arts: "🔮",
};

const CATEGORY_COLOR = {
  economy: "#f59e0b",
  military: "#ef4444",
  arcane_arts: "#8b5cf6",
};

const SCIENCE_KEYS = [
  { key: "alchemy",     category: "economy",     name: "Alchemy" },
  { key: "artisan",     category: "economy",     name: "Artisan" },
  { key: "bookkeeping", category: "economy",     name: "Bookkeeping" },
  { key: "housing",     category: "economy",     name: "Housing" },
  { key: "production",  category: "economy",     name: "Production" },
  { key: "tools",       category: "economy",     name: "Tools" },
  { key: "heroism",     category: "military",    name: "Heroism" },
  { key: "resilience",  category: "military",    name: "Resilience" },
  { key: "siege",       category: "military",    name: "Siege" },
  { key: "strategy",    category: "military",    name: "Strategy" },
  { key: "tactics",     category: "military",    name: "Tactics" },
  { key: "valor",       category: "military",    name: "Valor" },
  { key: "arcana",      category: "arcane_arts", name: "Arcana" },
  { key: "channeling",  category: "arcane_arts", name: "Channeling" },
  { key: "crime",       category: "arcane_arts", name: "Crime" },
  { key: "finesse",     category: "arcane_arts", name: "Finesse" },
  { key: "shielding",   category: "arcane_arts", name: "Shielding" },
];

function ScienceBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 6, width: "100%", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s" }} />
    </div>
  );
}

export default function ScienceIntel() {
  const [provinces, setProvinces] = useState([]);
  const [scienceRules, setScienceRules] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    const [{ data: sciData }, { data: rulesData }] = await Promise.all([
      supabase.from("intel_science").select("*").order("province"),
      supabase.from("science_rules")
        .select("science_name, multiplier, effect, category")
        .eq("active", true).eq("age_number", 116)
        .not("multiplier", "is", null),
    ]);
    const ruleMap = {};
    if (rulesData) {
      for (const r of rulesData) {
        const key = r.science_name.toLowerCase();
        if (!ruleMap[key]) ruleMap[key] = r;
      }
    }
    setScienceRules(ruleMap);
    setProvinces(sciData || []);
    setLoading(false);
  }

  function getEffect(prov, key) {
    const effects = prov.science_effects || {};
    if (effects[key]) return effects[key];
    const books = prov[key] || 0;
    const rule = scienceRules[key];
    if (!books || !rule) return "0.0%";
    const bonus = Math.pow(books, 1 / 2.125) * parseFloat(rule.multiplier);
    return `${bonus.toFixed(1)}%`;
  }

  function getTotalBooks(prov) {
    return SCIENCE_KEYS.reduce((sum, s) => sum + (prov[s.key] || 0), 0);
  }

  const filteredKeys = activeCategory === "all"
    ? SCIENCE_KEYS
    : SCIENCE_KEYS.filter(s => s.category === activeCategory);

  const maxBooks = {};
  for (const s of SCIENCE_KEYS) {
    maxBooks[s.key] = Math.max(...provinces.map(p => p[s.key] || 0), 1);
  }

  if (loading) return <div className="loading">⏳ Loading Science Intel...</div>;
  if (provinces.length === 0) {
    return (
      <div className="panel">
        <h2>🔬 Science Intelligence</h2>
        <p className="empty">No science data yet. Use /utopia intel and paste a science page.</p>
      </div>
    );
  }

  return (
    <div className="intel-panel">
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>🔬 Science Intelligence ({provinces.length})</h2>
          <div style={{ display: "flex", gap: 6 }}>
            {["all","economy","military","arcane_arts"].map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                padding: "4px 10px", borderRadius: 6,
                border: "1px solid rgba(99,102,241,0.4)",
                background: activeCategory === cat ? "#6366f1" : "rgba(99,102,241,0.1)",
                color: activeCategory === cat ? "#fff" : "#94a3b8",
                cursor: "pointer", fontSize: 12,
              }}>
                {cat === "all" ? "All" : cat === "arcane_arts" ? "🔮 Arcane" : cat === "economy" ? "💰 Economy" : "⚔️ Military"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {provinces.map(prov => (
            <div key={prov.id} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: 14,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <span style={{ color: "#38bdf8", fontWeight: 600, fontSize: 15 }}>{prov.province}</span>
                  <span style={{ color: "#475569", fontSize: 12, marginLeft: 8 }}>{prov.kd_code}</span>
                </div>
                <div style={{ color: "#64748b", fontSize: 12 }}>
                  {getTotalBooks(prov).toLocaleString()} total books · Updated {new Date(prov.updated_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                {filteredKeys.map(s => {
                  const books = prov[s.key] || 0;
                  const effect = getEffect(prov, s.key);
                  const color = CATEGORY_COLOR[s.category];
                  return (
                    <div key={s.key} style={{
                      background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "8px 10px",
                      borderLeft: `3px solid ${books > 0 ? color : "#1e293b"}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: books > 0 ? "#e2e8f0" : "#475569", fontSize: 13, fontWeight: 500 }}>
                          {CATEGORY_EMOJI[s.category]} {s.name}
                        </span>
                        <span style={{ color: books > 0 ? color : "#475569", fontSize: 12, fontWeight: 600 }}>
                          {effect}
                        </span>
                      </div>
                      <ScienceBar value={books} max={maxBooks[s.key]} color={color} />
                      <div style={{ color: "#475569", fontSize: 11, marginTop: 3 }}>
                        {books > 0 ? books.toLocaleString() + " books" : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
