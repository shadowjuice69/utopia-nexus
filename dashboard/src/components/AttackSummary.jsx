import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "../services/supabase";

const OUTGOING = ["outgoing_attack","outgoing_ambush","outgoing_recapture"];
const INCOMING = ["incoming_attack","incoming_ambush"];
const KD_OUT   = ["kd_invasion","kd_ambush","kd_pillage","kd_loot"];
const KD_IN    = ["kd_invasion","kd_ambush","kd_pillage"];

function StatCard({ label, value, color = "#38bdf8", sub }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <strong className="stat-value" style={{ color }}>{value}</strong>
      {sub && <span style={{ color: "#475569", fontSize: 11 }}>{sub}</span>}
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "12px 16px", marginBottom: 0 }}>
      <h3 style={{ margin: 0, color: "#94a3b8", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</h3>
    </div>
  );
}

function AttackRow({ e, isIncoming }) {
  const acreColor = isIncoming ? "#f87171" : "#4ade80";
  const sign = isIncoming ? "-" : "+";
  return (
    <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "#475569", fontSize: 11, minWidth: 120 }}>{e.date}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: acreColor }}>{sign}{e.acres} acres</span>
        <span style={{ fontSize: 12, color: "#64748b", textTransform: "capitalize" }}>{e.event_type.replace(/_/g," ")}</span>
      </div>
      <div style={{ fontSize: 13, color: "#cbd5e1", display: "flex", gap: 6, flexWrap: "wrap" }}>
        {isIncoming ? (
          <span style={{ color: "#f87171", fontWeight: 600 }}>{e.attacker_name} <span style={{ color: "#475569", fontWeight: 400 }}>({e.attacker_kd})</span></span>
        ) : (
          <span style={{ color: "#4ade80", fontWeight: 600 }}>{e.defender_name} <span style={{ color: "#475569", fontWeight: 400 }}>({e.defender_kd})</span></span>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
        {e.troops_sent > 0 && <span>Sent: <strong style={{ color: "#94a3b8" }}>{e.troops_sent.toLocaleString()}</strong></span>}
        {e.troops_killed > 0 && <span>Killed: <strong style={{ color: "#f87171" }}>{e.troops_killed.toLocaleString()}</strong></span>}
        {e.credits_gained > 0 && <span>Credits: <strong style={{ color: "#4ade80" }}>{e.credits_gained.toLocaleString()}</strong></span>}
        {e.peasants_settled > 0 && <span>Peasants: <strong style={{ color: "#38bdf8" }}>{e.peasants_settled.toLocaleString()}</strong></span>}
        {e.return_days > 0 && <span>Returns: <strong style={{ color: "#facc15" }}>{e.return_days}d</strong></span>}
        {e.troops_lost && Object.keys(e.troops_lost).length > 0 && (
          <span style={{ color: "#f87171" }}>Lost: {Object.entries(e.troops_lost).map(([k,v]) => `${v} ${k}`).join(", ")}</span>
        )}
      </div>
    </div>
  );
}

function KDRow({ e, myKd }) {
  const isOurAtk = e.attacker_kd === myKd;
  const isOurDef = e.defender_kd === myKd;
  const color = isOurAtk ? "#4ade80" : isOurDef ? "#f87171" : "#94a3b8";
  return (
    <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ color: "#475569", fontSize: 11, minWidth: 120 }}>{e.date}</span>
      {e.acres > 0 && <span style={{ fontSize: 12, fontWeight: 600, color }}>{isOurAtk ? "+" : isOurDef ? "-" : ""}{e.acres} ac</span>}
      <span style={{ fontSize: 12, color: isOurAtk ? "#4ade80" : "#94a3b8", fontWeight: isOurAtk ? 600 : 400 }}>{e.attacker_name}</span>
      <span style={{ color: "#475569", fontSize: 11 }}>({e.attacker_kd})</span>
      <span style={{ color: "#475569" }}>→</span>
      <span style={{ fontSize: 12, color: isOurDef ? "#f87171" : "#94a3b8", fontWeight: isOurDef ? 600 : 400 }}>{e.defender_name}</span>
      <span style={{ color: "#475569", fontSize: 11 }}>({e.defender_kd})</span>
      <span style={{ fontSize: 11, color: "#475569", textTransform: "capitalize" }}>{e.event_type.replace("kd_","")}</span>
    </div>
  );
}

