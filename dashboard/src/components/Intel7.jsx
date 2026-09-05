import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { loadUnifiedIntel7 } from "../services/unifiedIntel7";

const CHANNELS = [
  ["ops", "Thieves / Ops"],
  ["offensive_spells", "Offensive Spells"],
  ["self_spells", "Self Spells"],
  ["dragon", "Dragon"],
  ["ritual", "Ritual"],
  ["aid", "Aid"],
  ["attacks", "Attacks"],
];

const fmt = value => value == null || value === "" ? "—" : String(value);
const age = value => {
  if (!value) return "No data";
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return "Unknown";
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m ago`;
};

function Card({ title, children, className = "" }) {
  return <section className={`intel-card ${className}`}><div className="intel-card-title">{title}</div>{children}</section>;
}

function Row({ row }) {
  const details = [row.province_name || row.attacker_province, row.target_name || row.target_province, row.operation || row.action || row.spell_name, row.resource && `${row.resource}: ${fmt(row.amount ?? row.quantity)}`].filter(Boolean);
  return <div className="intel-row">
    <div className="intel-row-main"><span>{details.length ? details.join(" → ") : (row.event_type || row.raw || "Intel event")}</span><small>{age(row.timestamp || row.message_created_at)}</small></div>
    {(row.raw || row.raw_content) && <small className="intel-row-raw">{row.raw || row.raw_content}</small>}
  </div>;
}

export default function Intel7() {
  const [intel, setIntel] = useState(null);
  const [selected, setSelected] = useState("attacks");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try { setError(""); setIntel(await loadUnifiedIntel7()); }
    catch (err) { setError(err?.message || "Unable to load unified Intel 7"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); const timer = setInterval(refresh, 30000); return () => clearInterval(timer); }, [refresh]);

  const current = intel?.currentProvince;
  const provinceRows = useMemo(() => intel?.provinces || [], [intel]);
  const events = intel?.channels?.[selected] || [];
  const freshness = intel?.freshness || {};
  const channelChart = useMemo(() => CHANNELS.map(([id, label]) => ({ channel: label, events: intel?.channels?.[id]?.length || 0 })), [intel]);

  if (loading && !intel) return <div className="panel"><h2>📡 Intel 7</h2><p>Loading unified intelligence...</p></div>;
  if (!intel) return <div className="panel"><h2>📡 Intel 7</h2><p className="error-text">{error}</p><button className="btn btn-ghost" onClick={refresh}>Retry</button></div>;

  return <div className="panel intel7-shell">
    <header className="intel7-header">
      <div><div className="eyebrow">UNIFIED INTELLIGENCE FABRIC</div><h2>📡 Intel 7 <span>· {intel.kd}</span></h2><small>Seven-channel operational intelligence · current context · auto-refresh 30s</small></div>
      <button className="btn btn-ghost" onClick={refresh}>↻ Sync now</button>
    </header>
    {error && <div className="intel-warning">⚠ {error}</div>}

    <div className="intel-stat-grid">
      <Card title="Current Province"><strong>{fmt(current?.name || intel.kingdomName)}</strong><div>{fmt(current?.race)} {current?.personality ? `· ${current.personality}` : ""}</div><div>{fmt(current?.acres)} acres · NW {fmt(current?.nw)}</div></Card>
      <Card title="Kingdom"><strong>{intel.kingdomName}</strong><div>{provinceRows.length} province records</div><div>Loaded {age(intel.loadedAt)}</div></Card>
      <Card title="Latest Event"><strong>{age(freshness.events)}</strong><div>{intel.events.length} event records</div></Card>
      <Card title="Structured Intel"><div>Buildings {age(freshness.buildings)}</div><div>Science {age(freshness.science)}</div><div>Military {age(freshness.military)}</div></Card>
    </div>

    <Card title="Seven-Channel Activity">
      <div className="intel-chart"><ResponsiveContainer width="100%" height={230}><BarChart data={channelChart} margin={{ top: 8, right: 10, left: -15, bottom: 55 }}><CartesianGrid strokeDasharray="3 3" opacity={0.12} /><XAxis dataKey="channel" angle={-28} textAnchor="end" interval={0} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="events" name="Events" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div>
    </Card>

    <Card title="Data Freshness"><div className="freshness-grid">
      {[["Provinces", freshness.provinces], ["Buildings", freshness.buildings], ["Science", freshness.science], ["Military", freshness.military], ["KD stats", freshness.kdStats], ["Intel events", freshness.events], ["Discord ingest", freshness.ingest]].map(([label, value]) => <div className="freshness-item" key={label}><b>{label}</b><div>{age(value)}</div></div>)}
    </div></Card>

    <Card title="Seven Channels"><div className="channel-nav">
      {CHANNELS.map(([id, label]) => <button className={selected === id ? "channel-active" : ""} key={id} onClick={() => setSelected(id)}>{label} <b>{intel.channels[id]?.length || 0}</b></button>)}
    </div>
      <div>{events.length ? events.slice(0, 100).map((row, i) => <Row key={row.id || `${selected}-${i}`} row={row} />) : <p className="muted">No records in this channel for {intel.kd}.</p>}</div>
    </Card>

    <Card title="Current Province Intelligence"><div className="table-scroll"><table className="nexus-table"><thead><tr>{["Province","Acres","NW","Off","Def","oTPA","dTPA","WPA","Thieves","Wizards","Updated"].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{provinceRows.map(p => <tr key={p.id || `${p.kd_code}-${p.name}`}><td>{fmt(p.name)}</td><td>{fmt(p.acres)}</td><td>{fmt(p.nw)}</td><td>{fmt(p.off)}</td><td>{fmt(p.def)}</td><td>{fmt(p.o_tpa)}</td><td>{fmt(p.d_tpa)}</td><td>{fmt(p.r_wpa || p.o_wpa || p.d_wpa)}</td><td>{fmt(p.thieves)}</td><td>{fmt(p.wizards)}</td><td>{age(p.updated_at)}</td></tr>)}</tbody></table></div></Card>

    <Card title="Structured Sources Connected to Intel 7"><div className="source-grid">
      <div>🏗️ Buildings <b>{intel.buildings.length}</b></div><div>🔬 Science <b>{intel.science.length}</b></div><div>🪖 Military <b>{intel.military.length}</b></div><div>📊 KD Stats <b>{intel.kdStats.length}</b></div><div>💬 Raw Ingest <b>{intel.ingest.length}</b></div>
    </div></Card>
  </div>;
}
