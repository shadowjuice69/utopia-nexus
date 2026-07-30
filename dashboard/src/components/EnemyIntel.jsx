import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

function parseNum(val) {
  if (!val) return 0;
  return parseFloat(val.toString().replace(/,/g, "")) || 0;
}

function scoreTarget(p, myNW) {
  let score = 0;
  const nw = parseNum(p.networth);
  const acres = parseNum(p.land);
  const def = parseNum(p.defense);
  const off = parseNum(p.offense);
  const race = (p.race || "").toLowerCase();
  const HIGH_GAIN = ["elf", "faery", "halfling", "dryad"];
  const LOW_GAIN  = ["undead", "orc"];
  const ratio = myNW > 0 ? nw / myNW : 0;
  if (ratio >= 0.9 && ratio <= 1.05) score += 30;
  else if (ratio >= 0.75 && ratio <= 1.1) score += 15;
  if (acres > 2500) score += 25;
  else if (acres > 2000) score += 18;
  else if (acres > 1500) score += 10;
  if (HIGH_GAIN.some(r => race.includes(r))) score += 20;
  if (LOW_GAIN.some(r => race.includes(r))) score -= 10;
  if (def > 0 && off > 0) {
    if (def < off * 0.3) score += 20;
    else if (def < off * 0.5) score += 10;
    else if (def > off) score -= 15;
  }
  if (p.updated_at) {
    const ageDays = (Date.now() - new Date(p.updated_at)) / 86400000;
    if (ageDays > 7) score -= 20;
    else if (ageDays > 3) score -= 10;
  }
  return score;
}

function gradeScore(score) {
  if (score >= 70) return { grade: "S", color: "#4ade80" };
  if (score >= 50) return { grade: "A", color: "#38bdf8" };
  if (score >= 30) return { grade: "B", color: "#facc15" };
  if (score >= 10) return { grade: "C", color: "#fb923c" };
  return { grade: "D", color: "#f87171" };
}

function IntelBar({ value, max, color = "#38bdf8" }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="intel-bar-bg">
      <div className="intel-bar-fill" style={{ width: pct + "%", background: color }} />
    </div>
  );
}

function nwColor(nw, myNw) {
  if (!nw || !myNw) return "#94a3b8";
  const ratio = nw / myNw;
  if (ratio > 1.1) return "#f87171";
  if (ratio > 0.9) return "#facc15";
  return "#4ade80";
}

function formatSpells(spells) {
  if (!spells) return null;
  if (typeof spells === "string") return spells;
  if (Array.isArray(spells)) return spells.join(" · ");
  if (typeof spells === "object") return Object.entries(spells).map(([k, v]) => k + " (" + v + ")").join(" · ");
  return String(spells);
}

function formatTroops(troops) {
  if (!troops || typeof troops !== "object") return null;
  return Object.entries(troops).filter(([, v]) => v > 0).map(([k, v]) => k.replace(/_/g, " ") + ": " + v.toLocaleString()).join(" · ");
}

const DETAIL_FIELDS = [
  { key: "networth", label: "NW" },
  { key: "land", label: "Acres" },
  { key: "offense", label: "Offense" },
  { key: "defense", label: "Defense" },
  { key: "be", label: "BE%" },
  { key: "honor", label: "Honor" },
  { key: "peasants", label: "Peasants" },
  { key: "thieves", label: "Thieves" },
  { key: "tpa", label: "TPA" },
  { key: "wizards", label: "Wizards" },
  { key: "wpa", label: "WPA" },
  { key: "mana", label: "Mana%" },
  { key: "stealth", label: "Stealth" },
  { key: "ruler", label: "Ruler" },
  { key: "personality", label: "Personality" },
  { key: "kd_code", label: "Kingdom" },
];

