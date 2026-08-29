import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function fmt(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString();
}

function AttackTypeBadge({ type, direction }) {
  const isIncoming = direction === "incoming";
  const color = isIncoming ? "#ef4444" : "#4ade80";
  const label = isIncoming ? `⬇ ${type || "incoming"}` : `⬆ ${type || "outgoing"}`;
  return (
    <span style={{
      fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 600,
      background: `${color}18`, color, border: `1px solid ${color}33`,
    }}>
      {label}
    </span>
  );
}

export default function WarRoom() {
  const [attacks, setAttacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | outgoing | incoming
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchAttacks();
    const iv = setInterval(fetchAttacks, 20000);
    return () => clearInterval(iv);
  }, [limit]);

  async function fetchAttacks() {
    const { data } = await supabase
      .from("intel7_events")
      .select("*")
      .eq("event_type", "attack")
      .order("timestamp", { ascending: false })
      .limit(limit);
    setAttacks(data || []);
    setLoading(false);
  }

  const displayed = attacks.filter(a => {
    const data = a.data || {};
    if (filter === "outgoing" && data.direction !== "outgoing") return false;
    if (filter === "incoming" && data.direction !== "incoming") return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (a.attacker_province || "").toLowerCase().includes(q) ||
        (a.target_province || "").toLowerCase().includes(q) ||
        (a.target_kingdom || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // War stats
  const outgoing = attacks.filter(a => (a.data || {}).direction === "outgoing");
  const incoming = attacks.filter(a => (a.data || {}).direction === "incoming");
  const last24h = attacks.filter(a => Date.now() - new Date(a.timestamp) < 86400000);
  const totalAcresGained = outgoing.reduce((sum, a) => sum + ((a.data || {}).acresCaptured || 0), 0);
  const totalAcresLost = incoming.filter(a => a.success !== false).reduce((sum, a) => sum + ((a.data || {}).acresCaptured || 0), 0);
  const totalKills = outgoing.reduce((sum, a) => sum + ((a.data || {}).kills || 0), 0);
  const totalImprisoned = outgoing.reduce((sum, a) => sum + ((a.data || {}).imprisoned || 0), 0);

  // Province hit counts for leaderboard
  const hitCounts = outgoing.reduce((acc, a) => {
    const p = a.attacker_province || "Unknown";
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});
  const topHitters = Object.entries(hitCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Target breakdown
  const targetCounts = outgoing.reduce((acc, a) => {
    const t = a.target_province || "Unknown";
    if (!acc[t]) acc[t] = { hits: 0, acres: 0 };
    acc[t].hits++;
    acc[t].acres += (a.data || {}).acresCaptured || 0;
    return acc;
  }, {});
  const topTargets = Object.entries(targetCounts).sort((a, b) => b[1].acres - a[1].acres).slice(0, 5);

  if (loading) return <div className="loading">⏳ Loading War Room...</div>;

  return (
    <div className="intel-panel">

      {/* War Summary Stats */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 14px 0" }}>⚔️ War Room</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
          {[
            { label: "OUTGOING", value: outgoing.length, color: "#4ade80" },
            { label: "INCOMING", value: incoming.length, color: "#ef4444" },
            { label: "ACRES GAINED", value: fmt(totalAcresGained), color: "#4ade80" },
            { label: "ACRES LOST", value: fmt(totalAcresLost), color: "#ef4444" },
            { label: "NET ACRES", value: (totalAcresGained - totalAcresLost >= 0 ? "+" : "") + fmt(totalAcresGained - totalAcresLost), color: totalAcresGained >= totalAcresLost ? "#4ade80" : "#ef4444" },
            { label: "KILLS", value: fmt(totalKills), color: "#f59e0b" },
            { label: "IMPRISONED", value: fmt(totalImprisoned), color: "#a78bfa" },
            { label: "HITS (24H)", value: last24h.length, color: "#38bdf8" },
          ].map(s => (
            <div key={s.label} style={{ background: `${s.color}18`, border: `1px solid ${s.color}33`, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>{s.label}</div>
              <div style={{ color: s.color, fontSize: 18, fontWeight: 700 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Hitters + Top Targets */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div className="panel">
          <h3 style={{ margin: "0 0 10px 0", fontSize: 14, color: "#94a3b8" }}>⚔️ Top Hitters</h3>
          {topHitters.length === 0 ? <p style={{ color: "#475569", fontSize: 12 }}>No data</p> : (
            topHitters.map(([name, count]) => (
              <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13 }}>
                <span style={{ color: "#e2e8f0" }}>{name}</span>
                <span style={{ color: "#4ade80", fontWeight: 600 }}>{count} hits</span>
              </div>
            ))
          )}
        </div>
        <div className="panel">
          <h3 style={{ margin: "0 0 10px 0", fontSize: 14, color: "#94a3b8" }}>🎯 Top Targets</h3>
          {topTargets.length === 0 ? <p style={{ color: "#475569", fontSize: 12 }}>No data</p> : (
            topTargets.map(([name, stats]) => (
              <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13 }}>
                <span style={{ color: "#38bdf8" }}>{name}</span>
                <span style={{ color: "#f59e0b" }}>{stats.hits}x · +{fmt(stats.acres)} ac</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Attack Feed */}
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>📋 Attack Log</h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { key: "all", label: "All" },
              { key: "outgoing", label: "⬆ Outgoing" },
              { key: "incoming", label: "⬇ Incoming" },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: "4px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12,
                border: `1px solid ${filter === f.key ? "#6366f1" : "rgba(255,255,255,0.1)"}`,
                background: filter === f.key ? "rgba(99,102,241,0.15)" : "transparent",
                color: filter === f.key ? "#a5b4fc" : "#94a3b8",
              }}>
                {f.label}
              </button>
            ))}
            <input
              placeholder="🔍 Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                minWidth: 140, background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
                padding: "4px 10px", color: "#e2e8f0", fontSize: 12,
              }}
            />
          </div>
        </div>

        {displayed.length === 0 ? (
          <p style={{ color: "#475569", textAlign: "center", padding: 24 }}>No attacks recorded.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {displayed.slice(0, limit).map(atk => {
              const data = atk.data || {};
              const isIncoming = data.direction === "incoming";
              const failed = atk.success === false;
              const accentColor = failed ? "#ef4444" : isIncoming ? "#ef4444" : "#4ade80";

              return (
                <div key={atk.id} style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${isIncoming ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.06)"}`,
                  borderLeft: `3px solid ${accentColor}`,
                  borderRadius: 8, padding: "8px 12px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <AttackTypeBadge type={data.attackType} direction={data.direction} />
                      {failed && <span style={{ color: "#ef4444", fontSize: 11 }}>REPELLED</span>}
                    </div>
                    <span style={{ color: "#475569", fontSize: 11 }}>{timeAgo(atk.timestamp)}</span>
                  </div>

                  <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{atk.attacker_province || "?"}</span>
                    <span style={{ color: "#374151", margin: "0 6px" }}>→</span>
                    <span style={{ color: "#38bdf8" }}>{atk.target_province || "?"}</span>
                    {atk.target_kingdom && <span style={{ color: "#374151", fontSize: 11, marginLeft: 4 }}>({atk.target_kingdom})</span>}
                  </div>

                  {/* Stats row */}
                  <div style={{ display: "flex", gap: 12, fontSize: 11, flexWrap: "wrap" }}>
                    {data.acresCaptured != null && (
                      <span style={{ color: isIncoming ? "#ef4444" : "#4ade80", fontWeight: 600 }}>
                        {isIncoming ? "-" : "+"}{fmt(data.acresCaptured)} ac
                      </span>
                    )}
                    {data.kills != null && <span style={{ color: "#f59e0b" }}>⚔ {fmt(data.kills)} kills</span>}
                    {data.imprisoned != null && <span style={{ color: "#a78bfa" }}>⛓ {fmt(data.imprisoned)} imprisoned</span>}
                    {data.credits != null && <span style={{ color: "#facc15" }}>🎖 {fmt(data.credits)} credits</span>}
                    {data.returnDays != null && <span style={{ color: "#94a3b8" }}>↩ {data.returnDays}d return</span>}
                    {data.enemyDefense != null && <span style={{ color: "#475569" }}>def: {fmt(data.enemyDefense)}</span>}
                    {data.peasantsKilled != null && <span style={{ color: "#ef4444" }}>💀 {fmt(data.peasantsKilled)} pop killed</span>}
                  </div>

                  {/* Losses */}
                  {data.losses && Object.keys(data.losses).length > 0 && (
                    <div style={{ marginTop: 4, fontSize: 11, color: "#ef4444" }}>
                      Lost: {Object.entries(data.losses).map(([k, v]) => `${fmt(v)} ${k}`).join(", ")}
                    </div>
                  )}
                </div>
              );
            })}

            {attacks.length >= limit && (
              <button onClick={() => setLimit(l => l + 50)} style={{
                marginTop: 8, padding: "8px 16px", background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.3)", borderRadius: 6,
                color: "#6366f1", cursor: "pointer", fontSize: 13,
              }}>
                Load more
              </button>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
