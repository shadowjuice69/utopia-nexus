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
];

function IntelBar({ value, max, color = "#38bdf8" }) {
  if (!value || !max) return <div className="intel-bar-bg"><div className="intel-bar-fill" style={{ width: "0%", background: color }} /></div>;
  const pct = Math.min((parseFloat(value) / max) * 100, 100);
  return (
    <div className="intel-bar-bg">
      <div className="intel-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function ThreatColor(nw, myNw) {
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
  const [sortBy, setSortBy] = useState("nw");
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
      if (me?.nw) setMyNw(parseFloat(me.nw.replace(/,/g, "")));
    }
    setLoading(false);
  }

  const filtered = provinces
    .filter(p => p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.race?.toLowerCase().includes(search.toLowerCase()) ||
      p.combo?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = parseFloat((a[sortBy] || "0").toString().replace(/,/g, "")) || 0;
      const bv = parseFloat((b[sortBy] || "0").toString().replace(/,/g, "")) || 0;
      return bv - av;
    });

  const maxNw = Math.max(...provinces.map(p => parseFloat((p.nw || "0").toString().replace(/,/g, "")) || 0));
  const maxOff = Math.max(...provinces.map(p => parseFloat(p.off || 0) || 0));

  if (loading) return <div className="loading">⏳ Loading Intel...</div>;

  return (
    <div className="intel-panel">

      {/* Search + Sort */}
      <div className="intel-controls">
        <input
          className="intel-search"
          placeholder="🔍 Search province, race, combo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="intel-sort" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="nw">Sort: NW</option>
          <option value="acres">Sort: Acres</option>
          <option value="off">Sort: Offense</option>
          <option value="def">Sort: Defense</option>
          <option value="be">Sort: BE</option>
        </select>
      </div>

      {/* Province List */}
      <div className="panel">
        <h2>🏰 Province Intel ({filtered.length})</h2>
        <div className="province-list">
          {filtered.map(p => {
            const nwNum = parseFloat((p.nw || "0").toString().replace(/,/g, "")) || 0;
            const color = ThreatColor(nwNum, myNw);
            return (
              <div
                key={p.id}
                className={`province-row ${selected?.id === p.id ? "selected" : ""}`}
                onClick={() => setSelected(selected?.id === p.id ? null : p)}
              >
                <div className="province-main">
                  <span className="province-name" style={{ color }}>{p.name}</span>
                  <span className="province-combo">{p.combo || `${p.race || "?"}`}</span>
                  <span className="province-nw">{p.nw ? `${p.nw} NW` : "No intel"}</span>
                  <span className="province-acres">{p.acres ? `${p.acres} acres` : ""}</span>
                </div>
                <IntelBar value={nwNum} max={maxNw} color={color} />

                {/* Expanded Detail */}
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
                    {p.good_spells && (
                      <div className="spell-row">
                        <span className="spell-label">✨ Spells:</span>
                        <span className="spell-value">{p.good_spells}</span>
                      </div>
                    )}
                    {p.bad_spells && (
                      <div className="spell-row bad">
                        <span className="spell-label">💀 Enemy Spells:</span>
                        <span className="spell-value">{p.bad_spells}</span>
                      </div>
                    )}
                    {p.map && (
                      <div className="spell-row">
                        <span className="spell-label">🗺️ MAP:</span>
                        <span className="spell-value">{p.map}</span>
                      </div>
                    )}
                    {p.notes && (
                      <div className="spell-row">
                        <span className="spell-label">📝 Notes:</span>
                        <span className="spell-value">{p.notes}</span>
                      </div>
                    )}
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

      {/* Summary Stats */}
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
          <span className="stat-label">Avg NW</span>
          <strong className="stat-value" style={{ color: "#facc15" }}>
            {provinces.length ? Math.round(
              provinces.reduce((s, p) => s + (parseFloat((p.nw || "0").toString().replace(/,/g, "")) || 0), 0) / provinces.length
            ).toLocaleString() : 0}
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
