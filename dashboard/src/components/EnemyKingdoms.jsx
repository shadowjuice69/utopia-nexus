import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const MY_KD = "6:9";

export default function EnemyKingdoms() {
  const [kingdoms, setKingdoms] = useState([]);
  const [selected, setSelected] = useState(null);
  const [provinces, setProvinces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("kingdoms")
        .select("*")
        .neq("kd_id", MY_KD)
        .order("nw_rank", { ascending: true });
      console.log("[ENEMY KD]", data, error);
      setKingdoms(data || []);
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function loadProvinces(kdId) {
    setSelected(kdId);
    const { data } = await supabase
      .from("provinces")
      .select("name, race, acres, nw, nwpa, off, def, nobility, gains")
      .eq("kd_code", kdId)
      .order("nw", { ascending: false });
    setProvinces(data || []);
  }

  const fmt = n => n ? parseInt(n).toLocaleString() : "—";

  if (loading) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Loading enemy kingdoms...</div></div>;
  if (!kingdoms.length) return (
    <div className="empty">
      <div className="empty-icon">🏰</div>
      <div className="empty-text">No enemy kingdoms scraped yet.<br/>Use the Nexus Cycler on a kingdom page to start.</div>
    </div>
  );

  const selectedKd = kingdoms.find(k => k.kd_id === selected);

  return (
    <div>
      <div className="card">
        <div className="card-title">Enemy Kingdoms ({kingdoms.length})</div>
        <div style={{ overflowX: "auto" }}>
          <table className="nexus-table">
            <thead>
              <tr>
                <th>Kingdom</th>
                <th>KD</th>
                <th>NW Rank</th>
                <th>Total NW</th>
                <th>Total Land</th>
                <th>Provinces</th>
                <th>Stance</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {kingdoms.map((k, i) => (
                <tr key={i} style={{ cursor: "pointer" }} onClick={() => loadProvinces(k.kd_id)}>
                  <td className="gold">{k.kd_name || "—"}</td>
                  <td style={{ color: "var(--text2)", fontFamily: "var(--font-mono)" }}>{k.kd_id}</td>
                  <td className="blue">{k.nw_rank || "—"}</td>
                  <td className="gold">{fmt(k.total_nw)}</td>
                  <td className="green">{fmt(k.total_land)}</td>
                  <td>{k.total_provinces || "—"}</td>
                  <td>
                    <span className={`badge ${k.stance === "War" ? "badge-red" : k.stance === "Normal" ? "badge-grey" : "badge-gold"}`}>
                      {k.stance || "—"}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-blue" style={{ cursor: "pointer" }}>
                      View →
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="card">
          <div className="card-title">
            {selectedKd?.kd_name} ({selected}) — Province Detail
          </div>
          {provinces.length === 0 ? (
            <div className="empty">
              <div className="empty-text">No province data scraped for this kingdom yet</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="nexus-table">
                <thead>
                  <tr>
                    <th>Province</th>
                    <th>Race</th>
                    <th>Acres</th>
                    <th>Net Worth</th>
                    <th>NWPA</th>
                    <th>Offense</th>
                    <th>Defense</th>
                    <th>Nobility</th>
                    <th>Gains</th>
                  </tr>
                </thead>
                <tbody>
                  {provinces.map((p, i) => (
                    <tr key={i}>
                      <td className="gold">{p.name}</td>
                      <td>{p.race || "—"}</td>
                      <td>{fmt(p.acres)}</td>
                      <td className="gold">{fmt(p.nw)}</td>
                      <td>{p.nwpa || "—"}</td>
                      <td className="red">{fmt(p.off)}</td>
                      <td className="purple">{fmt(p.def)}</td>
                      <td>{p.nobility || "—"}</td>
                      <td className="green">{p.gains || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
