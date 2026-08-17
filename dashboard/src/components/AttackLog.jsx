import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { getKingdomContext, isOutgoingAttack } from "../services/kingdomContext";

const ATTACK_EMOJI = {
  "traditional march": "⚔️",
  "ambush": "🎯",
  "siege": "🏰",
  "learn": "📚",
  "conquest": "🗺️",
  "massacre": "💀",
  "raze": "🔥",
  "storm": "⛈️",
  "plunder": "💰",
};

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

function StatPill({ label, value, color }) {
  if (!value || value === "0" || value === 0) return null;
  return (
    <div style={{
      background: `${color}18`, border: `1px solid ${color}40`,
      borderRadius: 5, padding: "2px 8px", fontSize: 11,
      color: color, whiteSpace: "nowrap",
    }}>
      {label}: {typeof value === "number" ? value.toLocaleString() : value}
    </div>
  );
}

export default function AttackLog() {
  const [attacks, setAttacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | outgoing | incoming
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [kingdomCode, setKingdomCode] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadContext() {
      const context = await getKingdomContext();
      if (active) setKingdomCode(context.kingdomCode);
    }

    loadContext();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;

    async function fetchAttacks() {
      const { data } = await supabase
        .from("attacks")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(limit);
      if (!active) return;
      setAttacks(data || []);
      setLoading(false);
    }

    fetchAttacks();
    const interval = setInterval(fetchAttacks, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [limit]);

  function isOutgoing(attack) {
    return isOutgoingAttack(attack, kingdomCode);
  }

  const filtered = attacks.filter(a => {
    if (filter === "outgoing" && !isOutgoing(a)) return false;
    if (filter === "incoming" && isOutgoing(a)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        a.attacker_province?.toLowerCase().includes(q) ||
        a.target_province?.toLowerCase().includes(q) ||
        a.attack_type?.toLowerCase().includes(q) ||
        a.target_kingdom?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Summary stats
  const last24h = attacks.filter(a => Date.now() - new Date(a.timestamp) < 86400000);
  const totalAcres = last24h.reduce((sum, a) => sum + (parseInt(a.acres_captured) || 0), 0);
  const totalKills = last24h.reduce((sum, a) => sum + (parseInt(a.kills) || 0), 0);
  const outgoing = last24h.filter(isOutgoing);
  const incoming = last24h.filter(a => !isOutgoing(a));

  if (loading) return <div className="loading">⏳ Loading Attack Log...</div>;

  return (
    <div className="intel-panel">
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>⚔️ Attack Log</h2>
          <span style={{ color: "#475569", fontSize: 12 }}>Auto-refreshes every 30s</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8, marginBottom: 16 }}>
          <div style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>ATTACKS (24H)</div>
            <div style={{ color: "#38bdf8", fontSize: 22, fontWeight: 700 }}>{last24h.length}</div>
          </div>
          <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>OUTGOING</div>
            <div style={{ color: "#4ade80", fontSize: 22, fontWeight: 700 }}>{outgoing.length}</div>
          </div>
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>INCOMING</div>
            <div style={{ color: "#ef4444", fontSize: 22, fontWeight: 700 }}>{incoming.length}</div>
          </div>
          <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.2)", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>ACRES (24H)</div>
            <div style={{ color: "#facc15", fontSize: 22, fontWeight: 700 }}>{totalAcres > 0 ? `+${totalAcres.toLocaleString()}` : "0"}</div>
          </div>
          <div style={{ background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>KILLS (24H)</div>
            <div style={{ color: "#fb923c", fontSize: 22, fontWeight: 700 }}>{totalKills.toLocaleString()}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {["all", "outgoing", "incoming"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "4px 12px", borderRadius: 6,
              border: `1px solid ${filter === f ? "#6366f1" : "rgba(255,255,255,0.1)"}`,
              background: filter === f ? "rgba(99,102,241,0.2)" : "transparent",
              color: filter === f ? "#6366f1" : "#94a3b8",
              cursor: "pointer", fontSize: 12, textTransform: "capitalize",
            }}>
              {f === "all" ? "All" : f === "outgoing" ? "⚔️ Outgoing" : "🛡️ Incoming"}
            </button>
          ))}
          <input
            placeholder="🔍 Search attacker, target, type..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 180, background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
              padding: "4px 10px", color: "#e2e8f0", fontSize: 12,
            }}
          />
        </div>

        {filtered.length === 0 ? (
          <p style={{ color: "#475569", textAlign: "center", padding: 32 }}>
            No attacks recorded yet. Bot will populate this as attacks come in.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map(a => {
              const out = isOutgoing(a);
              const emoji = ATTACK_EMOJI[a.attack_type?.toLowerCase()] || "⚔️";
              const borderColor = out ? "#4ade80" : "#ef4444";
              return (
                <div key={a.id} style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderLeft: `3px solid ${borderColor}`,
                  borderRadius: 8, padding: "10px 14px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 16, marginRight: 8 }}>{emoji}</span>
                      <span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{a.attack_type || "Attack"}</span>
                      <span style={{ color: "#475569", fontSize: 12, marginLeft: 8 }}>{out ? "outgoing" : "incoming"}</span>
                    </div>
                    <span style={{ color: "#475569", fontSize: 11 }}>{timeAgo(a.timestamp)}</span>
                  </div>

                  <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>
                    <span style={{ color: out ? "#4ade80" : "#ef4444" }}>{a.attacker_province || "Unknown"}</span>
                    <span style={{ color: "#475569", margin: "0 6px" }}>→</span>
                    <span style={{ color: "#38bdf8" }}>{a.target_province || "Unknown"}</span>
                    {a.target_kingdom && <span style={{ color: "#475569", fontSize: 11, marginLeft: 6 }}>({a.target_kingdom})</span>}
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <StatPill label="Acres" value={parseInt(a.acres_captured) || 0} color="#facc15" />
                    <StatPill label="Kills" value={parseInt(a.kills) || 0} color="#fb923c" />
                    <StatPill label="Prisoners" value={parseInt(a.prisoners) || 0} color="#38bdf8" />
                    <StatPill label="Books" value={parseInt(a.books_captured) || 0} color="#8b5cf6" />
                    <StatPill label="Peasants" value={parseInt(a.peasants) || 0} color="#4ade80" />
                    <StatPill label="Troops Lost" value={parseInt(a.troops_lost) || 0} color="#ef4444" />
                    <StatPill label="Off Sent" value={parseInt(a.off_sent || a.offense_sent) || 0} color="#94a3b8" />
                    <StatPill label="Buildings" value={parseInt(a.buildings_survived) || 0} color="#22c55e" />
                    <StatPill label="Credits" value={parseInt(a.training_credits) || 0} color="#eab308" />
                    <StatPill label="New Peasants" value={parseInt(a.peasants_gained) || 0} color="#4ade80" />
                    <StatPill label="Sent" value={parseInt(a.sent) || 0} color="#94a3b8" />
                  </div>
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
