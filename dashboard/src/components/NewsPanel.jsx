import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const MY_KD = "6:9";

const EVENT_LABELS = {
  kd_invasion:       { label: "Invasion",      color: "#38bdf8" },
  kd_ambush:         { label: "Ambush",         color: "#a78bfa" },
  kd_pillage:        { label: "Pillage",        color: "#fb923c" },
  kd_loot:           { label: "Loot",           color: "#facc15" },
  kd_failed:         { label: "Failed",         color: "#64748b" },
  outgoing_attack:   { label: "Our Attack",     color: "#4ade80" },
  outgoing_ambush:   { label: "Our Ambush",     color: "#4ade80" },
  outgoing_failed:   { label: "Our Failed",     color: "#64748b" },
  outgoing_recapture:{ label: "Recapture",      color: "#4ade80" },
  incoming_attack:   { label: "Incoming Atk",   color: "#f87171" },
  incoming_ambush:   { label: "Incoming Amb",   color: "#f87171" },
  incoming_thief:    { label: "Thieves",        color: "#fb923c" },
  stolen_food:       { label: "Food Stolen",    color: "#fb923c" },
  stolen_gold:       { label: "Gold Stolen",    color: "#fb923c" },
  outgoing_spell:    { label: "Spell Cast",     color: "#a78bfa" },
  self_spell:        { label: "Self Spell",     color: "#38bdf8" },
  science_allocation:{ label: "Science",        color: "#64748b" },
  log:               { label: "Log",            color: "#334155" },
};

const VIEWS = ["KD News", "Province News", "Province Logs"];

const KD_TYPES = ["kd_invasion","kd_ambush","kd_pillage","kd_loot","kd_failed"];
const PROV_NEWS_TYPES = ["incoming_attack","incoming_ambush","incoming_thief","stolen_food","stolen_gold"];
const PROV_LOG_TYPES = ["outgoing_attack","outgoing_ambush","outgoing_failed","outgoing_recapture","outgoing_spell","self_spell","self_spell_fail","science_allocation","log"];

function Badge({ type }) {
  const cfg = EVENT_LABELS[type] || { label: type, color: "#64748b" };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
      background: cfg.color + "22", color: cfg.color, border: "1px solid " + cfg.color + "55",
      whiteSpace: "nowrap",
    }}>{cfg.label}</span>
  );
}

