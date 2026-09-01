import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

export default function AdvisorLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_summaries")
      .select("*")
      .eq("type", "advisor")
      .order("tick", { ascending: false })
      .limit(50);
    if (!error) setLogs(data || []);
    setLoading(false);
  }

  function formatDate(iso) {
    if (!iso) return "Unknown";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  function getTab(log) {
    return log.metadata?.tab || "unknown";
  }

  function getProvince(log) {
    return log.metadata?.province || "Unknown";
  }

  if (loading) return (
    <div style={{ color: "#aaa", fontFamily: "monospace", padding: "20px" }}>
      Loading advisor logs...
    </div>
  );

  if (!logs.length) return (
    <div style={{ color: "#aaa", fontFamily: "monospace", padding: "20px" }}>
      No advisor analyses saved yet. Use "Analyze This Page" in the game.
    </div>
  );

  return (
    <div style={{ fontFamily: "monospace", padding: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h2 style={{ color: "#f5c842", margin: 0, fontSize: "16px" }}>⚡ Advisor Log</h2>
        <button onClick={fetchLogs} style={{
          background: "#2a2a2a", border: "1px solid #444", color: "#aaa",
          borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontSize: "11px"
        }}>Refresh</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {logs.map((log, i) => (
          <div key={log.id || i} style={{
            background: "#1a1a1a", border: "1px solid #333",
            borderRadius: "8px", overflow: "hidden"
          }}>
            <div
              onClick={() => setExpanded(expanded === i ? null : i)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", cursor: "pointer",
                background: expanded === i ? "#222" : "#1a1a1a"
              }}
            >
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <span style={{ color: "#f5c842", fontSize: "11px", fontWeight: "bold" }}>
                  {formatDate(log.tick)}
                </span>
                <span style={{
                  background: "#2a2a3a", color: "#9b8dc4", padding: "2px 8px",
                  borderRadius: "4px", fontSize: "10px"
                }}>
                  {getTab(log)}
                </span>
                <span style={{ color: "#888", fontSize: "10px" }}>
                  {getProvince(log)}
                </span>
              </div>
              <span style={{ color: "#555", fontSize: "12px" }}>
                {expanded === i ? "▲" : "▼"}
              </span>
            </div>
            {expanded === i && (
              <div style={{
                padding: "12px 14px", borderTop: "1px solid #2a2a2a",
                color: "#ccc", fontSize: "11px", lineHeight: "1.6",
                whiteSpace: "pre-wrap"
              }}>
                {log.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
