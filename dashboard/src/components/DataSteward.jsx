import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";
import { loadNexusConfig } from "../services/nexusConfig";

const REFRESH_MS = 30000;
const EMPTY = "Not captured";
const REQUIRED = ["land", "networth", "offense", "defense", "peasants", "troops", "thieves", "wizards"];

function clean(v) { return String(v ?? "").trim(); }
function val(v) { return clean(v) || EMPTY; }
function fmt(v) {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n.toLocaleString() : EMPTY;
}

export default function DataSteward() {
  const [issues, setIssues] = useState([]);
  const [audit, setAudit] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("open");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const config = await loadNexusConfig(true);
      const kd = clean(config?.kd);
      const province = clean(config?.province);
      if (!kd || !province) throw new Error("Kingdom/province identity is not linked.");

      const [issuesResult, auditResult, throneResult, militaryResult, stateResult, buildingResult, scienceResult] = await Promise.all([
        supabase.from("nexus_data_steward_issues").select("*").order("last_seen", { ascending: false }).limit(200),
        supabase.from("nexus_data_steward_audit").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("intel_throne").select("*").eq("kd_code", kd).eq("province", province).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("intel_military").select("*").eq("kd_code", kd).eq("province", province).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("intel_state").select("*").eq("kd_code", kd).eq("province", province).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("intel_buildings").select("*").eq("kd_code", kd).eq("province", province).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("intel_science").select("*").eq("kd_code", kd).eq("province", province).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (issuesResult.error) throw issuesResult.error;
      if (auditResult.error) throw auditResult.error;
      if (throneResult.error && throneResult.error.code !== "PGRST116") throw throneResult.error;
      if (militaryResult.error && militaryResult.error.code !== "PGRST116") throw militaryResult.error;
      if (stateResult.error && stateResult.error.code !== "PGRST116") throw stateResult.error;
      if (buildingResult.error && buildingResult.error.code !== "PGRST116") throw buildingResult.error;
      if (scienceResult.error && scienceResult.error.code !== "PGRST116") throw scienceResult.error;

      const throne = throneResult.data || null;
      const missing = throne ? REQUIRED.filter(k => throne[k] == null || throne[k] === "" || (k === "troops" && (!throne.troops || typeof throne.troops !== "object"))) : REQUIRED;
      setSnapshot({ config, throne, military: militaryResult.data || null, state: stateResult.data || null, buildings: buildingResult.data || null, science: scienceResult.data || null, missing });
      setIssues(issuesResult.data || []);
      setAudit(auditResult.data || []);
    } catch (e) {
      setError(e.message || "Unable to load Data Steward status");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const channel = supabase.channel("data-steward-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "nexus_data_steward_issues" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "intel_throne" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "intel_military" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const open = useMemo(() => issues.filter(i => i.status === "open" || i.status === "acknowledged"), [issues]);
  const high = useMemo(() => open.filter(i => i.severity === "high" || i.severity === "critical"), [open]);
  const visible = filter === "all" ? issues : issues.filter(i => i.status === filter);
  const card = { background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: 14 };
  const label = { fontSize: 11, opacity: .65, textTransform: "uppercase", letterSpacing: 1 };

  return <div style={{ display: "grid", gap: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div><h2 style={{ margin: 0 }}>AI Data Steward</h2><div style={{ opacity: .65, marginTop: 4 }}>One integrity view for the same Supabase data used by Overview and the AI systems.</div></div>
      <button onClick={load} disabled={loading}>{loading ? "Checking…" : "Refresh"}</button>
    </div>

    {snapshot && <div style={{ ...card, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div><div style={label}>Current identity</div><strong>{val(snapshot.config.province)} · {val(snapshot.config.kd)}</strong></div>
        <div><div style={label}>Throne capture</div><strong>{snapshot.throne ? val(snapshot.throne.updated_at) : EMPTY}</strong></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
        {[["Land",fmt(snapshot.throne?.land)],["Net Worth",fmt(snapshot.throne?.networth)],["Offense",fmt(snapshot.throne?.offense)],["Defense",fmt(snapshot.throne?.defense)],["Thieves",fmt(snapshot.throne?.thieves)],["Wizards",fmt(snapshot.throne?.wizards)],["State",snapshot.state ? "Present" : EMPTY],["Military",snapshot.military ? "Present" : EMPTY],["Buildings",snapshot.buildings ? "Present" : EMPTY],["Science",snapshot.science ? "Present" : EMPTY]].map(([k,v]) => <div key={k} style={{ padding: 10, border: "1px solid rgba(255,255,255,.08)", borderRadius: 8 }}><div style={{ fontSize: 10, opacity: .6 }}>{k}</div><b>{v}</b></div>)}
      </div>
      <div style={{ fontSize: 12 }}>{snapshot.missing.length ? `⚠️ Missing required Throne fields: ${snapshot.missing.join(", ")}` : "✅ Required Throne fields are populated."}</div>
    </div>}

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
      <div style={card}><div style={label}>Open Issues</div><strong style={{ fontSize: 26 }}>{open.length}</strong></div>
      <div style={card}><div style={label}>High / Critical</div><strong style={{ fontSize: 26 }}>{high.length}</strong></div>
      <div style={card}><div style={label}>Tracked Issues</div><strong style={{ fontSize: 26 }}>{issues.length}</strong></div>
      <div style={card}><div style={label}>Audit Events</div><strong style={{ fontSize: 26 }}>{audit.length}</strong></div>
    </div>

    {error && <div style={{ ...card, borderColor: "rgba(248,113,113,.45)" }}>⚠️ {error}</div>}

    <div style={{ ...card, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}><strong>Data problems requiring attention</strong><select value={filter} onChange={e => setFilter(e.target.value)}><option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option><option value="ignored">Ignored</option><option value="all">All</option></select></div>
      {!visible.length && <div style={{ opacity: .6, padding: 12 }}>No issues in this view.</div>}
      {visible.map(issue => <div key={issue.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 12, display: "grid", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong>{val(issue.issue_type).replaceAll("_", " ")}</strong><span>{val(issue.severity).toUpperCase()} · {val(issue.status)}</span></div>
        <div style={{ fontSize: 13 }}>{val(issue.reason)}</div>
        <div style={{ fontSize: 12, opacity: .75 }}>{issue.source_type && <>Source: <b>{issue.source_type}</b> · </>}{issue.kd_code && <>KD: <b>{issue.kd_code}</b> · </>}{issue.province && <>Province: <b>{issue.province}</b> · </>}{issue.field_name && <>Field: <b>{issue.field_name}</b></>}</div>
        <div style={{ fontSize: 12 }}>DB: <b>{val(issue.destination_table)}</b> · Dashboard: <b>{val(issue.destination_dashboard)}</b></div>
        {issue.recommendation && <div style={{ fontSize: 12 }}>🤖 <b>Recommended:</b> {issue.recommendation}</div>}
        <div style={{ fontSize: 11, opacity: .5 }}>Seen {issue.last_seen ? new Date(issue.last_seen).toLocaleString() : EMPTY} · Occurrences {issue.occurrence_count ?? 0}</div>
      </div>)}
    </div>

    <div style={card}><strong>Recent Steward Audit</strong><div style={{ display: "grid", gap: 8, marginTop: 10 }}>{audit.slice(0, 20).map(row => <div key={row.id} style={{ fontSize: 12, borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 8 }}><b>{val(row.action)}</b> · {val(row.decision)} · {val(row.destination_table)} · {row.created_at ? new Date(row.created_at).toLocaleString() : EMPTY}</div>)}</div></div>
  </div>;
}
