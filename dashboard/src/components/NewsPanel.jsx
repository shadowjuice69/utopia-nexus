import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { loadNexusConfig, getNexusConfig } from "../services/nexusConfig";

let MY_KD = "";

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
  return n != null ? Number(n).toLocaleString() : null;
}

// Maps intel7_events to a unified event shape for display
function normalizeIntel7(e) {
  const data = e.data || {};
  const direction = data.direction || (e.attacker_kingdom === MY_KD ? "outgoing" : "incoming");
  return {
    id: e.id,
    timestamp: e.timestamp,
    event_type: e.event_type,
    direction,
    attacker: e.attacker_province,
    attackerKd: e.attacker_kingdom,
    target: e.target_province,
    targetKd: e.target_kingdom,
    success: e.success,
    acres: data.acresCaptured || data.acresRecaptured || null,
    kills: data.kills,
    imprisoned: data.imprisoned,
    credits: data.credits,
    returnDays: data.returnDays,
    losses: data.losses,
    operation: e.operation,
    spellName: e.spell_name || data.spellName,
    thievesSent: data.thievesSent,
    thievesLost: data.thievesLost,
    defenseMil: data.defenseMil,
    attackType: data.attackType,
    peasantsKilled: data.peasantsKilled,
    runes: data.runes,
    _source: "intel7",
  };
}

