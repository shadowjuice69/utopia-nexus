import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";
import { loadNexusConfig, getNexusConfig } from "../services/nexusConfig";

function parseAttackDisplay(a) {
  const raw = String(a.raw_content || a.raw || "").trim();
  const base = {
    attackerProvince: a.attacker_province || a.data?.attackerProvince || a.data?.primary?.attackerProvince || null,
    attackerKingdom: a.attacker_kingdom || a.data?.attackerKingdom || a.data?.primary?.attackerKingdom || null,
    targetProvince: a.target_province || a.data?.targetProvince || a.data?.primary?.targetProvince || null,
    targetKingdom: a.target_kingdom || a.data?.targetKingdom || a.data?.primary?.targetKingdom || null,
    amount: Number(a.amount ?? a.data?.acresCaptured ?? a.data?.acresRecaptured ?? a.data?.primary?.acresCaptured ?? 0) || 0,
    attackType: a.data?.attackType || a.data?.primary?.attackType || a.event_type || "attack",
  };

  if (!raw) return base;

  let m = raw.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+(?:invaded|attacked|assaulted)\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+and\s+(?:captured|took)\s+([\d,]+)\s+acres?/i);
  if (m) return { ...base, attackerProvince: base.attackerProvince || m[1].trim(), attackerKingdom: base.attackerKingdom || m[2], targetProvince: base.targetProvince || m[3].trim(), targetKingdom: base.targetKingdom || m[4], amount: base.amount || Number(m[5].replace(/,/g, "")), attackType: "invasion" };

  m = raw.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+recaptured\s+([\d,]+)\s+acres?\s+of\s+land\s+from\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)/i);
  if (m) return { ...base, attackerProvince: base.attackerProvince || m[1].trim(), attackerKingdom: base.attackerKingdom || m[2], targetProvince: base.targetProvince || m[4].trim(), targetKingdom: base.targetKingdom || m[5], amount: base.amount || Number(m[3].replace(/,/g, "")), attackType: "recapture" };

  m = raw.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+captured\s+([\d,]+)\s+acres?\s+of\s+land\s+from\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)/i);
  if (m) return { ...base, attackerProvince: base.attackerProvince || m[1].trim(), attackerKingdom: base.attackerKingdom || m[2], targetProvince: base.targetProvince || m[4].trim(), targetKingdom: base.targetKingdom || m[5], amount: base.amount || Number(m[3].replace(/,/g, "")), attackType: "invasion" };

  m = raw.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+ambushed\s+armies\s+from\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+and\s+took\s+([\d,]+)\s+acres?/i);
  if (m) return { ...base, attackerProvince: base.attackerProvince || m[1].trim(), attackerKingdom: base.attackerKingdom || m[2], targetProvince: base.targetProvince || m[3].trim(), targetKingdom: base.targetKingdom || m[4], amount: base.amount || Number(m[5].replace(/,/g, "")), attackType: "ambush" };

  m = raw.match(/^⚔\s+(.+?)\s*\((\d+:\d+)\)\s*[—-]/i);
  const t = raw.match(/Your forces arrive at\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)/i);
  const acres = raw.match(/(?:army has taken|Your army has recaptured|Your army has taken|captured|took)\s+([\d,]+)\s+acres/i);
  if (m && t) return { ...base, attackerProvince: base.attackerProvince || m[1].trim(), attackerKingdom: base.attackerKingdom || m[2], targetProvince: base.targetProvince || t[1].trim(), targetKingdom: base.targetKingdom || t[2], amount: base.amount || (acres ? Number(acres[1].replace(/,/g, "")) : 0), attackType: /recaptured/i.test(raw) ? "recapture" : base.attackType };

  return base;
}

export default function AttackLog() {
  const [attacks, setAttacks] = useState([]);
  const [kd, setKd] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let live = true;
    async function load() {
      const c = await loadNexusConfig(true);
      const k = c?.kd || getNexusConfig().kd || "";
      if (!k) { if (live) setLoading(false); return; }
      const { data } = await supabase.from("intel7_events").select("*").eq("kd_code", k).eq("channel_type", "attacks").order("timestamp", { ascending: false }).limit(200);
      if (live) { setKd(k); setAttacks(data || []); setLoading(false); }
    }
    load();
    const iv = setInterval(load, 30000);
    return () => { live = false; clearInterval(iv); };
  }, []);

  const rows = attacks.map(a => ({ raw: a, parsed: parseAttackDisplay(a) }));
  const outgoing = r => r.parsed.attackerKingdom === kd || r.raw.data?.direction === "outgoing";
  const incoming = r => r.parsed.targetKingdom === kd && r.parsed.attackerKingdom !== kd;
  const shown = rows.filter(r => (filter === "outgoing" ? outgoing(r) : filter === "incoming" ? incoming(r) : true) && (!search || JSON.stringify(r.raw).toLowerCase().includes(search.toLowerCase())));

  if (loading) return <div className="loading">⏳ Loading current Attack Log...</div>;
  return (
    <div className="intel-panel"><div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><h2>⚔️ Attack Log · {kd}</h2><span>{attacks.length} current records · refresh 30s</span></div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>{["all", "outgoing", "incoming"].map(f => <button key={f} onClick={() => setFilter(f)}>{f}</button>)}<input placeholder="🔍 Search every field..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} /></div>
      {shown.length ? shown.map(({ raw, parsed }) => <details key={raw.id} style={{ padding: 10, marginBottom: 6, border: "1px solid rgba(255,255,255,.08)", borderRadius: 8 }}>
        <summary><b>{parsed.attackType || raw.event_type || "attack"}</b> · {parsed.attackerProvince || "?"} ({parsed.attackerKingdom || "?"}) → {parsed.targetProvince || "?"} ({parsed.targetKingdom || "?"}) · {raw.timestamp ? new Date(raw.timestamp).toLocaleString() : "—"}{parsed.amount ? ` · ${parsed.amount.toLocaleString()} acres` : ""}</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>{JSON.stringify(raw, null, 2)}</pre>
      </details>) : <p>No current attacks recorded.</p>}
    </div></div>
  );
}
