import { useEffect, useState } from "react";
import { getProvinceAttackStatus } from "../services/attackService";

function StatCard({ label, value, color = "#38bdf8" }) {
  return (
    <div className="modal-stat">
      <span className="modal-stat-label">{label}</span>
      <strong className="modal-stat-value" style={{ color }}>{value || "—"}</strong>
    </div>
  );
}

function ProvinceModal({ province, onClose }) {
  const [tab, setTab] = useState("overview");
  const [lastAttack, setLastAttack] = useState(null);

  useEffect(() => {
    async function checkAttack() {
      const attack = await getProvinceAttackStatus(province.name);
      setLastAttack(attack);
    }
    checkAttack();
  }, [province]);

  if (!province) return null;

  const buildings = province.buildings || {};
  const science = province.science || {};

  const BUILDING_ICONS = {
    farms: "🌾", banks: "🏦", guilds: "🔮", towers: "🗼",
    forts: "🛡️", homes: "🏠", mills: "⚙️", hospitals: "🏥",
    castles: "🏰", stables: "🐴", dungeons: "⛓️", libraries: "📚",
    armouries: "⚔️", training_grounds: "🎯", military_barracks: "🪖",
    "thieves'_dens": "🗡️", watch_towers: "👁️", barren_land: "🏜️"
  };

  const SCIENCE_ICONS = {
    alchemy: "⚗️", tools: "🔧", housing: "🏠", production: "🌾",
    bookkeeping: "📒", artisan: "🎨", strategy: "🗺️", siege: "🏹",
    tactics: "⚔️", valor: "🛡️", heroism: "💪", resilience: "❤️",
    crime: "🗡️", channeling: "🔮", shielding: "🛡️", cunning: "🧠",
    sorcery: "✨", finesse: "🎯"
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">🏰 {province.name}</h2>
            <p className="modal-sub">
              {province.race || "?"} • {province.personality || "Unknown"}
              {province.game_type && <span style={{ color: "#475569", marginLeft: 8 }}>[{province.game_type.toUpperCase()}]</span>}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#facc15", fontSize: 13, fontWeight: 600 }}>👑 {province.ruler || "Unknown"}</div>
            <div style={{ color: province.intel_age === "0" ? "#4ade80" : "#facc15", fontSize: 12, marginTop: 4 }}>
              {province.intel_age === "0" ? "🟢 Intel: Fresh" : `🟡 Intel Age: ${province.intel_age}`}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="tab-bar" style={{ marginBottom: 16 }}>
          {["overview", "military", "science", "buildings"].map(t => (
            <button
              key={t}
              className={`tab-btn ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
              style={{ padding: "6px 14px", fontSize: 12 }}
            >
              {t === "overview" ? "📋 Overview" :
               t === "military" ? "⚔️ Military" :
               t === "science" ? "🔬 Science" : "🏗️ Buildings"}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === "overview" && (
          <div>
            <div className="modal-stats">
              <StatCard label="NW" value={Number(province.nw || 0).toLocaleString()} color="#38bdf8" />
              <StatCard label="Acres" value={Number(province.acres || 0).toLocaleString()} color="#4ade80" />
              <StatCard label="Offense" value={Number(province.off || 0).toLocaleString()} color="#f87171" />
              <StatCard label="Defense" value={Number(province.def || 0).toLocaleString()} color="#fb923c" />
              <StatCard label="BE%" value={province.be ? `${province.be}%` : "—"} color="#facc15" />
              <StatCard label="Wages%" value={province.wages ? `${province.wages}%` : "—"} color="#38bdf8" />
              <StatCard label="Stealth" value={province.stlth} color="#a78bfa" />
              <StatCard label="Mana%" value={province.mana ? `${province.mana}%` : "—"} color="#a78bfa" />
            </div>
            {province.good_spells && (
              <div className="modal-row">
                <span className="modal-row-label">✨ Spells:</span>
                <span className="modal-row-value">{province.good_spells}</span>
              </div>
            )}
            {province.map && (
              <div className="modal-row">
                <span className="modal-row-label">🗺️ MAP:</span>
                <span className="modal-row-value">{province.map}</span>
              </div>
            )}
            {lastAttack && (
              <div className="modal-row" style={{ borderLeftColor: "#f87171" }}>
                <span className="modal-row-label">🔴 Last Hit:</span>
                <span className="modal-row-value">{new Date(lastAttack.created_at).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Military Tab */}
        {tab === "military" && (
          <div className="modal-stats">
            <StatCard label="Offense" value={Number(province.off || 0).toLocaleString()} color="#f87171" />
            <StatCard label="Defense" value={Number(province.def || 0).toLocaleString()} color="#fb923c" />
            <StatCard label="Soldiers" value={province.soldiers || "0"} color="#94a3b8" />
            <StatCard label="Off Specs" value={province.off_specs || "0"} color="#38bdf8" />
            <StatCard label="Def Specs" value={province.def_specs || "0"} color="#fb923c" />
            <StatCard label="Elites" value={province.elites || "0"} color="#facc15" />
            <StatCard label="Thieves" value={province.thieves || "0"} color="#a78bfa" />
            <StatCard label="Wizards" value={province.wizards || "0"} color="#a78bfa" />
            <StatCard label="War Horses" value={province.war_horses || "0"} color="#94a3b8" />
            <StatCard label="Prisoners" value={province.prisoners || "0"} color="#f87171" />
            <StatCard label="Generals" value={province.generals || "—"} color="#facc15" />
            <StatCard label="OME" value={province.ome ? `${province.ome}%` : "—"} color="#4ade80" />
          </div>
        )}

        {/* Science Tab */}
        {tab === "science" && (
          <div>
            {Object.keys(science).length === 0 ? (
              <p className="empty">No science data — paste science page via /utopia intel</p>
            ) : (
              <div className="modal-stats">
                {Object.entries(science).map(([key, val]) => (
                  parseInt(val) > 0 && (
                    <StatCard
                      key={key}
                      label={`${SCIENCE_ICONS[key] || "🔬"} ${key}`}
                      value={Number(val).toLocaleString()}
                      color="#38bdf8"
                    />
                  )
                ))}
              </div>
            )}
          </div>
        )}

        {/* Buildings Tab */}
        {tab === "buildings" && (
          <div>
            {Object.keys(buildings).length === 0 ? (
              <p className="empty">No building data — paste buildings page via /utopia intel</p>
            ) : (
              <div className="modal-stats">
                {Object.entries(buildings)
                  .filter(([, data]) => parseInt(data.qty) > 0)
                  .map(([name, data]) => (
                    <StatCard
                      key={name}
                      label={`${BUILDING_ICONS[name] || "🏗️"} ${name.replaceAll("_", " ")}`}
                      value={`${Number(data.qty).toLocaleString()} (${data.pct}%)`}
                      color="#38bdf8"
                    />
                  ))}
              </div>
            )}
            {Object.keys(buildings).length > 0 && (
              <div style={{ marginTop: 12, color: "#475569", fontSize: 11, textAlign: "center" }}>
                Only showing buildings with qty &gt; 0
              </div>
            )}
          </div>
        )}

        <div className="modal-footer">
          Last updated: {province.updated_at ? new Date(province.updated_at).toUTCString().slice(0, 25) : "Unknown"}
        </div>
      </div>
    </div>
  );
}

export default ProvinceModal;
