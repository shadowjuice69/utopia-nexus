import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const OP_EMOJI = {
  "free prisoners": "🔓", "rob granaries": "🌾", "rob vaults": "💰",
  "rob the vaults": "💰", "rob towers": "🗼", "rob the towers": "🗼",
  "kidnap": "👤", "bribe thieves": "🤝", "bribe generals": "🎖️",
  "incite riots": "🔥", "arson": "🔥", "night strike": "🗡️",
  "steal war horses": "🐴", "steal horses": "🐎", "greater arson": "💥",
  "sabotage wizards": "🧙", "assassinate wizards": "☠️", "propaganda": "📢",
  "spy on defense": "🔭", "spy on military": "🔭", "spy on throne": "🔭",
  "spy on science": "🔭", "spy on buildings": "🔭",
  "fireball": "🔥", "storms": "⛈️", "droughts": "🏜️", "tornadoes": "🌪️",
  "lightning strike": "⚡", "meteor showers": "☄️", "land lust": "🗺️",
  "nightmares": "😱", "mystic vortex": "🌀", "fools gold": "💛",
  "nightfall": "🌑", "chastity": "⛔", "sloth": "🦥", "gluttony": "🍖",
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

function opColor(op) {
  if (!op) return "#94a3b8";
  const l = op.toLowerCase();
  if (l.startsWith("spy")) return "#38bdf8";
  if (["rob", "steal", "kidnap", "bribe", "free", "arson", "incite", "night strike", "propaganda", "sabotage", "assassinate"].some(k => l.includes(k))) return "#f59e0b";
  return "#8b5cf6"; // sorcery
}

export default function OpsIntel() {
  const [ops, setOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | success | fail
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchOps();
    const iv = setInterval(fetchOps, 30000);
    return () => clearInterval(iv);
  }, [limit]);

  async function fetchOps() {
    const { data } = await supabase
      .from("intel7_events")
      .select("*")
      .in("event_type", ["thievery", "spell"])
      .order("timestamp", { ascending: false })
      .limit(limit);
    setOps(data || []);
    setLoading(false);
  }

  const displayed = ops.filter(o => {
    if (filter === "success" && o.success === false) return false;
    if (filter === "fail" && o.success !== false) return false;
    if (search) {
      const q = search.toLowerCase();
      const op = o.operation || o.spell_name || "";
      return (
        op.toLowerCase().includes(q) ||
        (o.attacker_province || "").toLowerCase().includes(q) ||
        (o.target_province || "").toLowerCase().includes(q) ||
        (o.target_kingdom || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // 24h stats
  const last24h = ops.filter(o => Date.now() - new Date(o.timestamp) < 86400000);
  const successCount = last24h.filter(o => o.success !== false).length;
  const failCount = last24h.filter(o => o.success === false).length;
  const successRate = last24h.length > 0 ? Math.round((successCount / last24h.length) * 100) : 0;
  const byTarget = last24h.reduce((acc, o) => {
    const t = o.target_province || "Unknown";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const topTarget = Object.entries(byTarget).sort((a, b) => b[1] - a[1])[0];

  // Op type breakdown
  const byOp = last24h.reduce((acc, o) => {
    const k = o.operation || o.spell_name || "Unknown";
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const topOp = Object.entries(byOp).sort((a, b) => b[1] - a[1])[0];

  if (loading) return <div className="loading">⏳ Loading Ops Intel...</div>;

  return (
    <div className="intel-panel">
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>🗡️ Ops Intel</h2>
          <span style={{ color: "#475569", fontSize: 12 }}>
            {ops.length} ops · refreshes 30s
          </span>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8, marginBottom: 16 }}>
          {[
            { label: "OPS (24H)", value: last24h.length, color: "#38bdf8" },
            { label: "SUCCESS", value: successCount, color: "#4ade80" },
            { label: "FAILED", value: failCount, color: "#ef4444" },
            { label: "SUCCESS %", value: `${successRate}%`, color: "#facc15" },
            { label: "TOP TARGET", value: topTarget ? `${topTarget[0]} (${topTarget[1]}x)` : "—", color: "#f59e0b" },
            { label: "TOP OP", value: topOp ? topOp[0] : "—", color: "#8b5cf6" },
          ].map(s => (
            <div key={s.label} style={{ background: `${s.color}18`, border: `1px solid ${s.color}33`, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>{s.label}</div>
              <div style={{ color: s.color, fontSize: typeof s.value === "string" && s.value.length > 8 ? 11 : 18, fontWeight: 700 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {[
            { key: "all", label: "All" },
            { key: "success", label: "✅ Success" },
            { key: "fail", label: "❌ Failed" },
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
            placeholder="🔍 Search op, attacker, target..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 160, background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
              padding: "4px 10px", color: "#e2e8f0", fontSize: 12,
            }}
          />
        </div>

        {/* Op feed */}
        {displayed.length === 0 ? (
          <p style={{ color: "#475569", textAlign: "center", padding: 32 }}>No ops recorded yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {displayed.slice(0, limit).map(op => {
              const opName = op.operation || op.spell_name || "Unknown";
              const color = opColor(opName);
              const emoji = OP_EMOJI[opName.toLowerCase()] || (op.event_type === "spell" ? "✨" : "⚡");
              const failed = op.success === false;
              const data = op.data || {};

              return (
                <div key={op.id} style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${failed ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)"}`,
                  borderLeft: `3px solid ${failed ? "#ef4444" : color}`,
                  borderRadius: 8, padding: "8px 12px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{emoji}</span>
                      <div>
                        <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500 }}>{opName}</span>
                        {failed
                          ? <span style={{ color: "#ef4444", fontSize: 11, marginLeft: 6 }}>FAILED</span>
                          : <span style={{ color: "#4ade80", fontSize: 11, marginLeft: 6 }}>✓</span>
                        }
                        <span style={{ color: "#374151", fontSize: 10, marginLeft: 8, background: "rgba(56,189,248,0.08)", padding: "1px 5px", borderRadius: 3 }}>
                          {op.event_type}
                        </span>
                      </div>
                    </div>
                    <span style={{ color: "#475569", fontSize: 11, whiteSpace: "nowrap" }}>{timeAgo(op.timestamp)}</span>
                  </div>

                  <div style={{ color: "#94a3b8", fontSize: 12 }}>
                    <span style={{ color: "#e2e8f0" }}>{op.attacker_province || "?"}</span>
                    {op.target_province && <>
                      <span style={{ color: "#374151", margin: "0 6px" }}>→</span>
                      <span style={{ color: "#38bdf8" }}>{op.target_province}</span>
                      {op.target_kingdom && <span style={{ color: "#374151", fontSize: 11, marginLeft: 4 }}>({op.target_kingdom})</span>}
                    </>}
                  </div>

                  {/* Extra detail row */}
                  {(data.defenseMil || data.thievesSent || data.thievesLost || data.runes) && (
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#475569", marginTop: 4 }}>
                      {data.defenseMil && <span>def: <span style={{ color: "#f59e0b" }}>{Number(data.defenseMil).toLocaleString()}</span></span>}
                      {data.thievesSent && <span>sent: <span style={{ color: "#94a3b8" }}>{Number(data.thievesSent).toLocaleString()}</span></span>}
                      {data.thievesLost > 0 && <span>lost: <span style={{ color: "#ef4444" }}>{Number(data.thievesLost).toLocaleString()}</span></span>}
                      {data.runes && <span>runes: <span style={{ color: "#8b5cf6" }}>{Number(data.runes).toLocaleString()}</span></span>}
                    </div>
                  )}
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
