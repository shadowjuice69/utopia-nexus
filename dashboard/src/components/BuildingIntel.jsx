import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
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

  useEffect(() => {
    fetchProvinces();
  }, []);

  async function fetchProvinces() {
    const { data } = await supabase
      .from("intel_buildings")
      .select("*")
      .order("updated_at", { ascending: false });
    setProvinces(data || []);
    setLoading(false);
  }

  if (loading) return <div className="loading">⏳ Loading Buildings...</div>;

  if (provinces.length === 0) {
    return (
      <div className="panel">
        <h2>🏗️ Building Intelligence</h2>
        <p className="empty">No building data yet. Use /utopia intel and paste a buildings page.</p>
      </div>
    );
  }

  return (
    <div className="intel-panel">
      {selected && <ProvinceModal province={selected} onClose={() => setSelected(null)} />}

      <div className="panel">
        <h2>🏗️ Building Intelligence ({provinces.length})</h2>
        <div className="province-list">
          {provinces.map(p => {
            const buildings = p.buildings || {};
            const activeBlds = Object.entries(buildings).filter(([, d]) => parseInt(d.qty) > 0);
            return (
              <div
                key={p.id}
                className="province-row"
                onClick={() => setSelected({ ...p, name: p.province })}
              >
                <div className="province-main">
                  <span className="province-name" style={{ color: "#38bdf8" }}>{p.province}</span>
                  <span className="province-combo" style={{color:"#64748b",fontSize:12,marginLeft:8}}>{p.kd_code}</span>
                  <span className="province-nw" style={{color:"#64748b",fontSize:12,marginLeft:8}}>Updated {new Date(p.updated_at).toLocaleDateString()}</span>
                </div>

                {/* Building bar preview */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {activeBlds.map(([name, data]) => (
                    <div key={name} style={{
                      background: "rgba(56,189,248,0.1)",
                      border: "1px solid rgba(56,189,248,0.2)",
                      borderRadius: 6,
                      padding: "2px 8px",
                      fontSize: 12,
                      color: "#94a3b8"
                    }}>
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
