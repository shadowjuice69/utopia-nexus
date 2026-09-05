import { useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabase";

const ANALYZE_URL = "https://utopia-nexus.onrender.com/ai/analyze";
const ANALYSIS_TIMEOUT_MS = 120000;
const POLL_MS = 3000;

export default function AIWarReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusDetail, setStatusDetail] = useState("");
  const [cleared, setCleared] = useState(false);
  const runStartedAt = useRef(null);

  async function loadLatest({ keepCleared = false } = {}) {
    const { data, error } = await supabase
      .from("ai_summaries")
      .select("*")
      .eq("type", "war_report")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      setStatus("error");
      setStatusDetail(`Could not load report: ${error.message}`);
      setLoading(false);
      return null;
    }

    const latest = data?.[0] || null;
    if (!keepCleared) setReport(latest);
    setLoading(false);
    return latest;
  }

  useEffect(() => {
    loadLatest();
    const iv = setInterval(() => {
      if (!running && !cleared) loadLatest();
    }, 30000);
    return () => clearInterval(iv);
  }, [running, cleared]);

  async function waitForNewReport(previousCreatedAt) {
    const deadline = Date.now() + ANALYSIS_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const latest = await loadLatest({ keepCleared: true });
      if (latest?.created_at && (!previousCreatedAt || new Date(latest.created_at) > new Date(previousCreatedAt))) {
        setReport(latest);
        setCleared(false);
        setStatus("success");
        setStatusDetail(`New report generated at ${new Date(latest.created_at).toLocaleString()}`);
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }

    setStatus("timeout");
    setStatusDetail("Analysis was started, but no new report appeared in 2 minutes. The old report was not restored.");
    return false;
  }

  async function triggerAnalysis() {
    if (running) return;

    const previousCreatedAt = report?.created_at || null;
    runStartedAt.current = new Date().toISOString();
    setRunning(true);
    setCleared(true);
    setReport(null);
    setStatus("running");
    setStatusDetail("Sending analysis request to Nexus…");

    try {
      const response = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "key=NikkoAce&trigger=manual"
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Nexus returned HTTP ${response.status}${text ? `: ${text.slice(0, 240)}` : ""}`);
      }

      setStatus("running");
      setStatusDetail("Request accepted. Waiting for a new war report in Supabase…");
      await waitForNewReport(previousCreatedAt);
    } catch (error) {
      setStatus("error");
      setStatusDetail(error?.message || "Analysis request failed.");
    } finally {
      setRunning(false);
      runStartedAt.current = null;
    }
  }

  function clearReport() {
    setReport(null);
    setCleared(true);
    setStatus("cleared");
    setStatusDetail("Old report cleared from this view. Run Analysis to generate and verify a new report.");
  }

  if (loading) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Loading war report...</div></div>;

  const statusIcon = {
    running: "⏳",
    success: "✓",
    error: "✕",
    timeout: "⚠",
    cleared: "🧹"
  }[status];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text3)", letterSpacing: 2, textTransform: "uppercase" }}>
            AI War Analysis
          </div>
          {report && !cleared && (
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
              Generated: {new Date(report.created_at).toLocaleString()}
              {report.metadata?.provinces_analyzed && ` · ${report.metadata.provinces_analyzed} provinces analyzed`}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn"
            onClick={clearReport}
            disabled={running || (!report && cleared)}
            style={{ fontSize: 12 }}
          >
            🧹 Clear
          </button>
          <button
            className="btn btn-gold"
            onClick={triggerAnalysis}
            disabled={running}
            style={{ fontSize: 12 }}
          >
            {running ? "⏳ Analyzing..." : "⚡ Run Analysis"}
          </button>
        </div>
      </div>

      {status && (
        <div style={{
          marginBottom: 14,
          padding: "10px 12px",
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--bg2)",
          fontSize: 12
        }}>
          <strong>{statusIcon} {status === "running" ? "Analysis running" : status === "success" ? "Analysis complete" : status === "error" ? "Analysis failed" : status === "timeout" ? "Analysis timeout" : "Report cleared"}</strong>
          <div style={{ color: "var(--text3)", marginTop: 4 }}>{statusDetail}</div>
        </div>
      )}

      {cleared || !report ? (
        <div className="empty">
          <div className="empty-icon">{running ? "🤖" : "🧹"}</div>
          <div className="empty-text">
            {running
              ? "Waiting for the new AI war report..."
              : "No report displayed. Run Analysis to generate a fresh report."}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="ai-content">{report.content}</div>
        </div>
      )}
    </div>
  );
}