export default function EnemyIntel() {
  const [provinces, setProvinces] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("score");
  const [kdFilter, setKdFilter] = useState("all");
  const [myNw, setMyNw] = useState(null);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 60000);
    return () => clearInterval(iv);
  }, []);

  async function fetchAll() {
    const { data: settings } = await supabase.from("bot_settings").select("value").eq("key", "kingdom_code").single();
    const myKd = settings?.value || "3:2";
    const { data: throne } = await supabase.from("intel_throne").select("*").neq("kd_code", myKd).order("updated_at", { ascending: false });
    const { data: me } = await supabase.from("provinces").select("nw").eq("name", "Sumi Gaeshi").single();
    if (me && me.nw) setMyNw(parseNum(me.nw));
    if (throne) setProvinces(throne);
    setLoading(false);
  }

  const kingdoms = ["all", ...new Set(provinces.map(p => p.kd_code).filter(Boolean))];

  const scored = provinces
    .filter(p => kdFilter === "all" || p.kd_code === kdFilter)
    .filter(p => !search || (p.province && p.province.toLowerCase().includes(search.toLowerCase())) || (p.race && p.race.toLowerCase().includes(search.toLowerCase())) || (p.kd_code && p.kd_code.includes(search)))
    .map(p => ({ ...p, _score: scoreTarget(p, myNw), _nw: parseNum(p.networth) }))
    .sort((a, b) => {
      if (sortBy === "score") return b._score - a._score;
      if (sortBy === "nw") return b._nw - a._nw;
      if (sortBy === "acres") return parseNum(b.land) - parseNum(a.land);
      if (sortBy === "def") return parseNum(b.defense) - parseNum(a.defense);
      if (sortBy === "updated") return new Date(b.updated_at) - new Date(a.updated_at);
      return 0;
    });

  const maxNw = Math.max(...scored.map(p => p._nw), 1);

  if (loading) return <div className="loading">Loading Enemy Intel...</div>;

  return (
    <div className="intel-panel">
      <div className="intel-controls">
        <input className="intel-search" placeholder="Search province, race, kingdom..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="intel-sort" value={kdFilter} onChange={e => setKdFilter(e.target.value)}>
          {kingdoms.map(k => (<option key={k} value={k}>{k === "all" ? "All Kingdoms" : "KD " + k}</option>))}
        </select>
        <select className="intel-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="score">Sort: Target Score</option>
          <option value="nw">Sort: NW</option>
          <option value="acres">Sort: Acres</option>
          <option value="def">Sort: Defense</option>
          <option value="updated">Sort: Recently Updated</option>
        </select>
      </div>
      <div className="panel">
        <h2>Enemy Intel ({scored.length})</h2>
        <div className="province-list">
          {scored.length === 0 && (
            <div style={{ color: "#64748b", padding: 24, textAlign: "center" }}>
              No enemy intel yet - paste throne pages in the Import tab.
            </div>
          )}
          {scored.map(p => {
            const color = nwColor(p._nw, myNw);
            const graded = gradeScore(p._score);
            const isOpen = selected && selected.id === p.id;
            const ageHrs = p.updated_at ? Math.round((Date.now() - new Date(p.updated_at)) / 3600000) : null;
            return (
              <div key={p.id} className={"province-row " + (isOpen ? "selected" : "")} onClick={() => setSelected(isOpen ? null : p)}>
                <div className="province-main">
                  <span className="province-name" style={{ color }}>{p.province}</span>
                  <span className="province-combo">{p.race || "?"} · KD {p.kd_code || "?"}</span>
                  <span className="province-nw">{p.networth ? parseNum(p.networth).toLocaleString() + " NW" : "No NW"}</span>
                  <span className="target-grade" style={{ color: graded.color, border: "1px solid " + graded.color }}>{graded.grade}</span>
                </div>
                <IntelBar value={p._nw} max={maxNw} color={color} />
                {isOpen && (
                  <div className="province-detail">
                    <div className="detail-grid">
                      {DETAIL_FIELDS.map(f => p[f.key] ? (
                        <div key={f.key} className="detail-item">
                          <span className="detail-label">{f.label}</span>
                          <strong className="detail-value">{p[f.key]}</strong>
                        </div>
                      ) : null)}
                    </div>
                    {p.troops && formatTroops(p.troops) && (
                      <div className="spell-row"><span className="spell-label">Troops:</span><span className="spell-value">{formatTroops(p.troops)}</span></div>
                    )}
                    {p.spells && formatSpells(p.spells) && (
                      <div className="spell-row"><span className="spell-label">Spells:</span><span className="spell-value">{formatSpells(p.spells)}</span></div>
                    )}
                    <div className="detail-item" style={{ marginTop: 12, textAlign: "center" }}>
                      <span className="detail-label">Target Score</span>
                      <strong className="detail-value" style={{ color: graded.color, fontSize: 28 }}>{graded.grade} ({p._score})</strong>
                    </div>
                    <div className="detail-meta">
                      Last updated: {ageHrs !== null ? ageHrs + "h ago" : "Unknown"} · {p.updated_at ? new Date(p.updated_at).toUTCString().slice(0, 25) : ""}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="stats-row">
        <div className="stat-card"><span className="stat-label">Provinces Tracked</span><strong className="stat-value" style={{ color: "#38bdf8" }}>{provinces.length}</strong></div>
        <div className="stat-card"><span className="stat-label">Kingdoms</span><strong className="stat-value" style={{ color: "#a78bfa" }}>{kingdoms.length - 1}</strong></div>
        <div className="stat-card"><span className="stat-label">S/A Targets</span><strong className="stat-value" style={{ color: "#4ade80" }}>{scored.filter(p => p._score >= 50).length}</strong></div>
        <div className="stat-card"><span className="stat-label">Stale (&gt;7d)</span><strong className="stat-value" style={{ color: "#f87171" }}>{provinces.filter(p => !p.updated_at || (Date.now() - new Date(p.updated_at)) / 86400000 > 7).length}</strong></div>
      </div>
    </div>
  );
}
