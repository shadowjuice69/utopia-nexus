import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const MY_KD = "3:2";

export default function WarRoom() {
  const [war, setWar] = useState(null);
  const [threats, setThreats] = useState([]);
  const [recentAttacks, setRecentAttacks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: wars }, { data: attacks }, { data: hostile }] = await Promise.all([
        supabase.from("wars").select("*").order("created_at", { ascending: false }).limit(1),
        supabase.from("attacks").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("hostile_ops").select("*").order("created_at", { ascending: false }).limit(10),
      ]);
      setWar(wars?.[0] || null);
      setRecentAttacks(attacks || []);
      setThreats(hostile || []);
      setLoading(false);
    }
    load();
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
  }, [supabase]);

  const fmt = n => n ? parseInt(n).toLocaleString() : "—";

  if (loading) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Loading war room...</div></div>;

  return (
    <div>
      {war && (
        <div className="card" style={{ borderColor: "rgba(248,113,113,0.3)" }}>
          <div className="card-title" style={{ color: "var(--red)" }}>⚔ Active War</div>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Enemy</div>
              <div className="stat-value red" style={{ fontSize: 16 }}>{war.enemy_kd_name || war.enemy_kd || "—"}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Acres Gained</div>
              <div className="stat-value green">{fmt(war.acres_gained)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Acres Lost</div>
              <div className="stat-value red">{fmt(war.acres_lost)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Net</div>
              <div className={`stat-value ${(war.acres_gained || 0) - (war.acres_lost || 0) >= 0 ? "green" : "red"}`}>
                {(war.acres_gained || 0) - (war.acres_lost || 0) >= 0 ? "+" : ""}
                {fmt((war.acres_gained || 0) - (war.acres_lost || 0))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="card-title">Recent Attacks</div>
          {recentAttacks.length === 0 ? (
            <div className="empty"><div className="empty-text">No attacks logged</div></div>
          ) : (
            <table className="nexus-table">
              <thead><tr><th>Attacker</th><th>Target</th><th>Acres</th><th>Type</th></tr></thead>
              <tbody>
                {recentAttacks.map((a, i) => (
                  <tr key={i}>
                    <td className="gold">{a.attacker}</td>
                    <td>{a.defender}</td>
                    <td className="green">{a.acres_captured || "—"}</td>
                    <td>
                      <span className={`badge ${a.attack_type === "incoming" ? "badge-red" : "badge-green"}`}>
                        {a.attack_type || "out"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-title">Hostile Ops</div>
          {threats.length === 0 ? (
            <div className="empty"><div className="empty-text">No hostile ops detected</div></div>
          ) : (
            <table className="nexus-table">
              <thead><tr><th>From</th><th>Target</th><th>Op</th><th>Result</th></tr></thead>
              <tbody>
                {threats.map((t, i) => (
                  <tr key={i}>
                    <td className="red">{t.attacker}</td>
                    <td>{t.target}</td>
                    <td>{t.op_type}</td>
                    <td style={{ color: "var(--text2)", fontSize: 12 }}>{t.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
