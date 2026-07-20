import { useEffect, useState } from "react";
import { getProvinceAttackStatus } from "../services/attackService";

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

  return (
    <div className="modal">
      <div className="modal-content">
        <button onClick={onClose}>✖ Close</button>

        <div className="province-header">
          <h2>🏰 {province.name}</h2>

          <p>
            👑 {province.ruler || "Unknown Ruler"}
          </p>

          <p>
            {province.race || "Unknown Race"} • {province.personality || "Unknown Personality"}
          </p>

          <p>
            NW: {Number(province.nw || 0).toLocaleString()}
            {" | "}
            Acres: {Number(province.acres || 0).toLocaleString()}
          </p>

          <p>
            🌎 {province.game_type || "Unknown"}
          </p>

          <p>
            {Number(province.intel_age) === 0
              ? "🟢 Intel: Fresh"
              : `🟡 Intel Age: ${province.intel_age}`}
          </p>

          <p>
            ⚔️ Target: {province.ops_status || "Available"}
          </p>

          {lastAttack && (
            <p>
              🔴 Last Hit: {new Date(lastAttack.created_at).toLocaleString()}
            </p>
          )}
        </div>

        <div className="modal-tabs">
          <button className={tab === "overview" ? "active-tab" : ""} onClick={() => setTab("overview")}>
            📋 Overview
          </button>

          <button className={tab === "military" ? "active-tab" : ""} onClick={() => setTab("military")}>
            ⚔️ Military
          </button>

          <button className={tab === "science" ? "active-tab" : ""} onClick={() => setTab("science")}>
            🧪 Science
          </button>

          <button className={tab === "buildings" ? "active-tab" : ""} onClick={() => setTab("buildings")}>
            🏗️ Buildings
          </button>
        </div>

        {tab === "overview" && (
          <div>
            <p>Ruler: {province.ruler || "Unknown"}</p>
            <p>Race: {province.race || "Unknown"}</p>
            <p>Personality: {province.personality || "Unknown"}</p>
            <p>NW: {Number(province.nw || 0).toLocaleString()}</p>
            <p>Acres: {Number(province.acres || 0).toLocaleString()}</p>
            <p>Game: {province.game_type || "Unknown"}</p>
          </div>
        )}

        {tab === "military" && (
          <div>
            <p>Offense: {province.off || 0}</p>
            <p>Defense: {province.def || 0}</p>
            <p>Soldiers: {province.soldiers || 0}</p>
            <p>Off Specs: {province.off_specs || 0}</p>
            <p>Def Specs: {province.def_specs || 0}</p>
            <p>Elites: {province.elites || 0}</p>
            <p>Thieves: {province.thieves || 0}</p>
            <p>Wizards: {province.wizards || 0}</p>
          </div>
        )}

        {tab === "science" && (
          <pre>
            {JSON.stringify(province.science, null, 2)}
          </pre>
        )}

        {tab === "buildings" && (
          <div>
            {province.buildings &&
              Object.entries(province.buildings).map(([name, data]) => (
                <div key={name}>
                  {name.replaceAll("_", " ")}: {data.qty} ({data.pct}%)
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProvinceModal;