export default function AttackSummary() {
  const [outgoing, setOutgoing] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [kdEvents, setKdEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myKd, setMyKd] = useState("");
  const [view, setView] = useState("overview");
  const [attacks, setAttacks] = useState([]);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 60000);
    return () => clearInterval(iv);
  }, []);

  async function fetchAll() {
    const { data: settings } = await supabase.from("bot_settings").select("value").eq("key","kingdom_code").single();
    if (settings?.value) setMyKd(settings.value);

    const { data: atkData } = await supabase
      .from("attacks")
      .select("attacker_province, target_kingdom, attack_type, acres_captured, timestamp")
      .order("timestamp", { ascending: true });
    setAttacks(atkData || []);

    const [outRes, inRes, kdRes] = await Promise.all([
      supabase.from("news_events").select("*").in("event_type", OUTGOING).order("date", { ascending: false }),
      supabase.from("news_events").select("*").in("event_type", INCOMING).order("date", { ascending: false }),
      supabase.from("news_events").select("*").in("event_type", [...KD_OUT,"kd_failed"]).order("date", { ascending: false }),
    ]);

    setOutgoing(outRes.data || []);
    setIncoming(inRes.data || []);
    setKdEvents(kdRes.data || []);
    setLoading(false);
  }

  const totalAcresGained = outgoing.reduce((s,e) => s + (e.acres||0), 0);
  const totalAcresLost   = incoming.reduce((s,e) => s + (e.acres||0), 0);
  const totalTroopsSent  = outgoing.reduce((s,e) => s + (e.troops_sent||0), 0);
  const totalKilled      = outgoing.reduce((s,e) => s + (e.troops_killed||0), 0);
  const totalCredits     = outgoing.reduce((s,e) => s + (e.credits_gained||0), 0);
  const totalPeasants    = outgoing.reduce((s,e) => s + (e.peasants_settled||0), 0);
  const totalLost        = outgoing.reduce((s,e) => {
    const t = e.troops_lost || {};
    return s + Object.values(t).reduce((a,b) => a+b, 0);
  }, 0);

  const kdOurAtks   = kdEvents.filter(e => e.attacker_kd === myKd);
  const kdIncoming  = kdEvents.filter(e => e.defender_kd === myKd);
  const kdAcresGained = kdOurAtks.reduce((s,e) => s + (e.acres||0), 0);
  const kdAcresLost   = kdIncoming.reduce((s,e) => s + (e.acres||0), 0);

  const byTarget = {};
  outgoing.forEach(e => {
    const key = `${e.defender_name} (${e.defender_kd})`;
    if (!byTarget[key]) byTarget[key] = { name: e.defender_name, kd: e.defender_kd, attacks: 0, acres: 0, killed: 0, credits: 0, lost: 0 };
    byTarget[key].attacks++;
    byTarget[key].acres += e.acres || 0;
    byTarget[key].killed += e.troops_killed || 0;
    byTarget[key].credits += e.credits_gained || 0;
    const lostTroops = e.troops_lost || {};
    byTarget[key].lost += Object.values(lostTroops).reduce((a,b) => a+b, 0);
  });
  const targets = Object.values(byTarget).sort((a,b) => b.acres - a.acres);

  const VIEWS = ["overview","outgoing","incoming","kd feed"];

  if (loading) return <div className="loading">⏳ Loading Attack Summary...</div>;

  return (
    <div className="intel-panel">
      <div className="intel-controls" style={{ flexWrap: "wrap", gap: 8 }}>
        {VIEWS.map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: "6px 14px", borderRadius: 6, border: "1px solid",
            borderColor: view === v ? "#38bdf8" : "rgba(255,255,255,0.1)",
            background: view === v ? "rgba(56,189,248,0.15)" : "transparent",
            color: view === v ? "#38bdf8" : "#64748b",
            fontSize: 13, cursor: "pointer", fontWeight: view === v ? 600 : 400,
            textTransform: "capitalize",
          }}>{v}</button>
        ))}
      </div>

      {view === "overview" && (
        <>
          <div className="stats-row">
            <StatCard label="Outgoing Attacks" value={outgoing.length} color="#38bdf8" />
            <StatCard label="Acres Gained" value={`+${totalAcresGained}`} color="#4ade80" />
            <StatCard label="Incoming Attacks" value={incoming.length} color="#f87171" />
            <StatCard label="Acres Lost" value={`-${totalAcresLost}`} color="#f87171" />
          </div>
          <div className="stats-row">
            <StatCard label="Troops Sent" value={totalTroopsSent.toLocaleString()} color="#94a3b8" />
            <StatCard label="Enemies Killed" value={totalKilled.toLocaleString()} color="#f87171" />
            <StatCard label="Troops Lost" value={totalLost.toLocaleString()} color="#fb923c" />
            <StatCard label="Credits Gained" value={totalCredits.toLocaleString()} color="#4ade80" />
          </div>
          <div className="stats-row">
            <StatCard label="Peasants Settled" value={totalPeasants.toLocaleString()} color="#38bdf8" />
            <StatCard label="KD Attacks Out" value={kdOurAtks.length} color="#4ade80" sub={`+${kdAcresGained} acres`} />
            <StatCard label="KD Attacks In" value={kdIncoming.length} color="#f87171" sub={`-${kdAcresLost} acres`} />
            <StatCard label="Net Acres (KD)" value={kdAcresGained - kdAcresLost} color={kdAcresGained >= kdAcresLost ? "#4ade80" : "#f87171"} />
          </div>
          {attacks.length > 0 && (() => {
            const outAtks = attacks.filter(a => a.attack_type !== "incoming");
            const inAtks = attacks.filter(a => a.attack_type === "incoming");
            const kdSet = new Set(outAtks.map(a => a.target_kingdom).filter(Boolean));
            const kds = [...kdSet];
            const buckets = {};
            for (const a of outAtks) {
              const d = new Date(a.timestamp);
              const key = d.toISOString().slice(0, 13);
              if (!buckets[key]) buckets[key] = { time: key };
              const kd = a.target_kingdom || "Unknown";
              buckets[key][kd] = (buckets[key][kd] || 0) + (a.acres_captured || 0);
            }
            for (const a of inAtks) {
              const d = new Date(a.timestamp);
              const key = d.toISOString().slice(0, 13);
              if (!buckets[key]) buckets[key] = { time: key };
              buckets[key]["Incoming"] = (buckets[key]["Incoming"] || 0) - (a.acres_captured || 0);
            }
            const sorted = Object.values(buckets).sort((a, b) => a.time.localeCompare(b.time));
            const cumulative = {};
            const chartData = sorted.map(b => {
              const point = { time: b.time.slice(5, 13).replace("T", " ") };
              for (const kd of [...kds, "Incoming"]) {
                cumulative[kd] = (cumulative[kd] || 0) + (b[kd] || 0);
                point[kd] = cumulative[kd];
              }
              return point;
            });
            const KD_COLORS = ["#38bdf8","#4ade80","#f87171","#a78bfa","#fbbf24","#fb923c","#34d399","#e879f9"];
            return (
              <div className="panel" style={{ marginTop: 12 }}>
                <h2>📈 Cumulative Land Change</h2>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#475569" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#475569" }} />
                    <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #38bdf8", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#94a3b8" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {kds.map((kd, i) => <Line key={kd} type="monotone" dataKey={kd} stroke={KD_COLORS[i % KD_COLORS.length]} strokeWidth={2} dot={false} />)}
                    <Line key="Incoming" type="monotone" dataKey="Incoming" stroke="#f87171" strokeWidth={2} strokeDasharray="4 2" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
          <div className="panel" style={{ padding: 0, marginTop: 12 }}>
            <SectionHeader title="Per-Target Breakdown" />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>{["Target","KD","Attacks","Acres","Killed","Lost","Credits"].map(h => <th key={h} style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{h}</th>)}</tr></thead>
                <tbody>
                  {targets.map((t,i) => <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}><td style={{ padding: "8px 12px", color: "#e2e8f0", fontWeight: 600 }}>{t.name}</td><td style={{ padding: "8px 12px", color: "#64748b" }}>{t.kd}</td><td style={{ padding: "8px 12px", color: "#38bdf8" }}>{t.attacks}</td><td style={{ padding: "8px 12px", color: "#4ade80" }}>+{t.acres}</td><td style={{ padding: "8px 12px", color: "#f87171" }}>{t.killed}</td><td style={{ padding: "8px 12px", color: "#fb923c" }}>{t.lost}</td><td style={{ padding: "8px 12px", color: "#4ade80" }}>{t.credits}</td></tr>)}
                  {targets.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#475569" }}>No outgoing attacks yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {view === "outgoing" && <div className="panel" style={{ padding: 0 }}><SectionHeader title={`Outgoing Attacks (${outgoing.length})`} /><div style={{ maxHeight: "65vh", overflowY: "auto" }}>{outgoing.map((e,i) => <AttackRow key={i} e={e} isIncoming={false} />)}{outgoing.length === 0 && <div style={{ padding: 24, color: "#475569", textAlign: "center" }}>No outgoing attacks recorded</div>}</div></div>}
      {view === "incoming" && <div className="panel" style={{ padding: 0 }}><SectionHeader title={`Incoming Attacks (${incoming.length})`} /><div style={{ maxHeight: "65vh", overflowY: "auto" }}>{incoming.map((e,i) => <AttackRow key={i} e={e} isIncoming={true} />)}{incoming.length === 0 && <div style={{ padding: 24, color: "#475569", textAlign: "center" }}>No incoming attacks recorded</div>}</div></div>}
      {view === "kd feed" && <div className="panel" style={{ padding: 0 }}><SectionHeader title={`KD Attack Feed (${kdEvents.length})`} /><div style={{ maxHeight: "65vh", overflowY: "auto" }}>{kdEvents.map((e,i) => <KDRow key={i} e={e} myKd={myKd} />)}{kdEvents.length === 0 && <div style={{ padding: 24, color: "#475569", textAlign: "center" }}>No KD events recorded</div>}</div></div>}
    </div>
  );
}
