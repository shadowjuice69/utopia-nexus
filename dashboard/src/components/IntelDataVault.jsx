import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";
import { loadNexusConfig } from "../services/nexusConfig";

const SOURCES = [
  ["intel_complete_vault", "Complete Vault"],
  ["intel_page_ingest", "Scraper archive"],
  ["intel_throne", "Throne"],
  ["intel_buildings", "Buildings"],
  ["intel_science", "Science"],
  ["intel_military", "Military"],
  ["intel_kd_stats", "KD stats"],
  ["intel_ops", "Ops"],
  ["intel_state", "State"],
  ["intel7_events", "Intel 7 events"],
  ["intel7_messages", "Intel 7 messages"],
  ["intel7_ingest", "Discord raw ingest"],
];

const hasKd = new Set(SOURCES.map(([name]) => name));

function stamp(row) {
  return row?.updated_at || row?.timestamp || row?.message_created_at || row?.received_at || row?.created_at || null;
}

function pretty(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

async function loadTable(table, kd) {
  let q = supabase.from(table).select("*").limit(500);
  if (hasKd.has(table)) q = q.eq("kd_code", kd);
  const order = table === "intel7_events" ? "timestamp" : table === "intel7_ingest" ? "message_created_at" : table === "intel_page_ingest" ? "received_at" : "updated_at";
  q = q.order(order, { ascending: false, nullsFirst: false });
  const { data, error } = await q;
  if (error) return { error: error.message, rows: [] };
  return { error: "", rows: data || [] };
}

export default function IntelDataVault() {
  const [kd, setKd] = useState("");
  const [tables, setTables] = useState({});
  const [selected, setSelected] = useState("intel_complete_vault");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setError("");
      const config = await loadNexusConfig();
      const currentKd = config?.kd || config?.kingdom?.kd_code || config?.kingdomCode || "";
      if (!currentKd) throw new Error("Kingdom context is unavailable.");
      setKd(currentKd);
      const entries = await Promise.all(SOURCES.map(async ([table]) => [table, await loadTable(table, currentKd)]));
      setTables(Object.fromEntries(entries));
    } catch (e) {
      setError(e?.message || "Unable to load complete intel archive.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); const iv = setInterval(refresh, 30000); return () => clearInterval(iv); }, [refresh]);

  const source = tables[selected] || { rows: [], error: "" };
  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return source.rows || [];
    return (source.rows || []).filter(row => JSON.stringify(row).toLowerCase().includes(needle));
  }, [source.rows, filter]);

  if (loading) return <div className="panel"><h2>🗄️ Complete Intel Vault</h2><p>Loading every connected intelligence source...</p></div>;

  return <div className="panel" style={{ display: "grid", gap: 12 }}>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div><h2 style={{ margin: 0 }}>🗄️ Complete Intel Vault · {kd}</h2><small style={{ opacity: .7 }}>Raw scraper payloads + structured tables. Nothing collected is hidden from the dashboard.</small></div>
      <button onClick={refresh}>↻ Refresh</button>
    </header>
    {error && <div style={{ color: "#f87171" }}>⚠ {error}</div>}

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
      {SOURCES.map(([table, label]) => <button key={table} onClick={() => { setSelected(table); setFilter(""); }} style={{ textAlign: "left", padding: 10, fontWeight: selected === table ? 700 : 400 }}><div>{label}</div><small style={{ opacity: .65 }}>{tables[table]?.rows?.length || 0} rows{tables[table]?.error ? " · ERROR" : ""}</small></button>)}
    </div>

    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search every field / value in this source..." style={{ flex: 1, minWidth: 240 }} />
      <span style={{ opacity: .65 }}>{filtered.length} shown</span>
    </div>

    {source.error && <div style={{ color: "#f87171" }}>{source.error}</div>}
    {!source.error && !filtered.length && <p style={{ opacity: .65 }}>No records match this source/filter.</p>}
    <div style={{ display: "grid", gap: 8 }}>
      {filtered.map((row, index) => (
        <details key={row.id ?? index} style={{ border: "1px solid rgba(148,163,184,.18)", borderRadius: 8, padding: 10 }}>
          <summary style={{ cursor: "pointer" }}><b>{row.tab || row.event_type || row.data_type || row.channel_type || row.province || row.name || "Record"}</b> · {row.province || row.province_name || row.target_province || ""} · {stamp(row) ? new Date(stamp(row)).toLocaleString() : "no timestamp"}</summary>
          <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", margin: "10px 0 0", fontSize: 11, opacity: .85 }}>{pretty(row)}</pre>
        </details>
      ))}
    </div>
  </div>;
}
