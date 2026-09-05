import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { loadNexusConfig, getNexusConfig } from "../services/nexusConfig";
import { loadNexusConfig, getNexusConfig } from "../services/nexusConfig";

const ATTACK_EMOJI = {
  attack: "⚔️",
  ambush: "🎯",
  siege: "🏰",
  recapture: "🔄",
  massacre: "💀",
  loot: "💰",
  incoming: "🛡️",
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
  if (!value || value === 0) return null;
  return (
    <div style={{ background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 5, padding: "2px 8px", fontSize: 11, color, whiteSpace: "nowrap" }}>
      {label}: {typeof value === "number" ? value.toLocaleString() : value}
    </div>
  );
}

export default function AttackLog() {
  const [attacks, setAttacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [myKd, setMyKd] = useState("");

  useEffect(() => {
    let active = true;
    async function fetch() {
      const config = await loadNexusConfig();
      const currentKd = config?.kd || getNexusConfig().kd || "";
      setMyKd(currentKd);
      const { data } = await supabase.from("intel7_events").select("*").eq("channel_type", "attacks").order("timestamp", { ascending: false }).limit(limit);
      if (!active) return;
      setAttacks(data || []);
      setLoading(false);
    }
    fetch();
    const iv = setInterval(fetch, 30000);
    return () => { active = false; clearInterval(iv); };
  }, [limit]);

  function isOutgoing(a) { return a.attacker_kingdom === myKd || (a.event_type === "attack" && a.attacker_kingdom === myKd); }
  function isIncoming(a) { return a.target_kingdom === myKd && a.attacker_kingdom !== myKd; }

  const filtered = attacks.filter(a => {
    if (filter === "outgoing" && !isOutgoing(a)) return false;
    if (filter === "incoming" && !isIncoming(a)) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.attacker_province?.toLowerCase().includes(q) || a.target_province?.toLowerCase().includes(q) || a.event_type?.toLowerCase().includes(q) || a.target_kingdom?.toLowerCase().includes(q) || a.attacker_kingdom?.toLowerCase().includes(q);
    }
    return true;
  });

  const last24h = attacks.filter(a => Date.now() - new Date(a.timestamp) < 86400000);
  const outgoing24 = last24h.filter(isOutgoing);
  const incoming24 = last24h.filter(isIncoming);
  const totalAcres = outgoing24.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const totalKills = outgoing24.reduce((s, a) => s + (Number(a.data?.kills) || 0), 0);

  if (loading) return <div className="loading">⏳ Loading Attack Log...</div>;

  return (
    <div className="intel-panel">
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}><h2 style={{ margin: 0 }}>⚔️ Attack Log</h2><span style={{ color: "#475569", fontSize: 12 }}>Auto-refreshes every 30s</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8, marginBottom: 16 }}>
          {[{ label: "ATTACKS (24H)", value: last24h.length, color: "#38bdf8" }, { label: "OUTGOING", value: outgoing24.length, color: "#4ade80" }, { label: "INCOMING", value: incoming24.length, color: "#ef4444" }, { label: "ACRES (24H)", value: totalAcres > 0 ? `+${totalAcres.toLocaleString()}` : "0", color: "#facc15" }, { label: "KILLS (24H)", value: totalKills.toLocaleString(), color: "#fb923c" }].map(({ label, value, color }) => <div key={label} style={{ background: `${color}1a`, border: `1px solid ${color}33`, borderRadius: 8, padding: "10px 14px" }}><div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>{label}</div><div style={{ color, fontSize: 22, fontWeight: 700 }}>{value}</div></div>)}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {["all", "outgoing", "incoming"].map(f => <button key={f} onClick={() => setFilter(f)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${filter === f ? "#6366f1" : "rgba(255,255,255,0.1)"}`, background: filter === f ? "rgba(99,102,241,0.2)" : "transparent", color: filter === f ? "#6366f1" : "#94a3b8", cursor: "pointer", fontSize: 12, textTransform: "capitalize" }}>{f === "all" ? "All" : f === "outgoing" ? "⚔️ Outgoing" : "🛡️ Incoming"}</button>)}
          <input placeholder="🔍 Search province, kingdom, type..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 10px", color: "#e2e8f0", fontSize: 12 }} />
        </div>
        {filtered.length === 0 ? <p style={{ color: "#475569", textAlign: "center", padding: 32 }}>No attacks recorded yet.</p> : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map(a => {
            const out = isOutgoing(a); const inc = isIncoming(a); const emoji = ATTACK_EMOJI[a.event_type] || "⚔️"; const borderColor = out ? "#4ade80" : inc ? "#ef4444" : "#475569"; const data = a.data || {}; const acres = Number(a.amount) || 0;
            return <div key={a.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderLeft: `3px solid ${borderColor}`, borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}><div><span style={{ fontSize: 16, marginRight: 8 }}>{emoji}</span><span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{a.event_type || "Attack"}</span><span style={{ color: "#475569", fontSize: 12, marginLeft: 8 }}>{out ? "outgoing" : inc ? "incoming" : "observed"}</span></div><span style={{ color: "#475569", fontSize: 11 }}>{timeAgo(a.timestamp)}</span></div>
              <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}><span style={{ color: out ? "#4ade80" : "#ef4444", fontWeight: 600 }}>{a.attacker_province || "Unknown"}</span><span style={{ color: "#475569", fontSize: 11, marginLeft: 4 }}>({a.attacker_kingdom || "?"})</span><span style={{ color: "#475569", margin: "0 8px" }}>→</span><span style={{ color: "#38bdf8", fontWeight: 600 }}>{a.target_province || "Unknown"}</span><span style={{ color: "#475569", fontSize: 11, marginLeft: 4 }}>({a.target_kingdom || "?"})</span></div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><StatPill label="Acres" value={acres} color="#facc15" /><StatPill label="Kills" value={data.kills} color="#fb923c" /><StatPill label="Imprisoned" value={data.imprisoned} color="#38bdf8" /><StatPill label="Credits" value={data.credits} color="#8b5cf6" /><StatPill label="Peasants" value={data.peasants} color="#4ade80" /><StatPill label="Returns" value={data.return_days ? `${data.return_days}d` : null} color="#94a3b8" /><StatPill label="vs Def" value={data.enemy_defense} color="#475569" /></div>
              {data.troops_lost && Object.keys(data.troops_lost).length > 0 && <div style={{ marginTop: 6, fontSize: 11, color: "#ef4444" }}>Lost: {Object.entries(data.troops_lost).map(([k, v]) => `${v?.toLocaleString()} ${k}`).join(", ")}</div>}
            </div>;
          })}
          {attacks.length >= limit && <button onClick={() => setLimit(l => l + 50)} style={{ marginTop: 8, padding: "8px 16px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 6, color: "#6366f1", cursor: "pointer", fontSize: 13 }}>Load more</button>}
        </div>}
      </div>
    </div>
  );
}
