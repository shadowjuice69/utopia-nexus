import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

function StatCard({ label, value, color = "#38bdf8", sub }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <strong className="stat-value" style={{ color }}>{value}</strong>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

function ThreatBadge({ score }) {
  if (score >= 10) return <span className="threat critical">🔴 CRITICAL</span>;
  if (score >= 6) return <span className="threat high">🟠 HIGH</span>;
  if (score >= 3) return <span className="threat medium">🟡 MEDIUM</span>;
  return <span className="threat low">🟢 LOW</span>;
}

export default function WarRoom() {
  const [attacks, setAttacks] = useState([]);
  const [ops, setOps] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [threatData, setThreatData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [{ data: atkData }, { data: opsData }] = await Promise.all([
      supabase.from("attacks").select("*").gte("timestamp", since).order("timestamp", { ascending: false }),
      supabase.from("hostile_ops").select("*").gte("timestamp", since).order("timestamp", { ascending: false }),
    ]);

    const atks = atkData || [];
    const opsList = opsData || [];

    setAttacks(atks);
    setOps(opsList);

    // Build hourly chart data
    const hourMap = {};
    for (let i = 23; i >= 0; i--) {
      const h = new Date(Date.now() - i * 60 * 60 * 1000);
      const key = `${h.getUTCHours()}:00`;
      hourMap[key] = { hour: key, attacks: 0, ops: 0 };
    }
    for (const a of atks) {
      const h = new Date(a.timestamp).getUTCHours() + ":00";
      if (hourMap[h]) hourMap[h].attacks++;
    }
    for (const o of opsList) {
      const h = new Date(o.timestamp).getUTCHours() + ":00";
      if (hourMap[h]) hourMap[h].ops++;
    }
    setChartData(Object.values(hourMap));

    // Build threat meter
    const threat = {};
    for (const op of opsList) {
      const kd = op.target_kingdom || "Unknown";
      if (!threat[kd]) threat[kd] = { kd, ops: 0, attacks: 0, successfulOps: 0 };
      threat[kd].ops++;
      if (op.success) threat[kd].successfulOps++;
    }
    for (const a of atks) {
      const kd = a.target_kingdom || "Unknown";
      if (!threat[kd]) threat[kd] = { kd, ops: 0, attacks: 0, successfulOps: 0 };
      threat[kd].attacks++;
    }
    setThreatData(
      Object.values(threat)
        .sort((a, b) => (b.ops + b.attacks * 2) - (a.ops + a.attacks * 2))
        .slice(0, 6)
    );

    setLoading(false);
  }

  const successAtks = attacks.filter(a => a.acres_captured > 0).length;
  const successOps = ops.filter(o => o.success).length;
  const successRate = attacks.length ? Math.round((successAtks / attacks.length) * 100) : 0;

  const recentOps = ops.slice(0, 8);

  if (loading) return <div className="loading">⏳ Loading War Room...</div>;

  return (
    <div className="war-room">

      {/* Stats Row */}
      <div className="stats-row">
        <StatCard label="Attacks (24h)" value={attacks.length} color="#38bdf8" />
        <StatCard label="Success Rate" value={`${successRate}%`} color={successRate >= 50 ? "#4ade80" : "#f87171"} />
        <StatCard label="Hostile Ops" value={ops.length} color="#facc15" />
        <StatCard label="Ops Successful" value={successOps} color="#fb923c" />
      </div>

      {/* Activity Chart */}
      <div className="panel chart-panel">
        <h2>📊 24h Activity</h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="atkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="opsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#facc15" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#facc15" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 10 }} />
            <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #38bdf8", borderRadius: 8 }} />
            <Area type="monotone" dataKey="attacks" stroke="#38bdf8" fill="url(#atkGrad)" name="Attacks" />
            <Area type="monotone" dataKey="ops" stroke="#facc15" fill="url(#opsGrad)" name="Ops" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Threat Meter */}
      <div className="panel">
        <h2>⚠️ Threat Meter</h2>
        {threatData.length === 0 ? (
          <p className="empty">✅ No hostile activity in last 24h</p>
        ) : (
          <table className="threat-table">
            <thead>
              <tr>
                <th>Kingdom</th>
                <th>Ops</th>
                <th>Attacks</th>
                <th>Threat</th>
              </tr>
            </thead>
            <tbody>
              {threatData.map(t => (
                <tr key={t.kd}>
                  <td>{t.kd}</td>
                  <td>{t.ops} <span className="dim">({t.successfulOps} hit)</span></td>
                  <td>{t.attacks}</td>
                  <td><ThreatBadge score={t.ops + t.attacks * 2} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent Ops Feed */}
      <div className="panel">
        <h2>🗡️ Recent Hostile Ops</h2>
        {recentOps.length === 0 ? (
          <p className="empty">No ops recorded yet</p>
        ) : (
          <div className="ops-feed">
            {recentOps.map((op, i) => (
              <div key={i} className={`op-item ${op.success ? "success" : "fail"}`}>
                <span className="op-type">{op.operation}</span>
                <span className="op-target">{op.attacker_province} → {op.target_province}</span>
                <span className="op-result">{op.success ? "✅ Hit" : "❌ Fail"}</span>
                <span className="op-time">{new Date(op.timestamp).toUTCString().slice(17, 22)} UTC</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