function EventRow({ e, myKd }) {
  const isOurAtk = e.attacker_kd === myKd;
  const isOurDef = e.defender_kd === myKd;
  const isOutgoing = e.event_type.startsWith("outgoing");

  return (
    <div style={{
      padding: "10px 14px",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "#475569", fontSize: 11, minWidth: 110 }}>{e.date}</span>
        <Badge type={e.event_type} />
        {e.acres > 0 && (
          <span style={{ fontSize: 12, color: isOurAtk || isOutgoing ? "#4ade80" : "#f87171", fontWeight: 600 }}>
            {isOurAtk || isOutgoing ? "+" : "-"}{e.acres} acres
          </span>
        )}
      </div>

      <div style={{ fontSize: 13, color: "#cbd5e1", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {e.attacker_name && (
          <>
            <span style={{ color: isOurAtk ? "#4ade80" : "#f87171", fontWeight: 600 }}>{e.attacker_name}</span>
            <span style={{ color: "#475569" }}>({e.attacker_kd})</span>
            <span style={{ color: "#475569" }}>→</span>
          </>
        )}
        {e.defender_name && (
          <>
            <span style={{ color: isOurDef ? "#f87171" : "#94a3b8", fontWeight: isOurDef ? 600 : 400 }}>{e.defender_name}</span>
            <span style={{ color: "#475569" }}>({e.defender_kd})</span>
          </>
        )}
        {e.source_province && !e.attacker_name && (
          <span style={{ color: "#64748b" }}>{e.source_province}</span>
        )}
        {e.raw && !e.attacker_name && !e.defender_name && (
          <span style={{ color: "#475569", fontSize: 12 }}>{e.raw.substring(0, 80)}{e.raw.length > 80 ? "…" : ""}</span>
        )}
      </div>

      {(e.troops_sent || e.troops_killed || e.credits_gained || e.peasants_settled) && (
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
          {e.troops_sent && <span>Sent: <strong style={{ color: "#94a3b8" }}>{e.troops_sent.toLocaleString()}</strong></span>}
          {e.troops_killed && <span>Killed: <strong style={{ color: "#f87171" }}>{e.troops_killed.toLocaleString()}</strong></span>}
          {e.credits_gained && <span>Credits: <strong style={{ color: "#4ade80" }}>{e.credits_gained.toLocaleString()}</strong></span>}
          {e.peasants_settled && <span>Peasants: <strong style={{ color: "#38bdf8" }}>{e.peasants_settled.toLocaleString()}</strong></span>}
          {e.return_days && <span>Returns in: <strong style={{ color: "#facc15" }}>{e.return_days}d</strong></span>}
        </div>
      )}
      {e.troops_lost && Object.keys(e.troops_lost).length > 0 && (
        <div style={{ fontSize: 11, color: "#f87171" }}>
          Lost: {Object.entries(e.troops_lost).map(([k,v]) => `${v} ${k.replace(/_/g," ")}`).join(", ")}
        </div>
      )}
    </div>
  );
}

export default function NewsPanel() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("KD News");
  const [search, setSearch] = useState("");
  const [myKd, setMyKd] = useState(MY_KD);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 60000);
    return () => clearInterval(iv);
  }, []);

  async function fetchAll() {
    const { data: settings } = await supabase.from("bot_settings").select("value").eq("key", "kingdom_code").single();
    if (settings?.value) setMyKd(settings.value);

    const [kdRes, provNewsRes, provLogRes] = await Promise.all([
      supabase.from("news_events").select("*").in("event_type", [...KD_TYPES]).order("created_at", { ascending: false }).limit(500),
      supabase.from("news_events").select("*").in("event_type", [...PROV_NEWS_TYPES]).order("created_at", { ascending: false }).limit(500),
      supabase.from("news_events").select("*").in("event_type", [...PROV_LOG_TYPES]).order("created_at", { ascending: false }).limit(500),
    ]);
    const combined = [...(kdRes.data||[]), ...(provNewsRes.data||[]), ...(provLogRes.data||[])];
    setEvents(combined);
    setLoading(false);
  }

  const typeFilter = view === "KD News" ? KD_TYPES : view === "Province News" ? PROV_NEWS_TYPES : PROV_LOG_TYPES;

  const filtered = events
    .filter(e => typeFilter.includes(e.event_type))
    .filter(e => !search || 
      e.attacker_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.defender_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.attacker_kd?.includes(search) ||
      e.defender_kd?.includes(search) ||
      e.raw?.toLowerCase().includes(search.toLowerCase())
    );

  // Summary stats for KD News
  const ourAttacks = events.filter(e => KD_TYPES.includes(e.event_type) && e.attacker_kd === myKd);
  const incomingAtks = events.filter(e => KD_TYPES.includes(e.event_type) && e.defender_kd === myKd);
  const ourAcres = ourAttacks.reduce((s, e) => s + (e.acres || 0), 0);
  const lostAcres = incomingAtks.reduce((s, e) => s + (e.acres || 0), 0);

  if (loading) return <div className="loading">⏳ Loading News...</div>;

  return (
    <div className="intel-panel">
      <div className="intel-controls" style={{ flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {VIEWS.map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "6px 14px", borderRadius: 6, border: "1px solid",
              borderColor: view === v ? "#38bdf8" : "rgba(255,255,255,0.1)",
              background: view === v ? "rgba(56,189,248,0.15)" : "transparent",
              color: view === v ? "#38bdf8" : "#64748b",
              fontSize: 13, cursor: "pointer", fontWeight: view === v ? 600 : 400,
            }}>{v}</button>
          ))}
        </div>
        <input
          className="intel-search"
          placeholder="🔍 Search province, kingdom..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
      </div>

      {view === "KD News" && (
        <div className="stats-row" style={{ marginBottom: 12 }}>
          <div className="stat-card"><span className="stat-label">Our Attacks</span><strong className="stat-value" style={{ color: "#4ade80" }}>{ourAttacks.length}</strong></div>
          <div className="stat-card"><span className="stat-label">Acres Gained</span><strong className="stat-value" style={{ color: "#4ade80" }}>+{ourAcres.toLocaleString()}</strong></div>
          <div className="stat-card"><span className="stat-label">Incoming</span><strong className="stat-value" style={{ color: "#f87171" }}>{incomingAtks.length}</strong></div>
          <div className="stat-card"><span className="stat-label">Acres Lost</span><strong className="stat-value" style={{ color: "#f87171" }}>-{lostAcres.toLocaleString()}</strong></div>
        </div>
      )}

      <div className="panel" style={{ padding: 0 }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 style={{ margin: 0 }}>📰 {view} ({filtered.length})</h2>
        </div>
        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ color: "#64748b", padding: 24, textAlign: "center" }}>
              No events yet — paste {view} in the Import tab.
            </div>
          ) : (
            filtered.map((e, i) => <EventRow key={e.id || i} e={e} myKd={myKd} />)
          )}
        </div>
      </div>
    </div>
  );
}
