import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

export default function DataSteward() {
  const [issues, setIssues] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("open");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const issuesQuery = supabase.from("nexus_data_steward_issues").select("*").order("last_seen", { ascending: false }).limit(200);
      const auditQuery = supabase.from("nexus_data_steward_audit").select("*").order("created_at", { ascending: false }).limit(50);
      const [{ data: issueData, error: issueError }, { data: auditData, error: auditError }] = await Promise.all([issuesQuery, auditQuery]);
      if (issueError) throw issueError;
      if (auditError) throw auditError;
      setIssues(issueData || []);
      setAudit(auditData || []);
    } catch (e) {
      setError(e.message || "Unable to load Data Steward status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const channel = supabase.channel("data-steward-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "nexus_data_steward_issues" }, load)
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
      <div><h2 style={{ margin: 0 }}>AI Data Steward</h2><div style={{ opacity: .65, marginTop: 4 }}>Monitors incoming Nexus data for unmapped, conflicting, or unknown information.</div></div>
      <button onClick={load} disabled={loading}>{loading ? "Checking…" : "Refresh"}</button>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
      <div style={card}><div style={label}>Open Issues</div><strong style={{ fontSize: 26 }}>{open.length}</strong></div>
      <div style={card}><div style={label}>High / Critical</div><strong style={{ fontSize: 26 }}>{high.length}</strong></div>
      <div style={card}><div style={label}>Tracked Issues</div><strong style={{ fontSize: 26 }}>{issues.length}</strong></div>
      <div style={card}><div style={label}>Audit Events</div><strong style={{ fontSize: 26 }}>{audit.length}</strong></div>
    </div>

    {error && <div style={{ ...card, borderColor: "rgba(248,113,113,.45)" }}>⚠️ {error}</div>}

    <div style={{ ...card, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <strong>Data problems requiring attention</strong>
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="open">Open</option><option value="acknowledged">Acknowledged</option><option value="resolved">Resolved</option><option value="ignored">Ignored</option><option value="all">All</option>
        </select>
      </div>
      {!visible.length && <div style={{ opacity: .6, padding: 12 }}>No issues in this view.</div>}
      {visible.map(issue => <div key={issue.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 12, display: "grid", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <strong>{issue.issue_type.replaceAll("_", " ")}</strong>
          <span>{issue.severity.toUpperCase()} · {issue.status}</span>
        </div>
        <div style={{ fontSize: 13 }}>{issue.reason}</div>
        <div style={{ fontSize: 12, opacity: .75 }}>
          {issue.source_type && <>Source: <b>{issue.source_type}</b> · </>}
          {issue.kd_code && <>KD: <b>{issue.kd_code}</b> · </>}
          {issue.province && <>Province: <b>{issue.province}</b> · </>}
          {issue.field_name && <>Field: <b>{issue.field_name}</b></>}
        </div>
        <div style={{ fontSize: 12 }}>DB: <b>{issue.destination_table || "NONE"}</b> · Dashboard: <b>{issue.destination_dashboard || "NONE"}</b></div>
        {issue.recommendation && <div style={{ fontSize: 12 }}>🤖 <b>Recommended:</b> {issue.recommendation}</div>}
        <div style={{ fontSize: 11, opacity: .5 }}>Seen {new Date(issue.last_seen).toLocaleString()} · Occurrences {issue.occurrence_count}</div>
      </div>)}
    </div>

    <div style={{ ...card }}>
      <strong>Recent Steward Audit</strong>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {audit.slice(0, 20).map(row => <div key={row.id} style={{ fontSize: 12, borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 8 }}>
          <b>{row.action}</b> · {row.decision || "inspect"} · {row.destination_table || "no destination"} · {new Date(row.created_at).toLocaleString()}
        </div>)}
      </div>
    </div>
  </div>;
}
