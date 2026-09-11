import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";
import { loadNexusConfig, getNexusConfig } from "../services/nexusConfig";

const REFRESH_MS = 30000;
const EMPTY = "Not captured";

function clean(v) { return String(v ?? "").trim(); }
function num(v) {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}
function fmt(v) { const n = num(v); return n == null ? EMPTY : n.toLocaleString(); }
function val(v) { return clean(v) || EMPTY; }
function kdNorm(v) { return clean(v).replace(/^kingdom\s*/i, "").replace(/\s+/g, "").toLowerCase(); }

async function latestRows(table, kd) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("kd_code", kd)
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  const seen = new Set();
  return (data || []).filter(row => {
    const p = clean(row.province).toLowerCase();
    if (!p || p === "unknown") return false;
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
}

function parseKingdomCapture(rawHtml, expectedKd) {
  if (!rawHtml) return null;
  try {
    const doc = new DOMParser().parseFromString(String(rawHtml), "text/html");
    const heading = [...doc.querySelectorAll(".change-kingdom-heading")].find(el => /\(\s*\d+:\d+\s*\)/.test(el.textContent || ""));
    const headingText = clean(heading?.textContent);
    const kdMatch = headingText.match(/\((\d+:\d+)\)/);
    const captureKd = kdMatch?.[1] || null;
    if (!captureKd || kdNorm(captureKd) !== kdNorm(expectedKd)) return null;

    const nameMatch = headingText.match(/kingdom of\s+(.+?)\s*\(\d+:\d+\)/i);
    const kdName = nameMatch ? clean(nameMatch[1]) : null;
    const stats = {};
    for (const row of doc.querySelectorAll("table.two-column-stats tr")) {
      const cells = [...row.querySelectorAll("th,td")].map(el => clean(el.textContent));
      for (let i = 0; i + 1 < cells.length; i += 2) stats[cells[i].toLowerCase()] = cells[i + 1];
    }

    const table = [...doc.querySelectorAll("table.tablesorter")].find(t => /Province/i.test(t.textContent || ""));
    const rows = [];
    for (const tr of table?.querySelectorAll("tbody tr") || []) {
      const cells = [...tr.querySelectorAll("td")].map(el => clean(el.textContent));
      if (cells.length < 7) continue;
      const slot = num(cells[0]);
      const province = clean(cells[1]).replace(/\s*\(M\)|\s*\(S\)|\*+$/gi, "").trim();
      const race = clean(cells[2]);
      if (!slot || !province || !race || !/^\d/.test(cells[3])) continue;
      rows.push({
        id: `kingdom-${captureKd}-${slot}`,
        province,
        race,
        personality: null,
        land: num(cells[3]),
        networth: num(cells[4]),
        offense: null,
        defense: null,
        peasants: null,
        thieves: null,
        wizards: null,
        be: null,
        intel_age: null,
        kd_code: captureKd,
        updated_at: new Date().toISOString(),
        kingdomCapture: true,
      });
    }

    return {
      kd_code: captureKd,
      kd_name: kdName,
      total_provinces: num(stats["total provinces"]),
      total_nw: num(stats["total networth"]),
      total_land: num(stats["total land"]),
      nw_rank: stats["net worth rank"] || null,
      land_rank: stats["land rank"] || null,
      stance: stats["stance"] || null,
      rows,
    };
  } catch {
    return null;
  }
}

async function latestKingdomCapture(kd) {
  const { data, error } = await supabase
    .from("intel_page_ingest")
    .select("received_at,kd_code,province,raw_text,parsed")
    .eq("data_type", "kingdom")
    .eq("kd_code", kd)
    .order("received_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  for (const capture of data || []) {
    const parsed = parseKingdomCapture(capture.raw_text, kd);
    if (parsed?.rows?.length) return { ...parsed, received_at: capture.received_at };
  }
  return null;
}

function mergeData(throne, state, military, buildings, kingdomRows = []) {
  const byProvince = new Map();
  for (const row of kingdomRows) byProvince.set(clean(row.province).toLowerCase(), { ...row, state: null, military: null, buildings: null });
  for (const row of throne) {
    const key = clean(row.province).toLowerCase();
    const existing = byProvince.get(key);
    byProvince.set(key, { ...(existing || {}), ...row, state: existing?.state || null, military: existing?.military || null, buildings: existing?.buildings || null, kingdomCapture: existing?.kingdomCapture || false });
  }
  for (const row of state) {
    const key = clean(row.province).toLowerCase();
    if (byProvince.has(key)) byProvince.get(key).state = row;
  }
  for (const row of military) {
    const key = clean(row.province).toLowerCase();
    if (byProvince.has(key)) byProvince.get(key).military = row;
  }
  for (const row of buildings) {
    const key = clean(row.province).toLowerCase();
    if (byProvince.has(key)) byProvince.get(key).buildings = row;
  }
  return [...byProvince.values()].sort((a, b) => clean(a.province).localeCompare(clean(b.province)));
}

function age(updatedAt) {
  if (!updatedAt) return EMPTY;
  const mins = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60000));
  return mins < 1 ? "<1m" : `${mins}m`;
}