function EventBadge({ e }) {
  let label, color;
  if (e.event_type === "attack") {
    if (!e.success) { label = "Repelled"; color = "#64748b"; }
    else if (e.direction === "incoming") { label = "Incoming"; color = "#ef4444"; }
    else if (e.attackType === "recapture") { label = "Recapture"; color = "#4ade80"; }
    else if (e.attackType === "massacre") { label = "Massacre"; color = "#f87171"; }
    else { label = "Attack"; color = "#4ade80"; }
  } else if (e.event_type === "thievery") {
    label = e.success === false ? "Op Failed" : "Op Hit";
    color = e.success === false ? "#64748b" : "#f59e0b";
  } else if (e.event_type === "spell") {
    label = e.success === false ? "Spell Failed" : "Spell Cast";
    color = "#8b5cf6";
  } else if (e.event_type === "aid") {
    label = "Aid Sent"; color = "#38bdf8";
  } else {
    label = e.event_type; color = "#64748b";
  }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
      background: color + "22", color, border: "1px solid " + color + "55",
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function EventRow({ e }) {
  const isIncoming = e.direction === "incoming";
  return (
    <div style={{
      padding: "10px 14px",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "#475569", fontSize: 11, minWidth: 70 }}>{timeAgo(e.timestamp)}</span>
        <EventBadge e={e} />
        {e.acres > 0 && (
          <span style={{ fontSize: 12, color: isIncoming ? "#ef4444" : "#4ade80", fontWeight: 600 }}>
            {isIncoming ? "-" : "+"}{fmt(e.acres)} acres
          </span>
        )}
      </div>

      <div style={{ fontSize: 13, color: "#cbd5e1", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {e.attacker && (
          <>
            <span style={{ color: isIncoming ? "#ef4444" : "#4ade80", fontWeight: 600 }}>{e.attacker}</span>
            {e.attackerKd && <span style={{ color: "#475569" }}>({e.attackerKd})</span>}
            {e.target && <span style={{ color: "#475569" }}>→</span>}
          </>
        )}
        {e.target && (
          <>
            <span style={{ color: isIncoming ? "#f87171" : "#94a3b8" }}>{e.target}</span>
            {e.targetKd && <span style={{ color: "#475569" }}>({e.targetKd})</span>}
          </>
        )}
        {(e.operation || e.spellName) && (
          <span style={{ color: "#8b5cf6", fontSize: 12 }}>· {e.operation || e.spellName}</span>
        )}
      </div>

      {(e.kills || e.imprisoned || e.credits || e.returnDays || e.thievesSent || e.runes) && (
        <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
          {e.kills && <span>⚔ {fmt(e.kills)} kills</span>}
          {e.imprisoned && <span>⛓ {fmt(e.imprisoned)} imprisoned</span>}
          {e.credits && <span>🎖 {fmt(e.credits)} credits</span>}
          {e.returnDays && <span>↩ {e.returnDays}d return</span>}
          {e.thievesSent && <span>sent: {fmt(e.thievesSent)}</span>}
          {e.thievesLost > 0 && <span style={{ color: "#ef4444" }}>lost: {fmt(e.thievesLost)}</span>}
          {e.defenseMil && <span>def: {fmt(e.defenseMil)}</span>}
          {e.runes && <span>🔮 {fmt(e.runes)} runes</span>}
          {e.peasantsKilled && <span style={{ color: "#ef4444" }}>💀 {fmt(e.peasantsKilled)} pop</span>}
        </div>
      )}
      {e.losses && Object.keys(e.losses).length > 0 && (
        <div style={{ fontSize: 11, color: "#ef4444" }}>
          Lost: {Object.entries(e.losses).map(([k, v]) => `${fmt(v)} ${k}`).join(", ")}
        </div>
      )}
    </div>
  );
}

const VIEWS = ["All Activity", "Attacks", "Ops", "Spells", "Aid", "Province Logs"];

export default function NewsPanel() {
  const [intel7, setIntel7] = useState([]);
  const [newsEvents, setNewsEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("All Activity");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 60000);
    return () => clearInterval(iv);
  }, []);

  async function fetchAll() {
    const config = await loadNexusConfig();
    MY_KD = config?.kd || getNexusConfig().kd || "";
    const [{ data: i7 }, { data: news }] = await Promise.all([
      supabase.from("intel7_events").select("*").order("timestamp", { ascending: false }).limit(500),
      supabase.from("news_events").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    setIntel7((i7 || []).map(normalizeIntel7));
    setNewsEvents(news || []);
    setLoading(false);
  }

  // Filter intel7 by view
  const filteredIntel7 = intel7.filter(e => {
    if (view === "Attacks") return e.event_type === "attack";
    if (view === "Ops") return e.event_type === "thievery";
    if (view === "Spells") return e.event_type === "spell";
    if (view === "Aid") return e.event_type === "aid";
    if (view === "Province Logs") return false; // province logs come from news_events only
    return true; // All Activity
  });

  const filteredNews = view === "Province Logs" || view === "All Activity" ? newsEvents : [];

  // Merge and sort by timestamp
  const normalizedNews = filteredNews.map(n => ({
    id: n.id,
    timestamp: n.created_at,
    event_type: n.event_type,
    direction: n.attacker_kd === MY_KD ? "outgoing" : "incoming",
    attacker: n.attacker_name,
    attackerKd: n.attacker_kd,
    target: n.defender_name,
    targetKd: n.defender_kd,
    success: true,
    acres: n.acres,
    kills: n.troops_killed,
    _source: "news_events",
  }));

  const allEvents = [...filteredIntel7, ...normalizedNews]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .filter(e => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (e.attacker || "").toLowerCase().includes(q) ||
        (e.target || "").toLowerCase().includes(q) ||
        (e.attackerKd || "").toLowerCase().includes(q) ||
        (e.targetKd || "").toLowerCase().includes(q) ||
        (e.operation || "").toLowerCase().includes(q) ||
        (e.spellName || "").toLowerCase().includes(q)
      );
    });

  // Summary stats
  const attacks = intel7.filter(e => e.event_type === "attack");
  const outgoing = attacks.filter(e => e.direction === "outgoing" && e.success !== false);
  const incoming = attacks.filter(e => e.direction === "incoming" && e.success !== false);
  const acresGained = outgoing.reduce((s, e) => s + (e.acres || 0), 0);
  const acresLost = incoming.reduce((s, e) => s + (e.acres || 0), 0);

  if (loading) return <div className="loading">⏳ Loading News...</div>;

  return (
    <div className="intel-panel">
      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginBottom: 14 }}>
        {[
          { label: "OUR ATTACKS", value: outgoing.length, color: "#4ade80" },
          { label: "ACRES GAINED", value: `+${fmt(acresGained)}`, color: "#4ade80" },
          { label: "INCOMING", value: incoming.length, color: "#ef4444" },
          { label: "ACRES LOST", value: `-${fmt(acresLost)}`, color: "#ef4444" },
          { label: "OPS", value: intel7.filter(e => e.event_type === "thievery").length, color: "#f59e0b" },
          { label: "SPELLS", value: intel7.filter(e => e.event_type === "spell").length, color: "#8b5cf6" },
        ].map(s => (
          <div key={s.label} style={{ background: `${s.color}18`, border: `1px solid ${s.color}33`, borderRadius: 8, padding: "8px 12px" }}>
            <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>{s.label}</div>
            <div style={{ color: s.color, fontSize: 16, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* View tabs + search */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
        {VIEWS.map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12,
            border: `1px solid ${view === v ? "#38bdf8" : "rgba(255,255,255,0.1)"}`,
            background: view === v ? "rgba(56,189,248,0.15)" : "transparent",
            color: view === v ? "#38bdf8" : "#64748b",
            fontWeight: view === v ? 600 : 400,
          }}>{v}</button>
        ))}
        <input
          placeholder="🔍 Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 160, background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
            padding: "5px 10px", color: "#e2e8f0", fontSize: 12,
          }}
        />
      </div>

      {/* Event feed */}
      <div className="panel" style={{ padding: 0 }}>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 style={{ margin: 0, fontSize: 15 }}>📰 {view} ({allEvents.length})</h2>
        </div>
        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {allEvents.length === 0 ? (
            <div style={{ color: "#64748b", padding: 24, textAlign: "center" }}>
              {view === "Province Logs"
                ? "No province logs yet — visit province pages with Tampermonkey active."
                : "No events recorded yet."}
            </div>
          ) : (
            allEvents.map((e, i) => <EventRow key={e.id || i} e={e} />)
          )}
        </div>
      </div>
    </div>
  );
}
