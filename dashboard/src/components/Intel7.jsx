import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const CHANNELS = [
  ["thieves", "🗡️ Thieves Operations"],
  ["offensive", "🔥 Offensive Spells"],
  ["self", "🛡️ Self Spells"],
  ["dragon", "🐉 Dragon"],
  ["ritual", "🔮 Ritual"],
  ["aid", "🤝 Aid"],
  ["attacks", "⚔️ Attacks"],
];

function ago(value) {
  if (!value) return "—";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(value)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function normalize(type, row) {
  const ts = row.timestamp || row.updated_at || row.last_seen || row.created_at;
  if (type === "thieves") return { ts, title: row.operation || "Operation", detail: `${row.province || "?"} → ${row.target_province || "?"}${row.kd_code ? ` (${row.kd_code})` : ""}`, status: row.success === false ? "FAILED" : "" };
  if (type === "offensive" || type === "self") return { ts, title: row.spell_name || "Spell", detail: `${row.caster_province || "?"}${row.target_province ? ` → ${row.target_province}` : ""}`, status: row.success === false ? "FAILED" : "" };
  if (type === "dragon") return { ts, title: row.event_type || row.dragon_name || "Dragon event", detail: `${row.province || "?"}${row.kingdom ? ` (${row.kingdom})` : ""}`, status: row.dragon_name || "" };
  if (type === "ritual") return { ts, title: "Ritual", detail: row.caster_province || "?", status: row.success === false ? "FAILED" : row.success ? "SUCCESS" : "" };
  if (type === "aid") return { ts, title: row.resource_type || "Aid", detail: `${row.sender_province || "?"} → ${row.target_province || "?"}`, status: row.amount != null ? Number(row.amount).toLocaleString() : "" };
  return { ts, title: row.attack_type || "Attack", detail: `${row.attacker_province || "?"} → ${row.target_province || "?"}${row.target_kingdom ? ` (${row.target_kingdom})` : ""}`, status: row.acres_captured != null ? `${row.acres_captured} acres` : "" };
}

export default function Intel7() {
  const [active, setActive] = useState("thieves");
  const [rows, setRows] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, 30000);
    return () => clearInterval(iv);
  }, []);

  async function fetchAll() {
    const queries = await Promise.all([
      supabase.from("intel_ops").select("*").order("last_seen", { ascending: false }).limit(100),
      supabase.from("spell_events").select("*").order("timestamp", { ascending: false }).limit(100),
      supabase.from("spell_events").select("*").order("timestamp", { ascending: false }).limit(100),
      supabase.from("dragon_events").select("*").order("timestamp", { ascending: false }).limit(100),
      supabase.from("ritual_events").select("*").order("timestamp", { ascending: false }).limit(100),
      supabase.from("aid_events").select("*").order("timestamp", { ascending: false }).limit(100),
      supabase.from("attacks").select("*").order("timestamp", { ascending: false }).limit(100),
    ]);
    const values = queries.map(q => q.data || []);
    setRows({
      thieves: values[0],
      offensive: values[1].filter(x => !x.category || x.category === "sorcery" || x.target_province),
      self: values[2].filter(x => !x.target_province),
      dragon: values[3],
      ritual: values[4],
      aid: values[5],
      attacks: values[6],
    });
    setLoading(false);
  }

  if (loading) return <div className="loading">⏳ Loading 7-channel Intel...</div>;

  const current = rows[active] || [];
  const label = CHANNELS.find(([id]) => id === active)?.[1] || active;

  return (
    <div className="intel-panel">
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>📡 Seven-Channel Intel</h2>
          <span style={{ color: "#64748b", fontSize: 12 }}>Auto-refresh: 30s</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "14px 0" }}>
          {CHANNELS.map(([id, text]) => (
            <button key={id} onClick={() => setActive(id)} style={{ opacity: active === id ? 1 : 0.55 }}>{text}</button>
          ))}
        </div>
        <div style={{ color: "#38bdf8", fontWeight: 700, marginBottom: 10 }}>{label} — {current.length}</div>
        {current.length === 0 ? (
          <p style={{ color: "#64748b", textAlign: "center", padding: 28 }}>No events recorded for this channel yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {current.map((row, i) => {
              const item = normalize(active, row);
              return <div key={row.id || i} style={{ padding: "9px 12px", border: "1px solid rgba(255,255,255,.07)", borderRadius: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{item.title}</strong><span style={{ color: "#64748b", fontSize: 11 }}>{ago(item.ts)}</span>
                </div>
                <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 3 }}>{item.detail}</div>
                {item.status && <div style={{ color: "#facc15", fontSize: 11, marginTop: 3 }}>{item.status}</div>}
              </div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