export default function KingdomOverview() {
  const [config, setConfig] = useState(getNexusConfig());
  const [rows, setRows] = useState([]);
  const [kingdom, setKingdom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const c = await loadNexusConfig(true);
      const kd = clean(c?.kd);
      const province = clean(c?.province);
      if (!kd || !province) throw new Error("Your kingdom/province identity is not linked.");
      setConfig(c);

      const [throne, state, military, buildings, kingdomResult, kingdomCapture] = await Promise.all([
        latestRows("intel_throne", kd),
        latestRows("intel_state", kd),
        latestRows("intel_military", kd),
        latestRows("intel_buildings", kd),
        supabase.from("kingdoms").select("kd_code,kd_id,kd_name,total_nw,total_land,total_provinces,nw_rank,land_rank,stance,updated_at").eq("kd_code", kd).maybeSingle(),
        latestKingdomCapture(kd),
      ]);
      if (kingdomResult.error) throw kingdomResult.error;

      const merged = mergeData(throne, state, military, buildings, kingdomCapture?.rows || []);
      if (!merged.length) throw new Error(`No current kingdom data exists for ${kd}.`);
      setRows(merged);
      const dbKingdom = kingdomResult.data || null;
      setKingdom(dbKingdom || (kingdomCapture ? {
        kd_code: kingdomCapture.kd_code,
        kd_name: kingdomCapture.kd_name,
        total_nw: kingdomCapture.total_nw,
        total_land: kingdomCapture.total_land,
        total_provinces: kingdomCapture.total_provinces,
        nw_rank: kingdomCapture.nw_rank,
        land_rank: kingdomCapture.land_rank,
        stance: kingdomCapture.stance,
        updated_at: kingdomCapture.received_at,
      } : null));
    } catch (e) {
      setRows([]);
      setKingdom(null);
      setError(e?.message || "Unable to load authoritative kingdom data.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    load();
    const timer = setInterval(() => { if (active) load(); }, REFRESH_MS);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const mine = rows.find(r => clean(r.province).toLowerCase() === clean(config.province).toLowerCase()) || rows[0];
  const totals = useMemo(() => ({
    nw: rows.reduce((s, r) => s + (num(r.networth) || 0), 0),
    land: rows.reduce((s, r) => s + (num(r.land) || 0), 0),
    off: rows.reduce((s, r) => s + (num(r.offense) || 0), 0),
    def: rows.reduce((s, r) => s + (num(r.defense) || 0), 0),
  }), [rows]);

  if (loading) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Loading authoritative Throne data…</div></div>;
  if (error) return <div className="empty"><div className="empty-icon">⚠️</div><div className="empty-text">{error}</div></div>;

  return <div style={{ display: "grid", gap: 16 }}>
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 11, opacity: .65, textTransform: "uppercase", letterSpacing: 1 }}>Your Kingdom</div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{val(kingdom?.kd_name || config.kingdom)} · {config.kd}</div>
      <div style={{ opacity: .75 }}>Province: <b>{config.province}</b></div>
      <div style={{ fontSize: 12, opacity: .55 }}>Authoritative source: Supabase · live kingdom capture + intel_throne · refreshed every 30s</div>
    </div>

    <div className="stat-grid">
      {[["Kingdom NW", fmt(kingdom?.total_nw || totals.nw), ""],["Kingdom Acres", fmt(kingdom?.total_land || totals.land), "green"],["Total Offense", fmt(totals.off), "red"],["Total Defense", fmt(totals.def), "purple"],["Members", kingdom?.total_provinces || rows.length, "blue"],["NW Rank", val(kingdom?.nw_rank), ""],["Land Rank", val(kingdom?.land_rank), "green"],["Stance", val(kingdom?.stance), "blue"]].map(([label,value,cls]) => <div className="stat-card" key={label}><div className="stat-label">{label}</div><div className={`stat-value ${cls}`}>{value}</div></div>)}
    </div>

    {mine && <div className="card" style={{ display: "grid", gap: 12 }}>
      <div className="card-title">Your Current Throne Snapshot</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{mine.province}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(125px,1fr))", gap: 10 }}>
        {[["Land", fmt(mine.land)], ["Net Worth", fmt(mine.networth)], ["Honor", val(mine.honor)], ["Race", val(mine.race)], ["Personality", val(mine.personality)], ["Offense", fmt(mine.offense)], ["Defense", fmt(mine.defense)], ["Building Efficiency", val(mine.be)], ["Peasants", fmt(mine.peasants)], ["Thieves", fmt(mine.thieves)], ["Wizards", fmt(mine.wizards)], ["TPA", val(mine.tpa)], ["WPA", val(mine.wpa)], ["Stealth", val(mine.stealth)], ["Mana", val(mine.mana)], ["Intel Age", val(mine.intel_age)]].map(([k,v]) => <div key={k} style={{ padding: 10, border: "1px solid rgba(255,255,255,.08)", borderRadius: 8 }}><div style={{ fontSize: 10, opacity: .6 }}>{k}</div><b>{v}</b></div>)}
      </div>
      <div style={{ fontSize: 11, opacity: .55 }}>Throne snapshot age: {age(mine.updated_at)} · Last captured {mine.updated_at ? new Date(mine.updated_at).toLocaleString() : EMPTY}</div>
    </div>}

    <div className="card">
      <div className="card-title">Current Kingdom Throne Roster</div>
      <div style={{ overflowX: "auto" }}>
        <table className="nexus-table"><thead><tr><th>Province</th><th>Race</th><th>Personality</th><th>Land</th><th>Net Worth</th><th>Offense</th><th>Defense</th><th>Peasants</th><th>Thieves</th><th>Wizards</th><th>BE</th><th>Intel Age</th></tr></thead>
          <tbody>{rows.map((p) => <tr key={p.id || p.province}><td className="gold">{val(p.province)}</td><td>{val(p.race)}</td><td>{val(p.personality)}</td><td>{fmt(p.land)}</td><td className="gold">{fmt(p.networth)}</td><td className="red">{fmt(p.offense)}</td><td className="purple">{fmt(p.defense)}</td><td>{fmt(p.peasants)}</td><td>{fmt(p.thieves)}</td><td>{fmt(p.wizards)}</td><td className="green">{val(p.be)}</td><td>{val(p.intel_age)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>

    {mine?.state && <div className="card"><div className="card-title">Your Province State</div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
      {[["Total Population",fmt(mine.state.total_pop)],["Max Population",fmt(mine.state.max_pop)],["Army",fmt(mine.state.army)],["Unemployed",fmt(mine.state.unemployed)],["Daily Income",fmt(mine.state.daily_income)],["Daily Wages",fmt(mine.state.daily_wages)],["Food",fmt(mine.state.food_net_yesterday)],["Runes",fmt(mine.state.runes_net_yesterday)]].map(([k,v]) => <div key={k}><div style={{fontSize:10,opacity:.6}}>{k}</div><b>{v}</b></div>)}
    </div></div>}

    {mine?.military && <div className="card"><div className="card-title">Your Military Intel</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
      {[["Offense",fmt(mine.military.offense)],["Defense",fmt(mine.military.defense)],["Generals",fmt(mine.military.generals)],["Offensive Specs",fmt(mine.military.o_specs)],["Soldiers",fmt(mine.military.solds)],["Elites",fmt(mine.military.elites)],["War Horses",fmt(mine.military.horses)],["SoM Age",val(mine.military.som_age)]].map(([k,v])=><div key={k}><div style={{fontSize:10,opacity:.6}}>{k}</div><b>{v}</b></div>)}
    </div></div>}
  </div>;
}
