import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const FIELDS = [
  { key: "nw", label: "NW" },
  { key: "acres", label: "Acres" },
  { key: "off", label: "Offense" },
  { key: "def", label: "Defense" },
  { key: "be", label: "BE%" },
  { key: "wages", label: "Wages%" },
  { key: "stlth", label: "Stealth" },
  { key: "mana", label: "Mana%" },
  { key: "o_tpa", label: "oTPA" },
  { key: "d_tpa", label: "dTPA" },
  { key: "o_wpa", label: "oWPA" },
  { key: "d_wpa", label: "dWPA" },
  { key: "soldiers", label: "Soldiers" },
  { key: "off_specs", label: "Off Specs" },
  { key: "def_specs", label: "Def Specs" },
  { key: "elites", label: "Elites" },
  { key: "thieves", label: "Thieves" },
  { key: "wizards", label: "Wizards" },
  { key: "war_horses", label: "War Horses" },
  { key: "prisoners", label: "Prisoners" },
  { key: "ruler", label: "Ruler" },
];

const HIGH_GAIN_RACES = ["elf", "faery", "halfling", "dryad"];
const LOW_GAIN_RACES = ["undead", "orc"];

function parseNW(nw) {
  if (!nw) return 0;
  return parseFloat(nw.toString().replace(/,/g, "")) || 0;
}

