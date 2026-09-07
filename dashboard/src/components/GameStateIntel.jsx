import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

function fmt(value) {
  return value == null ? "—" : Number(value).toLocaleString();
}

export default function GameStateIntel() {
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const province = useMemo(() => sessionStorage.getItem("nexus_province") || "", []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      let query = supabase.from("intel_game_state").select("*").order("updated_at", { ascending: false }).limit(1);
      if (province) query = supabase.from("intel_game_state").select("*").eq("province", province).order("updated_at", { ascending: false }).limit(1);
      const { data, error: queryError } = await query;
      if (cancelled) return;
      if (queryError) setError(queryError.message);
      else setRow(data?.[0] || null);
      setLoading(false);
    }
    load();
    const timer = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [province]);

  if (loading && !row) return <section className="panel"><h2>Game State</h2><p>Loading structured game state…</p></section>;
  if (error) return <section className="panel"><h2>Game State</h2><p>Unable to load game state: {error}</p></section>;
  if (!row) return <section className="panel"><h2>Game State</h2><p>No structured game-state snapshot has been received yet.</p></section>;

  const units = row.units && typeof row.units === "object" ? Object.values(row.units) : [];

  return (
    <section className="panel">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:12}}>
        <div><h2>Game State</h2><div style={{opacity:.7}}>{row.province} · {row.kd_code}</div></div>
        <div style={{opacity:.7,fontSize:12}}>Updated {new Date(row.updated_at).toLocaleString()}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginTop:16}}>
        {[["Money",row.money],["Peasants",row.peasants],["Food",row.food],["Runes",row.runes],["Net Worth",row.net_worth],["Land",row.land],["NW/Acre",row.net_worth_per_acre],["Total Pop",row.total_population],["Military + Thieves",row.military_thief_population],["Wizards",row.wizard_population],["Soldiers",row.soldier_count],["Free Credits",row.free_specialist_credits]].map(([label,value])=><div key={label} style={{padding:10,border:"1px solid rgba(255,255,255,.08)",borderRadius:8}}><div style={{fontSize:11,opacity:.65}}>{label}</div><div style={{fontWeight:700,marginTop:4}}>{fmt(value)}</div></div>)}
      </div>
      <div style={{marginTop:18}}>
        <h3>Training</h3>
        <div style={{opacity:.8,fontSize:13,marginBottom:8}}>Base speed: {row.base_training_speed_days ?? "—"} days · Added credits: {fmt(row.added_credits)} · Version: {row.version || "—"}</div>
        {units.length ? <div style={{display:"grid",gap:6}}>{units.map((u)=><div key={u.name} style={{display:"grid",gridTemplateColumns:"1.4fr repeat(4,1fr)",gap:8,padding:"7px 9px",borderBottom:"1px solid rgba(255,255,255,.06)",fontSize:13}}><span>{u.name}</span><span>Own {fmt(u.owned)}</span><span>Train {fmt(u.training)}</span><span>Cost {fmt(u.cost)}gc</span><span>Max {fmt(u.max)}</span></div>)}</div> : <div style={{opacity:.7}}>No unit training rows in the latest snapshot.</div>}
      </div>
    </section>
  );
}
