import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "../services/supabase";

const MY_KD = "6:9";

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

function AttackRow({ a, myKd }) {
  const out = a.attacker_kingdom === myKd;
  const acres = Number(a.amount) || 0;
  const data = a.data || {};
  const acreColor = out ? "#4ade80" : "#f87171";

  return (
    <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "#475569", fontSize: 11, minWidth: 80 }}>
          {new Date(a.timestamp).toLocaleDateString()}
        </span>
        {acres > 0 && (
          <span style={{ fontSize: 12, fontWeight: 600, color: acreColor }}>
            {out ? "+" : "-"}{acres} acres
          </span>
        )}
        <span style={{ fontSize: 12, color: "#64748b", textTransform: "capitalize" }}>
          {a.event_type}
        </span>
      </div>
      <div style={{ fontSize: 13, color: "#cbd5e1", display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{ color: out ? "#4ade80" : "#f87171", fontWeight: 600 }}>
          {a.attacker_province || "?"}{" "}
          <span style={{ color: "#475569", fontWeight: 400 }}>({a.attacker_kingdom})</span>
        </span>
        <span style={{ color: "#475569" }}>→</span>
        <span style={{ color: "#38bdf8", fontWeight: 600 }}>
          {a.target_province || "?"}{" "}
          <span style={{ color: "#475569", fontWeight: 400 }}>({a.target_kingdom})</span>
        </span>
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
        {data.kills > 0 && <span>Killed: <strong style={{ color: "#f87171" }}>{Number(data.kills).toLocaleString()}</strong></span>}
        {data.credits > 0 && <span>Credits: <strong style={{ color: "#4ade80" }}>{Number(data.credits).toLocaleString()}</strong></span>}
        {data.peasants > 0 && <span>Peasants: <strong style={{ color: "#38bdf8" }}>{Number(data.peasants).toLocaleString()}</strong></span>}
        {data.return_days > 0 && <span>Returns: <strong style={{ color: "#facc15" }}>{data.return_days}d</strong></span>}
        {data.troops_lost && Object.keys(data.troops_lost).length > 0 && (
          <span style={{ color: "#f87171" }}>
            Lost: {Object.entries(data.troops_lost).map(([k, v]) => `${v} ${k}`).join(", ")}
          </span>
        )}
      </div>
    </div>
  );
}