function scoreTarget(province, myNW) {
  let score = 0;
  const nw = parseNW(province.nw);
  const acres = parseNW(province.acres);
  const def = parseNW(province.def);
  const off = parseNW(province.off);
  const race = (province.race || province.combo || "").toLowerCase();

  const nwRatio = myNW > 0 ? nw / myNW : 0;
  if (nwRatio >= 0.9 && nwRatio <= 1.05) score += 30;
  else if (nwRatio >= 0.75 && nwRatio <= 1.1) score += 15;

  if (acres > 2500) score += 25;
  else if (acres > 2000) score += 18;
  else if (acres > 1500) score += 10;

  if (HIGH_GAIN_RACES.some(r => race.includes(r))) score += 20;
  if (LOW_GAIN_RACES.some(r => race.includes(r))) score -= 10;

  if (def > 0 && off > 0) {
    if (def < off * 0.3) score += 20;
    else if (def < off * 0.5) score += 10;
    else if (def > off) score -= 15;
  }

  if (province.updated_at) {
    const ageDays = (Date.now() - new Date(province.updated_at)) / (1000 * 60 * 60 * 24);
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
  if (!value || !max) return <div className="intel-bar-bg"><div className="intel-bar-fill" style={{ width: "0%", background: color }} /></div>;
  const pct = Math.min((parseFloat(value) / max) * 100, 100);
  return (
    <div className="intel-bar-bg">
      <div className="intel-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function nwColor(nw, myNw) {
  if (!nw || !myNw) return "#94a3b8";
  const ratio = parseFloat(nw) / parseFloat(myNw);
  if (ratio > 1.1) return "#f87171";
  if (ratio > 0.9) return "#facc15";
  return "#4ade80";
}

export default function IntelPanel() {
  const [provinces, setProvinces] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("score");
  const [myNw, setMyNw] = useState(null);

  useEffect(() => {
    fetchProvinces();
    const interval = setInterval(fetchProvinces, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchProvinces() {
    const { data } = await supabase
      .from("provinces")
      .select("*")
      .order("updated_at", { ascending: false });

    if (data) {
      setProvinces(data);
      const me = data.find(p => p.name === "Sumi Gaeshi");
      if (me?.nw) setMyNw(parseNW(me.nw));
    }
    setLoading(false);
  }

  const scored = provinces.map(p => ({
    ...p,
    _score: scoreTarget(p, myNw),
    _nwNum: parseNW(p.nw)
  }));

  const filtered = scored
    .filter(p =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.race?.toLowerCase().includes(search.toLowerCase()) ||
      p.combo?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "score") return b._score - a._score;
      if (sortBy === "nw") return b._nwNum - a._nwNum;
      if (sortBy === "acres") return parseNW(b.acres) - parseNW(a.acres);
      if (sortBy === "def") return parseNW(b.def) - parseNW(a.def);
      return 0;
    });

  const maxNw = Math.max(...provinces.map(p => parseNW(p.nw)));

  if (loading) return <div className="loading">⏳ Loading Intel...</div>;

  return (
    <div className="intel-panel">
      <div className="intel-controls">
        <input
          className="intel-search"
          placeholder="🔍 Search province, race, combo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="intel-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="score">Sort: Target Score</option>
          <option value="nw">Sort: NW</option>
          <option value="acres">Sort: Acres</option>
          <option value="def">Sort: Defense</option>
        </select>
      </div>

      <div className="panel">
        <h2>🏰 Province Intel ({filtered.length})</h2>
        <div className="province-list">
          {filtered.map(p => {
            const color = nwColor(p._nwNum, myNw);
            const { grade, color: gradeColor } = gradeScore(p._score);
            return (
              <div
                key={p.id}
                className={`province-row ${selected?.id === p.id ? "selected" : ""}`}
                onClick={() => setSelected(selected?.id === p.id ? null : p)}
              >
                <div className="province-main">
                  <span className="province-name" style={{ color }}>{p.name}</span>
                  <span className="province-combo">{p.combo || p.race || "?"}</span>
                  <span className="province-nw">{p.nw ? `${p.nw} NW` : "No intel"}</span>
                  <span className="target-grade" style={{ color: gradeColor, border: `1px solid ${gradeColor}` }}>
                    {grade}
                  </span>
                </div>
                <IntelBar value={p._nwNum} max={maxNw} color={color} />

                {selected?.id === p.id && (
                  <div className="province-detail">
                    <div className="detail-grid">
                      {FIELDS.map(f => p[f.key] ? (
                        <div key={f.key} className="detail-item">
                          <span className="detail-label">{f.label}</span>
                          <strong className="detail-value">{p[f.key]}</strong>
                        </div>
                      ) : null)}
                    </div>
                    <div className="detail-item" style={{ marginBottom: 12, textAlign: "center" }}>
                      <span className="detail-label">Target Score</span>
                      <strong className="detail-value" style={{ color: gradeColor, fontSize: 28 }}>
                        {grade} ({p._score})
                      </strong>
                    </div>
                    {p.good_spells && <div className="spell-row"><span className="spell-label">✨ Spells:</span><span className="spell-value">{p.good_spells}</span></div>}
                    {p.bad_spells && <div className="spell-row bad"><span className="spell-label">💀 Enemy Spells:</span><span className="spell-value">{p.bad_spells}</span></div>}
                    {p.map && <div className="spell-row"><span className="spell-label">🗺️ MAP:</span><span className="spell-value">{p.map}</span></div>}
                    {p.notes && <div className="spell-row"><span className="spell-label">📝 Notes:</span><span className="spell-value">{p.notes}</span></div>}
                    <div className="detail-meta">
                      Last updated: {p.updated_at ? new Date(p.updated_at).toUTCString().slice(0, 25) : "Unknown"}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Provinces Tracked</span>
          <strong className="stat-value" style={{ color: "#38bdf8" }}>{provinces.length}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">With Full Intel</span>
          <strong className="stat-value" style={{ color: "#4ade80" }}>
            {provinces.filter(p => p.off && p.def).length}
          </strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">S/A Targets</span>
          <strong className="stat-value" style={{ color: "#4ade80" }}>
            {scored.filter(p => p._score >= 50).length}
          </strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Highest NW</span>
          <strong className="stat-value" style={{ color: "#f87171" }}>
            {maxNw ? maxNw.toLocaleString() : 0}
          </strong>
        </div>
      </div>
    </div>
  );
}
