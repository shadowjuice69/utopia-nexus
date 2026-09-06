import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { loadNexusConfig, getNexusConfig } from "../services/nexusConfig";
import ProvinceModal from "./ProvinceModal";

const CATEGORY_CONFIG = {
  military: {
    title: "⚔️ Military Intelligence",
    emptyMsg: "No military data for this kingdom yet. Load the Military page on the Utopia Intel Site and tap KD Military."
  },
  science: {
    title: "🔬 Science Intelligence",
    emptyMsg: "No science data for this kingdom yet. Load the Science page on the Utopia Intel Site and tap KD Science."
  },
  gains: {
    title: "📈 Gains Intelligence",
    emptyMsg: "No gains data for this kingdom yet. Load the Gains page on the Utopia Intel Site and tap KD Gains."
  }
};

export default function KDStatsIntel({ category }) {
  const config = CATEGORY_CONFIG[category] || { title: category, emptyMsg: "No data yet." };
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kd, setKd] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchRows() {
      try {
        const cfg = await loadNexusConfig();
        const currentKd = cfg?.kd || getNexusConfig().kd || "";
        if (!currentKd) throw new Error("Kingdom context is unavailable.");
        const { data, error: queryError } = await supabase
          .from("intel_kd_stats")
          .select("*")
          .eq("kd_code", currentKd)
          .eq("category", category)
          .order("updated_at", { ascending: false });
        if (cancelled) return;
        if (queryError) throw queryError;
        setKd(currentKd);
        setRows(data || []);
        setError("");
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setError(e?.message || `Unable to load ${category} intelligence.`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRows();
    const iv = setInterval(fetchRows, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [category]);

  if (loading) return <div className="loading">⏳ Loading {config.title}...</div>;
  if (error) return <div className="panel"><h2>{config.title}</h2><p className="empty">{error}</p></div>;

  if (rows.length === 0) {
    return (
      <div className="panel">
        <h2>{config.title} · {kd}</h2>
        <p className="empty">{config.emptyMsg}</p>
      </div>
    );
  }

  return (
    <div className="intel-panel">
      {selected && <ProvinceModal province={selected} onClose={() => setSelected(null)} />}
      <div className="panel">
        <h2>{config.title} · {kd} ({rows.length})</h2>
        <div className="province-list">
          {rows.map(r => {
            const d = r.data || {};
            let summary = [];
            if (category === "science") {
              if (d.stockedBooks) summary.push(["Stocked", d.stockedBooks]);
              if (d.allocatedBooks) summary.push(["Allocated", d.allocatedBooks]);
              summary = summary.concat(
                Object.entries(d.books || {}).map(([k, v]) => [k, `${v}%`])
              ).slice(0, 8);
            } else if (category === "gains") {
              if (d.networth) summary.push(["NW", d.networth]);
              summary = summary.concat(
                Object.entries(d.gains || {}).map(([slot, val]) => [`#${slot}`, `${val.acres}a (${val.pct}%)`])
              ).slice(0, 8);
            } else {
              summary = Object.entries(d)
                .filter(([key]) => key !== "location" && key !== "name")
                .slice(0, 6);
            }
            return (
              <div
                key={r.id}
                className="province-row"
                onClick={() => setSelected({ ...d, name: r.province, kd_code: r.kd_code, updated_at: r.updated_at })}
              >
                <div className="province-main">
                  <span className="province-name" style={{ color: "#38bdf8" }}>{r.province}</span>
                  <span className="province-combo" style={{ color: "#64748b", fontSize: 12, marginLeft: 8 }}>{r.kd_code}</span>
                  <span className="province-nw" style={{ color: "#64748b", fontSize: 12, marginLeft: 8 }}>
                    Updated {new Date(r.updated_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {summary.map(([key, val]) => (
                    <div
                      key={key}
                      style={{
                        background: "rgba(56,189,248,0.1)",
                        border: "1px solid rgba(56,189,248,0.2)",
                        borderRadius: 6,
                        padding: "2px 8px",
                        fontSize: 12,
                        color: "#94a3b8"
                      }}
                    >
                      {key}: {String(val)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function KDMilitaryIntel() { return <KDStatsIntel category="military" />; }
export function KDScienceIntel() { return <KDStatsIntel category="science" />; }
export function KDGainsIntel() { return <KDStatsIntel category="gains" />; }