export default function AttackSummary() {
  const [attacks, setAttacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("overview");

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 60000);
    return () => clearInterval(iv);
  }, []);

  async function fetchAll() {
    const { data } = await supabase
      .from("intel7_events")
      .select("*")
      .eq("channel_type", "attacks")
      .order("timestamp", { ascending: true });
    setAttacks(data || []);
    setLoading(false);
  }

  const outgoing = attacks.filter(a => a.attacker_kingdom === MY_KD);
  const incoming = attacks.filter(a => a.target_kingdom === MY_KD && a.attacker_kingdom !== MY_KD);

  const totalAcresGained = outgoing.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const totalAcresLost   = incoming.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const totalKills       = outgoing.reduce((s, a) => s + (Number(a.data?.kills) || 0), 0);
  const totalCredits     = outgoing.reduce((s, a) => s + (Number(a.data?.credits) || 0), 0);
  const totalPeasants    = outgoing.reduce((s, a) => s + (Number(a.data?.peasants) || 0), 0);
  const totalLost        = outgoing.reduce((s, a) => {
    const t = a.data?.troops_lost || {};
    return s + Object.values(t).reduce((acc, v) => acc + (Number(v) || 0), 0);
  }, 0);

  // Per-target breakdown
  const byTarget = {};
  outgoing.forEach(a => {
    const key = `${a.target_province} (${a.target_kingdom})`;
    if (!byTarget[key]) byTarget[key] = { name: a.target_province, kd: a.target_kingdom, attacks: 0, acres: 0, kills: 0, credits: 0, lost: 0 };
    byTarget[key].attacks++;
    byTarget[key].acres += Number(a.amount) || 0;
    byTarget[key].kills += Number(a.data?.kills) || 0;
    byTarget[key].credits += Number(a.data?.credits) || 0;
    const lostTroops = a.data?.troops_lost || {};
    byTarget[key].lost += Object.values(lostTroops).reduce((acc, v) => acc + (Number(v) || 0), 0);
  });
  const targets = Object.values(byTarget).sort((a, b) => b.acres - a.acres);

  // Chart data — cumulative acres by target kingdom over time
  const kdSet = new Set(outgoing.map(a => a.target_kingdom).filter(Boolean));
  const kds = [...kdSet];
  const buckets = {};
  for (const a of outgoing) {
    const key = new Date(a.timestamp).toISOString().slice(0, 13);
    if (!buckets[key]) buckets[key] = { time: key };
    const kd = a.target_kingdom || "Unknown";
    buckets[key][kd] = (buckets[key][kd] || 0) + (Number(a.amount) || 0);
  }
  for (const a of incoming) {
    const key = new Date(a.timestamp).toISOString().slice(0, 13);
    if (!buckets[key]) buckets[key] = { time: key };
    buckets[key]["Incoming"] = (buckets[key]["Incoming"] || 0) + (Number(a.amount) || 0);
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
  const KD_COLORS = ["#38bdf8", "#4ade80", "#a78bfa", "#fbbf24", "#fb923c", "#34d399", "#e879f9"];

  const VIEWS = ["overview", "outgoing", "incoming"];

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
            <StatCard label="Acres Gained" value={`+${totalAcresGained.toLocaleString()}`} color="#4ade80" />
            <StatCard label="Incoming Attacks" value={incoming.length} color="#f87171" />
            <StatCard label="Acres Lost" value={`-${totalAcresLost.toLocaleString()}`} color="#f87171" />
          </div>
          <div className="stats-row">
            <StatCard label="Enemies Killed" value={totalKills.toLocaleString()} color="#fb923c" />
            <StatCard label="Troops Lost" value={totalLost.toLocaleString()} color="#ef4444" />
            <StatCard label="Credits Gained" value={totalCredits.toLocaleString()} color="#4ade80" />
            <StatCard label="Peasants Settled" value={totalPeasants.toLocaleString()} color="#38bdf8" />
          </div>
          <div className="stats-row">
            <StatCard label="Net Acres" value={(totalAcresGained - totalAcresLost).toLocaleString()} color={totalAcresGained >= totalAcresLost ? "#4ade80" : "#f87171"} />
          </div>

          {chartData.length > 0 && (
            <div className="panel" style={{ marginTop: 12 }}>
              <h2>📈 Cumulative Land Change</h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#475569" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#475569" }} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #38bdf8", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#94a3b8" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {kds.map((kd, i) => (
                    <Line key={kd} type="monotone" dataKey={kd} stroke={KD_COLORS[i % KD_COLORS.length]} strokeWidth={2} dot={false} />
                  ))}
                  <Line key="Incoming" type="monotone" dataKey="Incoming" stroke="#f87171" strokeWidth={2} strokeDasharray="4 2" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="panel" style={{ padding: 0, marginTop: 12 }}>
            <SectionHeader title="Per-Target Breakdown" />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>
                    {["Target", "KD", "Attacks", "Acres", "Kills", "Lost", "Credits"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {targets.map((t, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "8px 12px", color: "#e2e8f0", fontWeight: 600 }}>{t.name}</td>
                      <td style={{ padding: "8px 12px", color: "#64748b" }}>{t.kd}</td>
                      <td style={{ padding: "8px 12px", color: "#38bdf8" }}>{t.attacks}</td>
                      <td style={{ padding: "8px 12px", color: "#4ade80" }}>+{t.acres.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px", color: "#f87171" }}>{t.kills.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px", color: "#fb923c" }}>{t.lost.toLocaleString()}</td>
                      <td style={{ padding: "8px 12px", color: "#4ade80" }}>{t.credits.toLocaleString()}</td>
                    </tr>
                  ))}
                  {targets.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#475569" }}>No outgoing attacks yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {view === "outgoing" && (
        <div className="panel" style={{ padding: 0 }}>
          <SectionHeader title={`Outgoing Attacks (${outgoing.length})`} />
          <div style={{ maxHeight: "65vh", overflowY: "auto" }}>
            {[...outgoing].reverse().map((a, i) => <AttackRow key={i} a={a} myKd={MY_KD} />)}
            {outgoing.length === 0 && <div style={{ padding: 24, color: "#475569", textAlign: "center" }}>No outgoing attacks recorded</div>}
          </div>
        </div>
      )}

      {view === "incoming" && (
        <div className="panel" style={{ padding: 0 }}>
          <SectionHeader title={`Incoming Attacks (${incoming.length})`} />
          <div style={{ maxHeight: "65vh", overflowY: "auto" }}>
            {[...incoming].reverse().map((a, i) => <AttackRow key={i} a={a} myKd={MY_KD} />)}
            {incoming.length === 0 && <div style={{ padding: 24, color: "#475569", textAlign: "center" }}>No incoming attacks recorded</div>}
          </div>
        </div>
      )}
    </div>
  );
}
