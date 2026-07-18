import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function parseNW(nw) {
  if (!nw) return 0;
  return parseFloat(nw.toString().replace(/,/g, "")) || 0;
}

function roleEmoji(role) {
  if (!role) return "👤";
  const r = role.toLowerCase();
  if (r.includes("attack")) return "⚔️";
  if (r.includes("mage")) return "🔮";
  if (r.includes("thief")) return "🗡️";
  if (r.includes("hybrid")) return "⚡";
  return "👤";
}

function roleColor(role) {
  if (!role) return "#475569";
  const r = role.toLowerCase();
  if (r.includes("attack")) return "#38bdf8";
  if (r.includes("mage")) return "#a78bfa";
  if (r.includes("thief")) return "#facc15";
  if (r.includes("hybrid")) return "#fb923c";
  return "#475569";
}

function MemberModal({ member, onClose }) {
  if (!member) return null;
  const fields = [
    { label: "NW", key: "nw", color: "#38bdf8" },
    { label: "Acres", key: "acres", color: "#4ade80" },
    { label: "Offense", key: "off", color: "#f87171" },
    { label: "Defense", key: "def", color: "#fb923c" },
    { label: "BE%", key: "be", color: "#facc15" },
    { label: "Wages%", key: "wages", color: "#38bdf8" },
    { label: "Stealth", key: "stlth", color: "#a78bfa" },
    { label: "Mana%", key: "mana", color: "#a78bfa" },
    { label: "oTPA", key: "o_tpa", color: "#38bdf8" },
    { label: "dTPA", key: "d_tpa", color: "#fb923c" },
    { label: "oWPA", key: "o_wpa", color: "#38bdf8" },
    { label: "dWPA", key: "d_wpa", color: "#fb923c" },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{member.name}</h2>
            <p className="modal-sub">{member.combo || member.race || "Unknown"} • {member.slot ? `Slot ${member.slot}` : ""}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ color: roleColor(member.play_role), fontSize: 14, fontWeight: 600 }}>
              {roleEmoji(member.play_role)} {member.play_role || "No role"}
            </span>
            {member.timezone && <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>{member.timezone}</p>}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-stats">
          {fields.map(f => member[f.key] ? (
            <div key={f.key} className="modal-stat">
              <span className="modal-stat-label">{f.label}</span>
              <strong className="modal-stat-value" style={{ color: f.color }}>{member[f.key]}</strong>
            </div>
          ) : null)}
        </div>

        {member.good_spells && (
          <div className="modal-row">
            <span className="modal-row-label">✨ Spells:</span>
            <span className="modal-row-value">{member.good_spells}</span>
          </div>
        )}
        {member.bad_spells && (
          <div className="modal-row" style={{ borderLeftColor: "#f87171" }}>
            <span className="modal-row-label">💀 Enemy Spells:</span>
            <span className="modal-row-value" style={{ color: "#f87171" }}>{member.bad_spells}</span>
          </div>
        )}
        {member.map && (
          <div className="modal-row">
            <span className="modal-row-label">🗺️ MAP:</span>
            <span className="modal-row-value">{member.map}</span>
          </div>
        )}
        {member.wave_times && (
          <div className="modal-row">
            <span className="modal-row-label">🌊 Wave Times:</span>
            <span className="modal-row-value">{member.wave_times} ({member.timezone})</span>
          </div>
        )}
        {member.notes && (
          <div className="modal-row">
            <span className="modal-row-label">📝 Notes:</span>
            <span className="modal-row-value">{member.notes}</span>
          </div>
        )}
        {member.coordinates && (
          <div className="modal-row">
            <span className="modal-row-label">📍 Kingdom:</span>
            <span className="modal-row-value">{member.coordinates}</span>
          </div>
        )}
        <div className="modal-footer">
          Last updated: {member.updated_at ? new Date(member.updated_at).toUTCString().slice(0, 25) : "Unknown"}
        </div>
      </div>
    </div>
  );
}

