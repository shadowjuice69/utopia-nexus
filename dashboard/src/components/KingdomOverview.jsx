import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";
import { loadNexusConfig, getNexusConfig } from "../services/nexusConfig";

const REFRESH_MS = 30000;

function num(v) {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function fmt(v) {
  return num(v) ? num(v).toLocaleString() : "—";
}

function normalizeKingdom(value) {
  return String(value ?? "").trim().replace(/^kingdom\s*/i, "").replace(/\s+/g, "").toLowerCase();
}

function normalizeProvince(row) {
  if (!row || typeof row !== "object") return null;
  const name = String(row.Name ?? row.name ?? row.province ?? row.province_name ?? "").trim();
  if (!name) return null;
  return {
    Name: name,
    Combo: row.Combo ?? row.combo ?? row.race_personality ?? "",
    Acres: row.Acres ?? row.acres ?? row.land ?? row.Land ?? "",
    NW: row.NW ?? row.nw ?? row.networth ?? row.NetWorth ?? row.net_worth ?? "",
    Off: row.Off ?? row.off ?? row.offense ?? row.Offense ?? "",
    Def: row.Def ?? row.def ?? row.defense ?? row.Defense ?? "",
    BE: row.BE ?? row.be ?? row.building_efficiency ?? "",
    IntelAge: row.IntelAge ?? row.intel_age ?? row.intelage ?? "",
  };
}

function extractRows(parsed) {
  const candidates = [];
  if (Array.isArray(parsed?.provinces)) candidates.push(...parsed.provinces);
  if (Array.isArray(parsed?.rows)) {
    for (const item of parsed.rows) {
      if (item && typeof item === "object" && !item.raw) candidates.push(item);
    }
    const raw = parsed.rows.find((r) => r?.raw)?.raw;
    if (raw) {
      const lines = String(raw).split(/\r?\n/).filter(Boolean);
      if (lines.length > 1) {
        const headers = lines[0].split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
        for (const line of lines.slice(1)) {
          const values = line.split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
          candidates.push(Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
        }
      }
    }
  }
  if (Array.isArray(parsed?.data)) candidates.push(...parsed.data);
  return candidates.map(normalizeProvince).filter(Boolean);
}

function dedupeRoster(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row.Name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.Name.localeCompare(b.Name));
}

function snapshotFromCapture(capture) {
  const rows = dedupeRoster(extractRows(capture?.parsed));
  if (!rows.length) return null;
  return { rows, receivedAt: capture.received_at, source: capture.source || "unknown" };
}

export default function KingdomOverview() {
  const [config, setConfig] = useState(getNexusConfig());
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const c = await loadNexusConfig(true);
      const kd = String(c?.kd || "").trim();
      if (!kd) throw new Error("Your kingdom context is unavailable.");
      if (!c?.province) throw new Error("Your province is not linked to a kingdom yet.");
      setConfig(c);

      // Throne/Intel page captures are authoritative for Overview. CSV is only a
      // compatibility fallback until a real page capture exists for this kingdom.
      const { data: pageData, error: pageError } = await supabase
        .from("intel_page_ingest")
        .select("kd_code,province,parsed,received_at,source")
        .eq("kd_code", kd)
        .eq("tab", "overview")
        .eq("source", "intel-site")
        .order("received_at", { ascending: false })
        .limit(100);
      if (pageError) throw pageError;

      let next = (pageData || [])
        .filter((capture) => normalizeKingdom(capture.kd_code) === normalizeKingdom(kd))
        .map(snapshotFromCapture)
        .find(Boolean);

      let sourceWarning = "";
      if (!next) {
        const { data: csvData, error: csvError } = await supabase
          .from("intel_page_ingest")
          .select("kd_code,province,parsed,received_at,source")
          .eq("kd_code", kd)
          .eq("tab", "overview")
          .eq("source", "intel-site-csv")
          .order("received_at", { ascending: false })
          .limit(100);
        if (csvError) throw csvError;
        next = (csvData || []).map(snapshotFromCapture).find(Boolean);
        if (next) sourceWarning = "No current Throne page capture yet — showing the latest CSV capture temporarily.";
      }

      if (!next) throw new Error(`No valid Throne Overview capture exists for kingdom ${kd} yet.`);
      setSnapshot({ ...next, warning: sourceWarning });
    } catch (e) {
      setSnapshot(null);
      setError(e?.message || "Unable to load current Throne Overview data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    load();
    const timer = setInterval(() => { if (active) load(); }, REFRESH_MS);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const provinces = snapshot?.rows || [];
  const totals = useMemo(() => ({
    nw: provinces.reduce((s, p) => s + num(p.NW), 0),
    acres: provinces.reduce((s, p) => s + num(p.Acres), 0),
    off: provinces.reduce((s, p) => s + num(p.Off), 0),
    def: provinces.reduce((s, p) => s + num(p.Def), 0),
    be: (() => {
      const values = provinces.map((p) => num(p.BE)).filter(Boolean);
      return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    })(),
  }), [provinces]);

  if (loading) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Loading your kingdom from Throne...</div></div>;
  if (error) return <div className="empty"><div className="empty-icon">⚠️</div><div className="empty-text">{error}</div></div>;

  const kingdomLabel = config.kingdom ? `Kingdom ${config.kingdom} · ${config.kd}` : `Kingdom ${config.kd}`;
  const sourceLabel = snapshot.source === "intel-site" ? "THRONE PAGE" : "CSV FALLBACK";

  return <div style={{ display: "grid", gap: 16 }}>
    <div className="card" style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 11, opacity: .65, textTransform: "uppercase", letterSpacing: 1 }}>Your Kingdom</div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{kingdomLabel}</div>
      <div style={{ opacity: .75 }}>Province: <b>{config.province}</b></div>
      <div style={{ fontSize: 12, opacity: .55 }}>{sourceLabel} · Captured {new Date(snapshot.receivedAt).toLocaleString()}</div>
      {snapshot.warning && <div style={{ fontSize: 12, padding: 8, borderRadius: 8, background: "rgba(251,191,36,.08)" }}>⚠️ {snapshot.warning}</div>}
    </div>

    <div className="stat-grid">
      {[["Total NW", fmt(totals.nw), ""],["Total Acres", fmt(totals.acres), "green"],["Total Offense", fmt(totals.off), "red"],["Total Defense", fmt(totals.def), "purple"],["Members", provinces.length, "blue"],["Avg NW", fmt(provinces.length ? Math.round(totals.nw / provinces.length) : 0), ""],["Avg BE", totals.be ? `${totals.be}%` : "—", "green"],["Kingdom", config.kd, "blue"]].map(([label,value,cls]) => <div className="stat-card" key={label}><div className="stat-label">{label}</div><div className={`stat-value ${cls}`}>{value}</div></div>)}
    </div>

    <div className="card">
      <div className="card-title">Current Province Roster</div>
      <div style={{ overflowX: "auto" }}>
        <table className="nexus-table"><thead><tr><th>Province</th><th>Combo</th><th>Acres</th><th>Net Worth</th><th>Offense</th><th>Defense</th><th>BE</th><th>Intel Age</th></tr></thead>
          <tbody>{provinces.map((p, i) => <tr key={`${p.Name}-${i}`}><td className="gold">{p.Name}</td><td>{p.Combo || "—"}</td><td>{fmt(p.Acres)}</td><td className="gold">{fmt(p.NW)}</td><td className="red">{fmt(p.Off)}</td><td className="purple">{fmt(p.Def)}</td><td className="green">{p.BE || "—"}</td><td>{p.IntelAge || "—"}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  </div>;
}
