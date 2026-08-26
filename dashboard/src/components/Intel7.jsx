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

function normalize(row) {
  const d = row.data || {};
  const type = row.channel_type;
  if (type === "thieves") return { title: d.operation || row.operation || "Operation", detail: `${d.attackerProvince || row.attacker_province || "?"} → ${d.targetProvince || row.target_province || "?"}${d.targetKingdom || row.target_kingdom ? ` (${d.targetKingdom || row.target_kingdom})` : ""}`, status: row.success === false ? "FAILED" : "" };
  if (type === "offensive" || type === "self") return { title: d.spellName || row.spell_name || "Spell", detail: `${d.attackerProvince || row.attacker_province || "?"}${d.targetProvince || row.target_province ? ` → ${d.targetProvince || row.target_province}` : ""}`, status: row.success === false ? "FAILED" : "" };
  if (type === "dragon") return { title: row.event_type || "Dragon event", detail: `${d.targetProvince || row.target_province || "?"}${d.targetKingdom || row.target_kingdom ? ` (${d.targetKingdom || row.target_kingdom})` : ""}`, status: d.dragonName || "" };
  if (type === "ritual") return { title: "Ritual", detail: d.attackerProvince || row.attacker_province || "?", status: row.success === false ? "FAILED" : row.success ? "SUCCESS" : "" };
  if (type === "aid") return { title: row.resource_type || d.resourceType || "Aid", detail: `${d.attackerProvince || row.attacker_province || "?"} → ${d.targetProvince || row.target_province || "?"}`, status: row.amount != null ? Number(row.amount).toLocaleString() : "" };
  return { title: row.event_type || "Attack", detail: `${d.attackerProvince || row.attacker_province || "?"} → ${d.targetProvince || row.target_province || "?"}${d.targetKingdom || row.target_kingdom ? ` (${d.targetKingdom || row.target_kingdom})` : ""}`, status: d.acresCaptured != null ? `${d.acresCaptured} acres` : "" };
}

export default function Intel7() {
  const [active, setActive] = useState("thieves");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRows();
    const iv = setInterval(fetchRows, 30000);
    return () => clearInterval(iv);
  }, []);

  async function fetchRows() {
    const { data, error: queryError } = await supabase
      .from("intel7_events")
      .select("*")
      .eq("kingdom", "6:9")
      .order("timestamp", { ascending: false })
      .limit(500);
    if (queryError) setError(queryError.message);
    else { setRows(data || []); setError(""); }
    setLoading(false);
  }

  if (loading) return <div className="loading">⏳ Loading Intel 7...</div>;
  const current = rows.filter(row => row.channel_type === active);
  const label = CHANNELS.find(([id]) => id === active)?.[1] || active;

  return (
    <div className="intel-panel">
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>📡 Seven-Channel Intel — 6:9</h2>
          <span style={{ color: "#64748b", fontSize: 12 }}>Auto-refresh: 30s</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "14px 0" }}>
          {CHANNELS.map(([id, text]) => <button key={id} onClick={() => setActive(id)} style={{ opacity: active === id ? 1 : 0.55 }}>{text}</button>)}
        </div>
        {error && <div style={{ color: "#f87171", marginBottom: 10 }}>Intel 7 database error: {error}</div>}
        <div style={{ color: "#38bdf8", fontWeight: 700, marginBottom: 10 }}>{label} — {current.length}</div>
        {current.length === 0 ? <p style={{ color: "#64748b", textAlign: "center", padding: 28 }}>No new 6:9 events recorded for this channel yet.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {current.map((row, i) => { const item = normalize(row); return <div key={row.id || i} style={{ padding: "9px 12px", border: "1px solid rgba(255,255,255,.07)", borderRadius: 7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{item.title}</strong><span style={{ color: "#64748b", fontSize: 11 }}>{ago(row.timestamp)}</span></div>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 3 }}>{item.detail}</div>
              {item.status && <div style={{ color: "#facc15", fontSize: 11, marginTop: 3 }}>{item.status}</div>}
            </div>; })}
          </div>
        )}
      </div>
    </div>
  );
}
