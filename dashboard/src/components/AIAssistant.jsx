import { useState } from "react";
import { supabase } from "../services/supabase";

const MY_KD = "3:2";

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    { role: "ai", text: "Ask me anything about your kingdom — targets, wave status, threat assessment, recent attacks, or anything else." }
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
      // Pull relevant context from Supabase
      const [{ data: provinces }, { data: attacks }, { data: hostileOps }, { data: summaries }] = await Promise.all([
        supabase.from("provinces").select("name, kd_code, race, acres, nw, off, def, be").eq("kd_code", MY_KD),
        supabase.from("attacks").select("attacker, defender, acres_captured, attack_type, created_at").order("created_at", { ascending: false }).limit(10),
        supabase.from("hostile_ops").select("attacker, target, op_type, result, created_at").order("created_at", { ascending: false }).limit(10),
        supabase.from("ai_summaries").select("content, type, created_at").order("created_at", { ascending: false }).limit(3),
      ]);

      const context = `
Kingdom Judo (3:2) current state:
Provinces: ${(provinces || []).map(p => `${p.name} (${p.race}, ${p.acres}a, ${p.nw}gc NW, Off:${p.off}, Def:${p.def})`).join("; ")}

Recent attacks: ${(attacks || []).map(a => `${a.attacker} vs ${a.defender}: ${a.acres_captured || 0}ac (${a.attack_type})`).join("; ")}

Recent hostile ops: ${(hostileOps || []).map(o => `${o.attacker} → ${o.target}: ${o.op_type} (${o.result})`).join("; ")}

Latest AI report: ${summaries?.[0]?.content?.slice(0, 500) || "None"}
      `.trim();

      const response = await fetch("https://utopia-nexus-production.up.railway.app/ai/ask", {
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
            {m.text}
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
          placeholder="Ask about targets, threats, waves, ops..."
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
