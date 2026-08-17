import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { getKingdomContext, isOutgoingAttack } from "../services/kingdomContext";

const ATTACK_EMOJI = {
  "traditional march": "⚔️", ambush: "🎯", siege: "🏰", learn: "📚", conquest: "🗺️", massacre: "💀", raze: "🔥", storm: "⛈️", plunder: "💰",
};

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000), hrs = Math.floor(mins / 60), days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function StatPill({ label, value, color }) {
  if (!value || value === "0" || value === 0) return null;
  return <div style={{ background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 5, padding: "2px 8px", fontSize: 11, color, whiteSpace: "nowrap" }}>{label}: {typeof value === "number" ? value.toLocaleString() : value}</div>;
}

export default function AttackLog() {
  const [attacks, setAttacks] = useState([]), [loading, setLoading] = useState(true), [filter, setFilter] = useState("all"), [search, setSearch] = useState(""), [limit, setLimit] = useState(50), [kingdomCode, setKingdomCode] = useState(null);

  useEffect(() => {
    async function load() {
      const context = await getKingdomContext();
      setKingdomCode(context.kingdomCode);
      const { data } = await supabase.from("attacks").select("*").order("timestamp", { ascending: false }).limit(limit);
      setAttacks(data || []);
      setLoading(false);
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  function isOutgoing(attack) { return isOutgoingAttack(attack, kingdomCode); }

  const filtered = attacks.filter(a => {
    if (filter === "outgoing" && !isOutgoing(a)) return false;
    if (filter === "incoming" && isOutgoing(a)) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.attacker_province?.toLowerCase().includes(q) || a.target_province?.toLowerCase().includes(q) || a.attack_type?.toLowerCase().includes(q) || a.target_kingdom?.toLowerCase().includes(q);
    }
    return true;
  });

  const last24h = attacks.filter(a => Date.now() - new Date(a.timestamp) < 86400000);
  const totalAcres = last24h.reduce((sum, a) => sum + (parseInt(a.acres_captured) || 0), 0);
  const totalKills = last24h.reduce((sum, a) => sum + (parseInt(a.kills) || 0), 0);
  const outgoing = last24h.filter(isOutgoing), incoming = last24h.filter(a => !isOutgoing(a));

  if (loading) return <div className="loading">⏳ Loading Attack Log...</div>;

  return <div className="intel-panel"><div className="panel">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}><h2 style={{ margin: 0 }}>⚔️ Attack Log</h2><span style={{ color: "#475569", fontSize: 12 }}>Auto-refreshes every 30s{kingdomCode ? ` · ${kingdomCode}` : ""}</span></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8, marginBottom: 16 }}>
      {[['ATTACKS (24H)', last24h.length, '#38bdf8'], ['OUTGOING', outgoing.length, '#4ade80'], ['INCOMING', incoming.length, '#ef4444'], ['ACRES (24H)', totalAcres > 0 ? `+${totalAcres.toLocaleString()}` : '0', '#facc15'], ['KILLS (24H)', totalKills.toLocaleString(), '#fb923c']].map(([label,value,color]) => <div key={label} style={{ background: `${color}1a`, border: `1px solid ${color}33`, borderRadius: 8, padding: "10px 14px" }}><div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>{label}</div><div style={{ color, fontSize: 22, fontWeight: 700 }}>{value}</div></div>)}
    </div>
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>{["all", "outgoing", "incoming"].map(f => <button key={f} onClick={() => setFilter(f)} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${filter === f ? "#6366f1" : "rgba(255,255,255,0.1)"}`, background: filter === f ? "rgba(99,102,241,0.2)" : "transparent", color: filter === f ? "#6366f1" : "#94a3b8", cursor: "pointer", fontSize: 12, textTransform: "capitalize" }}>{f === "all" ? "All" : f === "outgoing" ? "⚔️ Outgoing" : "🛡️ Incoming"}</button>)}<input placeholder="🔍 Search attacker, target, type..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 180, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "4px 10px", color: "#e2e8f0", fontSize: 12 }} /></div>
    {filtered.length === 0 ? <p style={{ color: "#475569", textAlign: "center", padding: 32 }}>No attacks recorded yet. Bot will populate this as attacks come in.</p> : <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{filtered.map(a => { const out = isOutgoing(a), emoji = ATTACK_EMOJI[a.attack_type?.toLowerCase()] || "⚔️", borderColor = out ? "#4ade80" : "#ef4444"; return <div key={a.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderLeft: `3px solid ${borderColor}`, borderRadius: 8, padding: "10px 14px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}><div><span style={{ fontSize: 16, marginRight: 8 }}>{emoji}</span><span style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 14 }}>{a.attack_type || "Attack"}</span><span style={{ color: "#475569", fontSize: 12, marginLeft: 8 }}>{out ? "outgoing" : "incoming"}</span></div><span style={{ color: "#475569", fontSize: 11 }}>{timeAgo(a.timestamp)}</span></div><div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}><span style={{ color: out ? "#4ade80" : "#ef4444" }}>{a.attacker_province || "Unknown"}</span><span style={{ color: "#475569", margin: "0 6px" }}>→</span><span style={{ color: "#38bdf8" }}>{a.target_province || "Unknown"}</span>{a.target_kingdom && <span style={{ color: "#475569", fontSize: 11, marginLeft: 6 }}>({a.target_kingdom})</span>}</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[["Acres",a.acres_captured,"#facc15"],["Kills",a.kills,"#fb923c"],["Prisoners",a.prisoners,"#38bdf8"],["Books",a.books_captured,"#8b5cf6"],["Peasants",a.peasants,"#4ade80"],["Troops Lost",a.troops_lost,"#ef4444"],["Off Sent",a.off_sent||a.offense_sent,"#94a3b8"],["Buildings",a.buildings_survived,"#22c55e"],["Credits",a.training_credits,"#eab308"],["New Peasants",a.peasants_gained,"#4ade80"],["Sent",a.sent,"#94a3b8"]].map(([label,value,color]) => <StatPill key={label} label={label} value={parseInt(value) || 0} color={color} />)}</div></div>; })}{attacks.length >= limit && <button onClick={() => setLimit(l => l + 50)} style={{ marginTop: 8, padding: "8px 16px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 6, color: "#6366f1", cursor: "pointer", fontSize: 13 }}>Load more</button>}</div>}
  </div></div>;
}
