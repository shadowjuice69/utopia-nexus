import { useCallback, useEffect, useMemo, useState } from "react";
import { loadUnifiedIntel7 } from "../services/unifiedIntel7";

const CHANNELS = [
  ["ops", "🕵️ Thieves / Ops"],
  ["offensive_spells", "🔥 Offensive Spells"],
  ["self_spells", "✨ Self Spells"],
  ["dragon", "🐉 Dragon"],
  ["ritual", "🩸 Ritual"],
  ["aid", "🤝 Aid"],
  ["attacks", "⚔️ Attacks"],
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

function Card({ title, children }) {
  return <section style={{ background: "rgba(15,23,42,.72)", border: "1px solid rgba(148,163,184,.2)", borderRadius: 12, padding: 14, minWidth: 0 }}>{title && <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>{title}</h3>}{children}</section>;
}

function Row({ row }) {
  const details = [row.province_name || row.attacker_province, row.target_name || row.target_province, row.operation || row.action || row.spell_name, row.resource && `${row.resource}: ${fmt(row.amount ?? row.quantity)}`].filter(Boolean);
  return <div style={{ padding: "9px 0", borderTop: "1px solid rgba(148,163,184,.12)" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><span>{details.length ? details.join(" → ") : (row.event_type || row.raw || "Intel event")}</span><small style={{ opacity: .65, whiteSpace: "nowrap" }}>{age(row.timestamp || row.message_created_at)}</small></div>
    {(row.raw || row.raw_content) && <small style={{ display: "block", opacity: .62, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.raw || row.raw_content}</small>}
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

  if (loading && !intel) return <div className="panel"><h2>📡 Intel 7</h2><p>Loading unified intelligence...</p></div>;
  if (!intel) return <div className="panel"><h2>📡 Intel 7</h2><p style={{ color: "#f87171" }}>{error}</p><button onClick={refresh}>Retry</button></div>;

  return <div className="panel" style={{ display: "grid", gap: 14 }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div><h2 style={{ margin: 0 }}>📡 Intel 7 — {intel.kd}</h2><small style={{ opacity: .7 }}>Unified current-age intelligence fabric · auto-refresh 30s</small></div>
      <button onClick={refresh}>↻ Refresh</button>
    </header>
    {error && <div style={{ color: "#fbbf24" }}>⚠ {error}</div>}

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
      <Card title="Current Province"><strong>{fmt(current?.name || intel.kingdomName)}</strong><div>{fmt(current?.race)} {current?.personality ? `· ${current.personality}` : ""}</div><div>{fmt(current?.acres)} acres · NW {fmt(current?.nw)}</div></Card>
      <Card title="Kingdom"><strong>{intel.kingdomName}</strong><div>{provinceRows.length} province records</div><div>Loaded {age(intel.loadedAt)}</div></Card>
      <Card title="Latest Event"><strong>{age(freshness.events)}</strong><div>{intel.events.length} event records</div></Card>
      <Card title="Structured Intel"><div>Buildings {age(freshness.buildings)}</div><div>Science {age(freshness.science)}</div><div>Military {age(freshness.military)}</div></Card>
    </div>

    <Card title="Data Freshness"><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
      {[["Provinces", freshness.provinces], ["Buildings", freshness.buildings], ["Science", freshness.science], ["Military", freshness.military], ["KD stats", freshness.kdStats], ["Intel events", freshness.events], ["Discord ingest", freshness.ingest]].map(([label, value]) => <div key={label} style={{ padding: 8, background: "rgba(30,41,59,.55)", borderRadius: 8 }}><b>{label}</b><div style={{ opacity: .7 }}>{age(value)}</div></div>)}
    </div></Card>

    <Card title="Seven Channels"><div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
      {CHANNELS.map(([id, label]) => <button key={id} onClick={() => setSelected(id)} style={{ fontWeight: selected === id ? 700 : 400, opacity: selected === id ? 1 : .72 }}>{label} ({intel.channels[id]?.length || 0})</button>)}
    </div>
      <div style={{ marginTop: 8 }}>{events.length ? events.slice(0, 100).map((row, i) => <Row key={row.id || `${selected}-${i}`} row={row} />) : <p style={{ opacity: .65 }}>No records in this channel for {intel.kd}.</p>}</div>
    </Card>

    <Card title="Current Province Intelligence"><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr>{["Province","Acres","NW","Off","Def","oTPA","dTPA","WPA","Thieves","Wizards","Updated"].map(h => <th key={h} style={{ textAlign: "left", padding: 7, borderBottom: "1px solid rgba(148,163,184,.2)" }}>{h}</th>)}</tr></thead><tbody>{provinceRows.map(p => <tr key={p.id || `${p.kd_code}-${p.name}`}><td style={{ padding: 7 }}>{fmt(p.name)}</td><td>{fmt(p.acres)}</td><td>{fmt(p.nw)}</td><td>{fmt(p.off)}</td><td>{fmt(p.def)}</td><td>{fmt(p.o_tpa)}</td><td>{fmt(p.d_tpa)}</td><td>{fmt(p.r_wpa || p.o_wpa || p.d_wpa)}</td><td>{fmt(p.thieves)}</td><td>{fmt(p.wizards)}</td><td>{age(p.updated_at)}</td></tr>)}</tbody></table></div></Card>

    <Card title="Structured Sources Connected to Intel 7"><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
      <div>🏗️ Buildings: <b>{intel.buildings.length}</b></div><div>🔬 Science: <b>{intel.science.length}</b></div><div>🪖 Military: <b>{intel.military.length}</b></div><div>📊 KD Stats: <b>{intel.kdStats.length}</b></div><div>💬 Raw Ingest: <b>{intel.ingest.length}</b></div>
    </div></Card>
  </div>;
}
