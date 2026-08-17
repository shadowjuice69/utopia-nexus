import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function AIWarReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("ai_summaries")
      .select("*")
      .eq("type", "war_report")
      .order("created_at", { ascending: false })
      .limit(1);
    setReport(data?.[0] || null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  async function triggerAnalysis() {
    setRefreshing(true);
    try {
      await fetch("https://utopia-nexus-production.up.railway.app/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "key=NikkoAce&trigger=manual"
      });
      setTimeout(() => { load(); setRefreshing(false); }, 8000);
    } catch {
      setRefreshing(false);
    }
  }

  if (loading) return <div className="empty"><div className="empty-icon">⏳</div><div className="empty-text">Loading war report...</div></div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text3)", letterSpacing: 2, textTransform: "uppercase" }}>
            AI War Analysis
          </div>
          {report && (
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
              Generated: {new Date(report.created_at).toLocaleString()}
              {report.metadata?.provinces_analyzed && ` · ${report.metadata.provinces_analyzed} provinces analyzed`}
            </div>
          )}
        </div>
        <button
          className="btn btn-gold"
          onClick={triggerAnalysis}
          disabled={refreshing}
          style={{ fontSize: 12 }}
        >
          {refreshing ? "⏳ Analyzing..." : "⚡ Run Analysis"}
        </button>
      </div>

      {!report ? (
        <div className="empty">
          <div className="empty-icon">🤖</div>
          <div className="empty-text">
            No war report yet.<br />
            Run the Nexus Cycler or click Run Analysis to generate one.
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
