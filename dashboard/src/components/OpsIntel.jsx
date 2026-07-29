import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const NICOLAIJ_URL = "https://fcvozxmfocvrqfyrakbq.supabase.co/rest/v1/my_kd_ops";
const NICOLAIJ_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjdm96eG1mb2N2cnFmeXJha2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODUxNjgsImV4cCI6MjA5NzY2MTE2OH0.6vECt7OuRnrSYkbE9PC-rTbo1B5FEKsP1kWVo_5Zc2g";

const OP_EMOJI = {
  "free prisoners": "🔓", "rob granaries": "🌾", "rob vaults": "💰",
  "rob the vaults": "💰", "rob towers": "🗼", "kidnap": "👤",
  "bribe thieves": "🤝", "bribe generals": "🎖️", "incite riots": "🔥",
  "arson": "🔥", "night strike": "🗡️", "steal war horses": "🐴",
  "greater arson": "💥", "sabotage wizards": "🧙", "assassinate wizards": "☠️",
  "steal horses": "🐎", "propaganda": "📢",
  "fireball": "🔥", "storms": "⛈️", "droughts": "🏜️", "tornadoes": "🌪️",
  "lightning strike": "⚡", "meteor showers": "☄️", "land lust": "🗺️",
  "nightmares": "😱", "mystic vortex": "🌀", "fools gold": "💛",
  "nightfall": "🌑", "chastity": "⛔", "sloth": "🦥",
};

const CATEGORY_COLOR = { thievery: "#f59e0b", sorcery: "#8b5cf6" };

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

async function fetchNicolaijOps(lastTick = 0) {
  const params = new URLSearchParams({
    select: "tick,timestamp,category,op,outcome,attacker_province,target_province,target_kingdom,result_value,unit,att_tpa_modified,def_tpa_modified,att_wpa_modified,def_wpa_modified,fail_units_lost,fail_units_lost_unit",
    order: "tick.desc",
    limit: "100",
  });
  if (lastTick > 0) params.set("tick", `gt.${lastTick}`);

  const res = await fetch(`${NICOLAIJ_URL}?${params}`, {
    headers: { apikey: NICOLAIJ_KEY, Authorization: `Bearer ${NICOLAIJ_KEY}` }
  });
  return res.ok ? res.json() : [];
}

