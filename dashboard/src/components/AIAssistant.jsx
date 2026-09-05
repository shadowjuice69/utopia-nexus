import { useState } from "react";
import { supabase } from "../services/supabase";
import { loadUnifiedIntel7 } from "../services/unifiedIntel7";

function formatBuild(build) {
  const lines = [`${build.name || "Reference Build"} — ${build.build_type || "custom"} — v${build.version || 1}`];
  if (build.race || build.personality) lines.push(`Profile: ${build.race || "?"} ${build.personality || "?"}`);
  const buildings = build.buildings || build.parsed_data?.buildings || {};
  const military = build.military || build.parsed_data?.military || {};
  const science = build.science || build.parsed_data?.science || {};
  const buildingLines = Object.entries(buildings).map(([key, value]) => `${key}: ${value && typeof value === "object" ? `${value.value ?? ""}${value.metric || "%"}` : value}`);
  if (buildingLines.length) lines.push(`Buildings: ${buildingLines.join(", ")}`);
  const militaryLines = Object.entries(military).map(([key, value]) => !value || typeof value !== "object" ? `${key}: ${value}` : `${key}: ${value.value}${value.metric || ""}${value.minimum ? " minimum" : ""}`);
  if (militaryLines.length) lines.push(`Military: ${militaryLines.join(", ")}`);
  const scienceLines = Object.entries(science).map(([key, value]) => `${key}: ${value && typeof value === "object" ? value.books : value}x weight${value && typeof value === "object" && value.category ? ` (${value.category})` : ""}`);
  if (scienceLines.length) lines.push(`Science weights: ${scienceLines.join(", ")}`);
  if (build.raw_text) lines.push(`Original Savage build:\n${build.raw_text}`);
  return lines.join("\n");
}

export default function AIAssistant() {
  const [messages, setMessages] = useState([{ role: "ai", text: "Ask me anything about your kingdom — targets, wave status, threat assessment, recent attacks, builds, or anything else." }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask() {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", text: question }]);
    setLoading(true);
    try {
      const intel = await loadUnifiedIntel7();
      const [summariesResult, buildsResult] = await Promise.all([
        supabase.from("ai_summaries").select("content, type, created_at").order("created_at", { ascending: false }).limit(3),
        supabase.from("ai_builds").select("*").eq("active", true).order("name")
      ]);
      if (buildsResult.error) throw buildsResult.error;

      const referenceBuilds = (buildsResult.data || []).map(formatBuild).join("\n\n---\n\n");
      const provinces = (intel.provinces || []).map(p => `${p.name} (${p.race || "?"}, ${p.personality || "?"}, ${p.acres || "?"}a, ${p.nw || "?"} NW, Off:${p.off || "?"}, Def:${p.def || "?"}, oTPA:${p.o_tpa || "?"}, dTPA:${p.d_tpa || "?"})`).join("; ");
      const eventLine = row => `${row.province_name || row.attacker_province || "?"} → ${row.target_name || row.target_province || "?"}${row.target_kd || row.target_kingdom ? ` (${row.target_kd || row.target_kingdom})` : ""}${row.operation || row.action || row.spell_name ? `: ${row.operation || row.action || row.spell_name}` : ""}${row.quantity || row.amount ? ` • ${row.quantity || row.amount}` : ""}`;
      const recentEvents = (intel.events || []).slice(0, 30).map(eventLine).join("; ");

      const context = `
UNIFIED INTEL 7 CONTEXT — Kingdom ${intel.kd} (${intel.kingdomName})
Current province: ${intel.currentProvince?.name || "unknown"}
Loaded: ${intel.loadedAt}
Province state: ${provinces || "None"}

Recent unified Intel 7 events: ${recentEvents || "None"}
Attacks: ${(intel.channels.attacks || []).slice(0, 10).map(eventLine).join("; ") || "None"}
Thievery / ops: ${(intel.channels.ops || []).slice(0, 10).map(eventLine).join("; ") || "None"}
Offensive spells: ${(intel.channels.offensive_spells || []).slice(0, 10).map(eventLine).join("; ") || "None"}
Self spells: ${(intel.channels.self_spells || []).slice(0, 10).map(eventLine).join("; ") || "None"}
Dragon: ${(intel.channels.dragon || []).slice(0, 10).map(eventLine).join("; ") || "None"}
Ritual: ${(intel.channels.ritual || []).slice(0, 10).map(eventLine).join("; ") || "None"}
Aid: ${(intel.channels.aid || []).slice(0, 10).map(eventLine).join("; ") || "None"}

Structured intelligence freshness: ${JSON.stringify(intel.freshness)}
ACTIVE SAVAGE REFERENCE BUILDS:
${referenceBuilds || "No active reference builds saved yet."}

SCIENCE BOOK ALLOCATION RULE — IMPORTANT:
- Savage science entries such as 3x, 5x, 10x are RELATIVE ALLOCATION WEIGHTS, not literal numbers of books.
- For each science category, first sum the weights within that science category.
- Formula: books per weight = total available books ÷ total science weight.
- Then: books allocated to a science = books per weight × that science's weight.
- Preserve original Savage weights exactly when comparing or recommending allocations; calculate actual book counts from currently available books.
- Apply independently to each science category and round while keeping the final allocation as close as possible to the available total.

Reference-build rules:
- Treat active Savage builds as the strategic baseline.
- Compare current recovered game state against the relevant active build before recommending changes.
- Do not silently rewrite or replace a Savage build.
- If evidence suggests a change, explain the evidence and propose it for approval.
- Preserve intended minimums, ratios, priorities, and science allocations unless evidence supports changing them.
      `.trim();

      const response = await fetch("https://utopia-nexus.onrender.com/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ key: "NikkoAce", question, context })
      });
      if (!response.ok) throw new Error(`AI request failed (${response.status})`);
      const text = await response.text();
      setMessages(m => [...m, { role: "ai", text }]);
    } catch (e) {
      setMessages(m => [...m, { role: "ai", text: "Error: " + e.message }]);
    }
    setLoading(false);
  }

  function handleKey(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }

  return <div className="card">
    <div className="card-title">AI Assistant</div>
    <div className="chat-messages">
      {messages.map((m, i) => <div key={i} className={`chat-msg ${m.role}`}><span dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/^- (.+)$/gm, '• $1').replace(/\n/g, '<br/>') }} /></div>)}
      {loading && <div className="chat-msg ai" style={{ color: "var(--text3)" }}>⏳ Thinking...</div>}
    </div>
    <div className="chat-input-row"><input className="chat-input" placeholder="Ask about targets, threats, waves, ops, or builds..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} disabled={loading} /><button className="btn btn-gold" onClick={ask} disabled={loading}>Ask</button></div>
  </div>;
}