export default function KingdomOverview() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    const { data } = await supabase
      .from("provinces")
      .select("*")
      .order("nw", { ascending: false });
    setMembers(data || []);
    setLoading(false);
  }

  if (loading) return <div className="loading">⏳ Loading Kingdom...</div>;

  const registered = members.filter(m => m.discord_id);
  const withNW = members.filter(m => m.nw);
  const totalNW = withNW.reduce((s, m) => s + parseNW(m.nw), 0);
  const totalAcres = members.reduce((s, m) => s + parseNW(m.acres), 0);
  const totalOff = members.filter(m => m.off).reduce((s, m) => s + parseNW(m.off), 0);
  const totalDef = members.filter(m => m.def).reduce((s, m) => s + parseNW(m.def), 0);
  const avgBE = members.filter(m => m.be).length
    ? Math.round(members.filter(m => m.be).reduce((s, m) => s + parseNW(m.be), 0) / members.filter(m => m.be).length)
    : null;

  const roleBreakdown = {};
  for (const m of registered) {
    const role = m.play_role || "Unknown";
    roleBreakdown[role] = (roleBreakdown[role] || 0) + 1;
  }

  const nwChartData = withNW
    .sort((a, b) => parseNW(b.nw) - parseNW(a.nw))
    .map(m => ({ name: m.name?.split(" ")[0] || "?", nw: parseNW(m.nw) }));

  return (
    <div className="kingdom-overview">
      <MemberModal member={selected} onClose={() => setSelected(null)} />

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Total NW</span>
          <strong className="stat-value" style={{ color: "#38bdf8", fontSize: 24 }}>{totalNW ? totalNW.toLocaleString() : "?"}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Acres</span>
          <strong className="stat-value" style={{ color: "#4ade80", fontSize: 24 }}>{totalAcres ? totalAcres.toLocaleString() : "?"}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Offense</span>
          <strong className="stat-value" style={{ color: "#f87171", fontSize: 24 }}>{totalOff ? totalOff.toLocaleString() : "?"}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Defense</span>
          <strong className="stat-value" style={{ color: "#fb923c", fontSize: 24 }}>{totalDef ? totalDef.toLocaleString() : "?"}</strong>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Members</span>
          <strong className="stat-value" style={{ color: "#38bdf8" }}>{registered.length}</strong>
          <span className="stat-sub">{members.length} tracked total</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg NW</span>
          <strong className="stat-value" style={{ color: "#facc15" }}>
            {withNW.length ? Math.round(totalNW / withNW.length).toLocaleString() : "?"}
          </strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg BE</span>
          <strong className="stat-value" style={{ color: avgBE >= 100 ? "#4ade80" : "#f87171" }}>
            {avgBE ? `${avgBE}%` : "?"}
          </strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Coordinates</span>
          <strong className="stat-value" style={{ color: "#a78bfa" }}>4:9</strong>
        </div>
      </div>

      {nwChartData.length > 0 && (
        <div className="panel chart-panel">
          <h2>📊 Province NW Comparison</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={nwChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #38bdf8", borderRadius: 8 }} formatter={v => v.toLocaleString()} />
              <Bar dataKey="nw" fill="#38bdf8" radius={[4, 4, 0, 0]} name="NW" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="panel">
        <h2>⚔️ Role Breakdown</h2>
        <div className="role-breakdown">
          {Object.entries(roleBreakdown).map(([role, count]) => (
            <div key={role} className="role-item">
              <span className="role-emoji">{roleEmoji(role)}</span>
              <span className="role-name" style={{ color: roleColor(role) }}>{role}</span>
              <span className="role-count">{count}</span>
              <div className="role-bar-bg">
                <div className="role-bar-fill" style={{ width: `${(count / registered.length) * 100}%`, background: roleColor(role) }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>👥 Member Roster ({members.length}) <span style={{ color: "#475569", fontSize: 12, fontWeight: 400 }}>— click to expand</span></h2>
        <div className="roster-table-wrap">
          <table className="roster-table">
            <thead>
              <tr>
                <th>Province</th>
                <th>Combo</th>
                <th>NW</th>
                <th>Acres</th>
                <th>Off</th>
                <th>Def</th>
                <th>BE</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="roster-row" onClick={() => setSelected(m)}>
                  <td style={{ color: m.discord_id ? "#e2e8f0" : "#475569" }}>
                    {m.discord_id ? "✅ " : ""}{m.name}
                  </td>
                  <td style={{ color: "#94a3b8" }}>{m.combo || m.race || "?"}</td>
                  <td style={{ color: "#38bdf8" }}>{m.nw || "—"}</td>
                  <td>{m.acres || "—"}</td>
                  <td style={{ color: "#f87171" }}>{m.off || "—"}</td>
                  <td style={{ color: "#fb923c" }}>{m.def || "—"}</td>
                  <td style={{ color: parseNW(m.be) >= 100 ? "#4ade80" : "#facc15" }}>{m.be ? `${m.be}%` : "—"}</td>
                  <td style={{ color: roleColor(m.play_role) }}>{roleEmoji(m.play_role)} {m.play_role || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
