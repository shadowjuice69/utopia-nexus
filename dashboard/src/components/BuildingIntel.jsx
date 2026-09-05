import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { loadNexusConfig, getNexusConfig } from "../services/nexusConfig";
import ProvinceModal from "./ProvinceModal";

const BUILDING_ICONS = {
  farms: "🌾", banks: "🏦", guilds: "🔮", towers: "🗼",
  forts: "🛡️", homes: "🏠", mills: "⚙️", hospitals: "🏥",
  castles: "🏰", stables: "🐴", dungeons: "⛓️", libraries: "📚",
  armouries: "⚔️", training_grounds: "🎯", military_barracks: "🪖",
  "thieves'_dens": "🗡️", watch_towers: "👁️", barren_land: "🏜️"
};

export default function BuildingIntel() {
  const [provinces, setProvinces] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kd, setKd] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchProvinces() {
      try {
        const config = await loadNexusConfig();
        const currentKd = config?.kd || getNexusConfig().kd || "";
        if (!currentKd) throw new Error("Kingdom context is unavailable.");
        const { data, error: queryError } = await supabase
          .from("intel_buildings")
          .select("*")
          .eq("kd_code", currentKd)
          .order("updated_at", { ascending: false });
        if (cancelled) return;
        if (queryError) throw queryError;
        setKd(currentKd);
        setProvinces(data || []);
        setError("");
      } catch (e) {
        if (!cancelled) {
          setProvinces([]);
          setError(e?.message || "Unable to load building intelligence.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProvinces();
    const iv = setInterval(fetchProvinces, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (loading) return <div className="loading">⏳ Loading Buildings...</div>;
  if (error) return <div className="panel"><h2>🏗️ Building Intelligence</h2><p className="empty">{error}</p></div>;

  if (provinces.length === 0) {
    return (
      <div className="panel">
        <h2>🏗️ Building Intelligence · {kd}</h2>
        <p className="empty">No building data for this kingdom yet. Load the Survey/Buildings page in Utopia to send a fresh snapshot.</p>
      </div>
    );
  }

  return (
    <div className="intel-panel">
      {selected && <ProvinceModal province={selected} onClose={() => setSelected(null)} />}
      <div className="panel">
        <h2>🏗️ Building Intelligence · {kd} ({provinces.length})</h2>
        <div className="province-list">
          {provinces.map(p => {
            const buildings = p.buildings || {};
            const activeBlds = Object.entries(buildings).filter(([, d]) => parseInt(d.qty, 10) > 0);
            return (
              <div key={p.id} className="province-row" onClick={() => setSelected({ ...p, name: p.province })}>
                <div className="province-main">
                  <span className="province-name" style={{ color: "#38bdf8" }}>{p.province}</span>
                  <span className="province-combo" style={{ color: "#64748b", fontSize: 12, marginLeft: 8 }}>{p.kd_code}</span>
                  <span className="province-nw" style={{ color: "#64748b", fontSize: 12, marginLeft: 8 }}>Updated {new Date(p.updated_at).toLocaleString()}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {activeBlds.map(([name, data]) => (
                    <div key={name} style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 6, padding: "2px 8px", fontSize: 12, color: "#94a3b8" }}>
                      {BUILDING_ICONS[name] || "🏗️"} {name.replaceAll("_", " ")}: {data.qty} ({data.pct}%)
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
