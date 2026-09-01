import { useState } from "react";
import { supabase } from "../services/supabase";

const MY_KD = "6:9";

function formatBuild(build) {
  const lines = [`${build.name || "Reference Build"} — ${build.build_type || "custom"} — v${build.version || 1}`];
  if (build.race || build.personality) lines.push(`Profile: ${build.race || "?"} ${build.personality || "?"}`);

  const buildings = build.buildings || build.parsed_data?.buildings || {};
  const military = build.military || build.parsed_data?.military || {};
  const science = build.science || build.parsed_data?.science || {};

  const buildingLines = Object.entries(buildings).map(([key, value]) => {
    const v = value && typeof value === "object" ? `${value.value ?? ""}${value.metric || "%"}` : value;
    return `${key}: ${v}`;
  });
  if (buildingLines.length) lines.push(`Buildings: ${buildingLines.join(", ")}`);

  const militaryLines = Object.entries(military).map(([key, value]) => {
    if (!value || typeof value !== "object") return `${key}: ${value}`;
    return `${key}: ${value.value}${value.metric || ""}${value.minimum ? " minimum" : ""}`;
  });
  if (militaryLines.length) lines.push(`Military: ${militaryLines.join(", ")}`);

  const scienceLines = Object.entries(science).map(([key, value]) => {
    const books = value && typeof value === "object" ? value.books : value;
    const category = value && typeof value === "object" && value.category ? ` (${value.category})` : "";
    return `${key}: ${books} books${category}`;
  });
  if (scienceLines.length) lines.push(`Science: ${scienceLines.join(", ")}`);

  if (build.raw_text) lines.push(`Original Savage build:\n${build.raw_text}`);
  return lines.join("\n");
}

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: "ai", text: "Ask me anything about your kingdom — targets, wave status, threat assessment, recent attacks, builds, or anything else." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask() {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", text: question }]);
    setLoading(true);

    try {
      const [provincesResult, attacksResult, hostileOpsResult, summariesResult, buildsResult] = await Promise.all([
        supabase.from("provinces").select("name, kd_code, race, acres, nw, off, def, be").eq("kd_code", MY_KD),
        supabase.from("intel7_events").select("attacker_province, target_province, target_kingdom, event_type, success, data, timestamp").eq("event_type", "attack").order("timestamp", { ascending: false }).limit(10),
        supabase.from("intel7_events").select("attacker_province, target_province, operation, success, timestamp").eq("event_type", "thievery").order("timestamp", { ascending: false }).limit(10),
        supabase.from("ai_summaries").select("content, type, created_at").order("created_at", { ascending: false }).limit(3),
        supabase.from("ai_builds").select("*").eq("active", true).order("name")
      ]);

      if (buildsResult.error) throw buildsResult.error;

      const referenceBuilds = (buildsResult.data || []).map(formatBuild).join("\n\n---\n\n");

      const context = `
Kingdom Relentless Recruiting (6:9) current state:
Provinces: ${(provincesResult.data || []).map(p => `${p.name} (${p.race}, ${p.acres}a, ${p.nw}gc NW, Off:${p.off}, Def:${p.def})`).join("; ")}

Recent attacks: ${(attacksResult.data || []).map(a => `${a.attacker_province} vs ${a.target_province} (${a.target_kingdom}): ${(a.data||{}).acresCaptured || 0}ac`).join("; ")}

Recent hostile ops: ${(hostileOpsResult.data || []).map(o => `${o.attacker_province} → ${o.target_province}: ${o.operation} (${o.success ? 'hit' : 'foiled'})`).join("; ")}

Latest AI report: ${summariesResult.data?.[0]?.content?.slice(0, 500) || "None"}

ACTIVE SAVAGE REFERENCE BUILDS:
${referenceBuilds || "No active reference builds saved yet."}

Reference-build rules:
- Treat active Savage builds as the kingdom's strategic baseline, not generic suggestions.
- Compare current recovered game state against the relevant active build before recommending changes.
- Do not silently rewrite or replace a Savage build.
- If the game data suggests a change, explain the evidence and propose the change for approval.
- Preserve Savage's intended minimums, ratios, priorities, and science allocations unless evidence supports changing them.
      `.trim();

      const response = await fetch("https://utopia-nexus.onrender.com/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          key: "NikkoAce",
          question,
          context
        })
      });

      const text = await response.text();
      setMessages(m => [...m, { role: "ai", text }]);
    } catch (e) {
      setMessages(m => [...m, { role: "ai", text: "Error: " + e.message }]);
    }
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
  }

  return (
    <div className="card">
      <div className="card-title">AI Assistant</div>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <span dangerouslySetInnerHTML={{ __html: m.text
              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              .replace(/^- (.+)$/gm, '• $1')
              .replace(/\n/g, '<br/>')
            }} />
          </div>
        ))}
        {loading && (
          <div className="chat-msg ai" style={{ color: "var(--text3)" }}>
            ⏳ Thinking...
          </div>
        )}
      </div>
      <div className="chat-input-row">
        <input
          className="chat-input"
          placeholder="Ask about targets, threats, waves, ops, or builds..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading}
        />
        <button className="btn btn-gold" onClick={ask} disabled={loading}>
          Ask
        </button>
      </div>
    </div>
  );
}
