import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const METRICS = [
  { key: "nw",    label: "Net Worth",  color: "#38bdf8", format: "number" },
  { key: "acres", label: "Acres",      color: "#4ade80", format: "number" },
  { key: "off",   label: "Offense",    color: "#ef4444", format: "number" },
  { key: "def",   label: "Defense",    color: "#f59e0b", format: "number" },
  { key: "be",    label: "BE%",        color: "#8b5cf6", format: "pct"    },
  { key: "o_tpa", label: "oTPA",       color: "#fb923c", format: "decimal" },
  { key: "d_tpa", label: "dTPA",       color: "#fb923c", format: "decimal" },
  { key: "o_wpa", label: "oWPA",       color: "#a78bfa", format: "decimal" },
  { key: "d_wpa", label: "dWPA",       color: "#a78bfa", format: "decimal" },
];

function parseVal(val) {
  if (val === null || val === undefined) return null;
  // Handle "8000 (8000)" format — take first number
  const str = val.toString().replace(/,/g, "").match(/[\d.]+/);
  return str ? parseFloat(str[0]) : null;
}

function fmt(val, format) {
  if (val === null || val === undefined) return "—";
  if (format === "pct") return `${val}%`;
  if (format === "decimal") return parseFloat(val).toFixed(2);
  if (format === "number") return Math.round(val).toLocaleString();
  return val;
}

function Bar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 3, height: 4, flex: 1 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s" }} />
    </div>
  );
}

const RACE_COLORS = {
  avian: "#38bdf8", darkelf: "#a78bfa", dryad: "#4ade80", dwarf: "#fb923c",
  elf: "#4ade80", faery: "#f472b6", halfling: "#fbbf24", human: "#94a3b8",
  orc: "#ef4444", undead: "#8b5cf6", gnome: "#6ee7b7",
};

export default function ProvinceComparison() {
  const [provinces, setProvinces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [metric, setMetric] = useState("nw");
  const [sortBy, setSortBy] = useState("nw");

  useEffect(() => { fetchProvinces(); }, []);

  async function fetchProvinces() {
    const { data } = await supabase
      .from("provinces")
      .select("id, name, race, personality, nw, acres, off, def, be, o_tpa, d_tpa, o_wpa, d_wpa, updated_at, kd_code")
      .order("nw", { ascending: false });
    setProvinces(data || []);
    setLoading(false);
  }

  function toggleSelect(id) {
    setSelected(prev => prev.includes(id)
      ? prev.filter(x => x !== id)
      : prev.length < 6 ? [...prev, id] : prev
    );
  }

  const displayed = provinces
    .filter(p => p.name && p.name !== "Test888")
    .sort((a, b) => (parseVal(b[sortBy]) || 0) - (parseVal(a[sortBy]) || 0));

  const comparing = selected.length > 0
    ? displayed.filter(p => selected.includes(p.id))
    : displayed;

  // Max values for bar scaling
  const maxVals = {};
  for (const m of METRICS) {
    maxVals[m.key] = Math.max(...displayed.map(p => parseVal(p[m.key]) || 0), 1);
  }

  const activeMetric = METRICS.find(m => m.key === metric);

  if (loading) return <div className="loading">⏳ Loading Provinces...</div>;
  if (provinces.length === 0) return (
    <div className="panel">
      <h2>📊 Province Comparison</h2>
      <p className="empty">No province data yet.</p>
    </div>
  );

  return (
    <div className="intel-panel">
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>📊 Province Comparison</h2>
          {selected.length > 0 && (
            <button onClick={() => setSelected([])} style={{
              padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.4)",
              background: "rgba(239,68,68,0.1)", color: "#ef4444", cursor: "pointer", fontSize: 12,
            }}>
              Clear selection ({selected.length})
            </button>
          )}
        </div>

        {/* Metric selector */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {METRICS.map(m => (
            <button key={m.key} onClick={() => { setMetric(m.key); setSortBy(m.key); }} style={{
              padding: "4px 10px", borderRadius: 6,
              border: `1px solid ${metric === m.key ? m.color : "rgba(255,255,255,0.1)"}`,
              background: metric === m.key ? `${m.color}22` : "transparent",
              color: metric === m.key ? m.color : "#94a3b8",
              cursor: "pointer", fontSize: 11,
            }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Province bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {comparing.map(p => {
            const val = parseVal(p[metric]);
            const race = (p.race || "").toLowerCase();
            const raceColor = RACE_COLORS[race] || "#94a3b8";
            const isSelected = selected.includes(p.id);
            return (
              <div key={p.id}
                onClick={() => toggleSelect(p.id)}
                style={{
                  background: isSelected ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isSelected ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 8, padding: "10px 14px", cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                    <span style={{ color: raceColor, fontSize: 11, marginLeft: 8 }}>{p.race || "?"}</span>
                    {p.personality && <span style={{ color: "#475569", fontSize: 11, marginLeft: 6 }}>{p.personality}</span>}
                    {p.kd_code && <span style={{ color: "#374151", fontSize: 10, marginLeft: 6 }}>({p.kd_code})</span>}
                  </div>
                  <span style={{ color: activeMetric.color, fontWeight: 700, fontSize: 15, minWidth: 80, textAlign: "right" }}>
                    {fmt(val, activeMetric.format)}
                  </span>
                </div>
                <Bar value={val || 0} max={maxVals[metric]} color={activeMetric.color} />
              </div>
            );
          })}
        </div>

        {/* Side-by-side table for selected */}
        {selected.length > 1 && (
          <div style={{ overflowX: "auto" }}>
            <h3 style={{ color: "#94a3b8", fontSize: 14, marginBottom: 12 }}>📋 Side-by-Side</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ color: "#475569", textAlign: "left", padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>Metric</th>
                  {comparing.map(p => (
                    <th key={p.id} style={{ color: "#38bdf8", textAlign: "right", padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map(m => (
                  <tr key={m.key} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <td style={{ color: m.color, padding: "6px 10px" }}>{m.label}</td>
                    {comparing.map(p => {
                      const val = parseVal(p[m.key]);
                      const maxVal = Math.max(...comparing.map(x => parseVal(x[m.key]) || 0));
                      const isTop = val && val === maxVal && comparing.length > 1;
                      return (
                        <td key={p.id} style={{
                          color: isTop ? m.color : "#94a3b8",
                          fontWeight: isTop ? 700 : 400,
                          textAlign: "right", padding: "6px 10px",
                        }}>
                          {fmt(val, m.format)}
                        </td>
                      );
                    })}
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
