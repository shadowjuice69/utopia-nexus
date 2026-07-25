import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const OP_EMOJI = {
  // Thievery
  "free prisoners": "🔓", "rob granaries": "🌾", "rob vaults": "💰",
  "rob towers": "🗼", "kidnap": "👤", "bribe thieves": "🤝",
  "bribe generals": "🎖️", "incite riots": "🔥", "arson": "🔥",
  "night strike": "🗡️", "steal war horses": "🐴", "greater arson": "💥",
  "sabotage wizards": "🧙", "assassinate wizards": "☠️", "steal horses": "🐎",
  "propaganda": "📢",
  // Spells
  "fireball": "🔥", "storms": "⛈️", "droughts": "🏜️", "tornadoes": "🌪️",
  "lightning strike": "⚡", "meteor showers": "☄️", "land lust": "🗺️",
  "nightmares": "😱", "mystic vortex": "🌀", "fools gold": "💛",
  "nightfall": "🌑", "chastity": "⛔", "sloth": "🦥", "gluttony": "🍖",
  "greed": "💸", "blizzard": "❄️", "pitfalls": "🕳️",
  "expose thieves": "👁️", "magic ward": "🛡️", "abolish ritual": "🚫",
};

const CATEGORY_COLOR = {
  thievery: "#f59e0b",
  sorcery:  "#8b5cf6",
  attack:   "#ef4444",
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

export default function OpsIntel() {
  const [ops, setOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchOps();
    const interval = setInterval(fetchOps, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  async function fetchOps() {
    const { data } = await supabase
      .from("hostile_ops")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);
    setOps(data || []);
    setLoading(false);
  }

  const filtered = ops.filter(op => {
    if (filter !== "all" && op.category !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        op.operation?.toLowerCase().includes(q) ||
        op.target_province?.toLowerCase().includes(q) ||
        op.attacker_province?.toLowerCase().includes(q) ||
        op.target_kingdom?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Summary stats
  const last24h = ops.filter(op => Date.now() - new Date(op.timestamp) < 86400000);
  const byType = last24h.reduce((acc, op) => {
    acc[op.category] = (acc[op.category] || 0) + 1;
    return acc;
  }, {});
  const byTarget = last24h.reduce((acc, op) => {
    const t = op.target_province || "Unknown";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const topTarget = Object.entries(byTarget).sort((a, b) => b[1] - a[1])[0];

  if (loading) return <div className="loading">⏳ Loading Ops Intel...</div>;

  return (
    <div className="intel-panel">
      <div className="panel">
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>🗡️ Ops Intelligence</h2>
          <span style={{ color: "#475569", fontSize: 12 }}>Auto-refreshes every 30s</span>
        </div>

        {/* 24h Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginBottom: 16 }}>
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>OPS (24H)</div>
            <div style={{ color: "#ef4444", fontSize: 22, fontWeight: 700 }}>{last24h.length}</div>
          </div>
          <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>THIEVERY</div>
            <div style={{ color: "#f59e0b", fontSize: 22, fontWeight: 700 }}>{byType.thievery || 0}</div>
          </div>
          <div style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>SORCERY</div>
            <div style={{ color: "#8b5cf6", fontSize: 22, fontWeight: 700 }}>{byType.sorcery || 0}</div>
          </div>
          <div style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>TOP TARGET</div>
            <div style={{ color: "#38bdf8", fontSize: 13, fontWeight: 700 }}>{topTarget ? `${topTarget[0]} (${topTarget[1]}x)` : "—"}</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {["all", "thievery", "sorcery", "attack"].map(cat => (
            <button key={cat} onClick={() => setFilter(cat)} style={{
              padding: "4px 12px", borderRadius: 6,
              border: `1px solid ${filter === cat ? CATEGORY_COLOR[cat] || "#6366f1" : "rgba(255,255,255,0.1)"}`,
              background: filter === cat ? `${CATEGORY_COLOR[cat] || "#6366f1"}22` : "transparent",
              color: filter === cat ? CATEGORY_COLOR[cat] || "#6366f1" : "#94a3b8",
              cursor: "pointer", fontSize: 12, textTransform: "capitalize",
            }}>
              {cat === "all" ? "All" : cat}
            </button>
          ))}
          <input
            placeholder="🔍 Search op, target, attacker..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 180, background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
              padding: "4px 10px", color: "#e2e8f0", fontSize: 12,
            }}
          />
        </div>

        {/* Ops list */}
        {filtered.length === 0 ? (
          <p style={{ color: "#475569", textAlign: "center", padding: 32 }}>
            No ops recorded yet. Bot will populate this as ops come in.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map(op => {
              const color = CATEGORY_COLOR[op.category] || "#94a3b8";
              const emoji = OP_EMOJI[op.operation?.toLowerCase()] || "⚡";
              return (
                <div key={op.id} style={{
                  display: "grid",
                  gridTemplateColumns: "32px 1fr 1fr auto",
                  gap: 10, alignItems: "center",
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid rgba(255,255,255,0.06)`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 8, padding: "8px 12px",
                }}>
                  <div style={{ fontSize: 18, textAlign: "center" }}>{emoji}</div>
                  <div>
                    <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500 }}>
                      {op.operation || "Unknown Op"}
                    </div>
                    <div style={{ color: "#475569", fontSize: 11 }}>
                      from <span style={{ color: "#94a3b8" }}>{op.attacker_province || "?"}</span>
                      {op.target_kingdom && <span style={{ color: "#475569" }}> ({op.target_kingdom})</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#38bdf8", fontSize: 13 }}>
                      → {op.target_province || "?"}
                    </div>
                    {op.result_value && (
                      <div style={{ color: "#ef4444", fontSize: 11 }}>
                        {op.result_value}
                      </div>
                    )}
                    {op.success === false && (
                      <div style={{ color: "#ef4444", fontSize: 11 }}>FAILED</div>
                    )}
                  </div>
                  <div style={{ color: "#475569", fontSize: 11, textAlign: "right" }}>
                    {timeAgo(op.timestamp)}
                  </div>
                </div>
              );
            })}
            {ops.length >= limit && (
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