export default function OpsIntel() {
  const [myOps, setMyOps] = useState([]);
  const [allyOps, setAllyOps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [source, setSource] = useState("all"); // all | mine | ally
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  async function fetchAll() {
    const [{ data: mine }, ally] = await Promise.all([
      supabase.from("hostile_ops").select("*").order("timestamp", { ascending: false }).limit(limit),
      fetchNicolaijOps(),
    ]);
    setMyOps(mine || []);
    setAllyOps(ally || []);
    setLoading(false);
  }

  // Normalize ally ops to same shape as mine
  const normalizedAlly = allyOps.map(o => ({
    id: `ally_${o.tick}_${o.attacker_province}`,
    operation: o.op,
    category: o.category,
    attacker_province: o.attacker_province,
    target_province: o.target_province,
    target_kingdom: o.target_kingdom,
    result_value: o.result_value,
    success: o.outcome === "success",
    timestamp: o.timestamp,
    att_tpa: o.att_tpa_modified,
    def_tpa: o.def_tpa_modified,
    att_wpa: o.att_wpa_modified,
    def_wpa: o.def_wpa_modified,
    fail_units_lost: o.fail_units_lost,
    fail_units_lost_unit: o.fail_units_lost_unit,
    unit: o.unit,
    _source: "ally",
  }));

  const allOps = [
    ...myOps.map(o => ({ ...o, _source: "mine" })),
    ...normalizedAlly,
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const displayed = allOps.filter(o => {
    if (source === "mine" && o._source !== "mine") return false;
    if (source === "ally" && o._source !== "ally") return false;
    if (filter !== "all" && o.category !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.operation?.toLowerCase().includes(q) ||
        o.target_province?.toLowerCase().includes(q) ||
        o.attacker_province?.toLowerCase().includes(q) ||
        o.target_kingdom?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // 24h stats
  const last24h = allOps.filter(o => Date.now() - new Date(o.timestamp) < 86400000);
  const byType = last24h.reduce((acc, o) => { acc[o.category] = (acc[o.category] || 0) + 1; return acc; }, {});
  const byTarget = last24h.reduce((acc, o) => {
    const t = o.target_province || "Unknown";
    acc[t] = (acc[t] || 0) + 1; return acc;
  }, {});
  const topTarget = Object.entries(byTarget).sort((a, b) => b[1] - a[1])[0];
  const successRate = last24h.length > 0
    ? Math.round((last24h.filter(o => o.success !== false).length / last24h.length) * 100)
    : 0;

  if (loading) return <div className="loading">⏳ Loading Ops Intel...</div>;

  return (
    <div className="intel-panel">
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>🗡️ Ops Intelligence</h2>
          <span style={{ color: "#475569", fontSize: 12 }}>
            Mine: {myOps.length} · Ally: {allyOps.length} · Refreshes 30s
          </span>
        </div>

        {/* Summary stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8, marginBottom: 16 }}>
          {[
            { label: "OPS (24H)", value: last24h.length, color: "#ef4444" },
            { label: "THIEVERY", value: byType.thievery || 0, color: "#f59e0b" },
            { label: "SORCERY", value: byType.sorcery || 0, color: "#8b5cf6" },
            { label: "SUCCESS %", value: `${successRate}%`, color: "#4ade80" },
            { label: "TOP TARGET", value: topTarget ? `${topTarget[0]} (${topTarget[1]}x)` : "—", color: "#38bdf8" },
          ].map(s => (
            <div key={s.label} style={{ background: `${s.color}18`, border: `1px solid ${s.color}33`, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>{s.label}</div>
              <div style={{ color: s.color, fontSize: typeof s.value === "string" && s.value.length > 6 ? 12 : 20, fontWeight: 700 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Source + category filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {["all", "mine", "ally"].map(s => (
            <button key={s} onClick={() => setSource(s)} style={{
              padding: "4px 10px", borderRadius: 6,
              border: `1px solid ${source === s ? "#38bdf8" : "rgba(255,255,255,0.1)"}`,
              background: source === s ? "rgba(56,189,248,0.15)" : "transparent",
              color: source === s ? "#38bdf8" : "#94a3b8",
              cursor: "pointer", fontSize: 12,
            }}>
              {s === "all" ? "All Sources" : s === "mine" ? "🏰 Mine" : "🤝 Ally"}
            </button>
          ))}
          <div style={{ width: 1, background: "rgba(255,255,255,0.1)" }} />
          {["all", "thievery"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "4px 10px", borderRadius: 6,
              border: `1px solid ${filter === f ? CATEGORY_COLOR[f] || "#6366f1" : "rgba(255,255,255,0.1)"}`,
              background: filter === f ? `${CATEGORY_COLOR[f] || "#6366f1"}22` : "transparent",
              color: filter === f ? CATEGORY_COLOR[f] || "#6366f1" : "#94a3b8",
              cursor: "pointer", fontSize: 12, textTransform: "capitalize",
            }}>
              {f === "all" ? "All Types" : f}
            </button>
          ))}
          <input
            placeholder="🔍 Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 150, background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
              padding: "4px 10px", color: "#e2e8f0", fontSize: 12,
            }}
          />
        </div>

        {/* Ops list */}
        {displayed.length === 0 ? (
          <p style={{ color: "#475569", textAlign: "center", padding: 32 }}>
            No ops recorded yet.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {displayed.slice(0, limit).map(op => {
              const color = CATEGORY_COLOR[op.category] || "#94a3b8";
              const emoji = OP_EMOJI[op.operation?.toLowerCase()] || "⚡";
              const isAlly = op._source === "ally";
              return (
                <div key={op.id} style={{
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${op.success === false ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)"}`,
                  borderLeft: `3px solid ${op.success === false ? "#ef4444" : color}`,
                  borderRadius: 8, padding: "8px 12px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{emoji}</span>
                      <div>
                        <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 500 }}>{op.operation || "Unknown"}</span>
                        {op.success === false && <span style={{ color: "#ef4444", fontSize: 11, marginLeft: 6 }}>FAILED</span>}
                        <span style={{ color: isAlly ? "#4ade80" : "#38bdf8", fontSize: 10, marginLeft: 6, background: isAlly ? "rgba(74,222,128,0.1)" : "rgba(56,189,248,0.1)", padding: "1px 5px", borderRadius: 3 }}>
                          {isAlly ? "ally" : "mine"}
                        </span>
                      </div>
                    </div>
                    <span style={{ color: "#475569", fontSize: 11 }}>{timeAgo(op.timestamp)}</span>
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: op.att_tpa ? 4 : 0 }}>
                    <span style={{ color: "#e2e8f0" }}>{op.attacker_province || "?"}</span>
                    <span style={{ color: "#475569", margin: "0 6px" }}>→</span>
                    <span style={{ color: "#38bdf8" }}>{op.target_province || "?"}</span>
                    {op.target_kingdom && <span style={{ color: "#374151", fontSize: 11, marginLeft: 6 }}>({op.target_kingdom})</span>}
                    {op.result_value && <span style={{ color: "#facc15", marginLeft: 8 }}>+{Number(op.result_value).toLocaleString()} {op.unit || ""}</span>}
                  </div>
                  {(op.att_tpa || op.def_tpa || op.att_wpa || op.def_wpa) && (
                    <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#475569", marginTop: 4 }}>
                      {op.att_tpa && <span>aTPA: <span style={{ color: "#f59e0b" }}>{Number(op.att_tpa).toFixed(2)}</span></span>}
                      {op.def_tpa && <span>dTPA: <span style={{ color: "#94a3b8" }}>{Number(op.def_tpa).toFixed(2)}</span></span>}
                      {op.att_wpa && <span>aWPA: <span style={{ color: "#8b5cf6" }}>{Number(op.att_wpa).toFixed(2)}</span></span>}
                      {op.def_wpa && <span>dWPA: <span style={{ color: "#94a3b8" }}>{Number(op.def_wpa).toFixed(2)}</span></span>}
                      {op.fail_units_lost && <span style={{ color: "#ef4444" }}>Lost: {Number(op.fail_units_lost).toLocaleString()} {op.fail_units_lost_unit || ""}</span>}
                    </div>
                  )}
                </div>
              );
            })}
            {displayed.length > limit && (
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
