import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

const SOURCES = [
  ["intel_throne", "Throne"], ["intel_buildings", "Buildings"], ["intel_science", "Science"],
  ["intel_military", "Military"], ["intel_state", "State"], ["intel_kd_stats", "KD Stats"],
  ["intel_ops", "Ops"]
];
const TIME_FIELDS = { intel_throne:"updated_at", intel_buildings:"updated_at", intel_science:"updated_at", intel_military:"updated_at", intel_state:"updated_at", intel_kd_stats:"updated_at", intel_ops:"updated_at" };
const stamp = r => r?.updated_at || r?.last_seen || r?.created_at || null;
const keyFor = r => `${r?.kd_code || "?"}::${r?.province || r?.province_name || r?.name || "Unknown province"}`;

async function readSource(table) {
  const { data, error } = await supabase.from(table).select("*").order(TIME_FIELDS[table], { ascending:false, nullsFirst:false }).limit(500);
  return { table, rows:data || [], error:error?.message || "" };
}

export default function AllIntel() {
  const [rows,setRows]=useState([]), [loading,setLoading]=useState(true), [error,setError]=useState(""), [search,setSearch]=useState(""), [selected,setSelected]=useState(null);
  const refresh=useCallback(async()=>{
    setError("");
    const results=await Promise.all(SOURCES.map(([table])=>readSource(table)));
    const bad=results.filter(x=>x.error);
    const groups=new Map();
    for(const {table,rows:sourceRows} of results){
      for(const r of sourceRows){
        if(!r?.kd_code) continue;
        const key=keyFor(r); let g=groups.get(key);
        if(!g){g={key,kd:r.kd_code,province:r.province||r.province_name||r.name||"Unknown province",location:r.location||r.map||"",sources:{},latest:null,ops:[]};groups.set(key,g)}
        g.sources[table]=(g.sources[table]||0)+1;
        if(table==="intel_ops") g.ops.push(r);
        if(!g.latest || new Date(stamp(r)||0)>new Date(g.latest.time||0)) g.latest={time:stamp(r),source:table};
        if(!g.location && (r.location||r.map)) g.location=r.location||r.map;
      }
    }
    for(const g of groups.values()) g.ops.sort((a,b)=>new Date(b.last_seen||b.updated_at||0)-new Date(a.last_seen||a.updated_at||0));
    setRows([...groups.values()].sort((a,b)=>new Date(b.latest?.time||0)-new Date(a.latest?.time||0)));
    if(bad.length) setError(bad.map(x=>`${x.table}: ${x.error}`).join(" | "));
    setLoading(false);
  },[]);
  useEffect(()=>{refresh();const iv=setInterval(refresh,30000);return()=>clearInterval(iv)},[refresh]);
  const shown=useMemo(()=>{const q=search.trim().toLowerCase();return q?rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q)):rows},[rows,search]);
  if(loading)return <div className="loading">⏳ Loading ALL enemy-visible intelligence...</div>;
  return <div className="intel-panel"><div className="panel">
    <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><div><h2 style={{margin:0}}>🌐 ALL Intel</h2><small style={{opacity:.7}}>Combined province view across every structured enemy-intel source. Location/KD is shown on every row.</small></div><button onClick={refresh}>↻ Refresh</button></div>
    {error&&<div style={{color:"#f87171",marginTop:8}}>⚠ {error}</div>}
    <div style={{display:"flex",gap:8,margin:"12px 0"}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search province, KD, location, operation..." style={{flex:1,minWidth:220}}/><span style={{opacity:.65}}>{shown.length} provinces</span></div>
    <div style={{display:"grid",gap:8}}>{shown.map(g=><details key={g.key} open={selected===g.key} onToggle={e=>e.currentTarget.open?setSelected(g.key):setSelected(null)} style={{border:"1px solid rgba(148,163,184,.18)",borderRadius:8,padding:10}}>
      <summary style={{cursor:"pointer"}}><b>{g.province}</b> · <b>{g.kd}</b> · {g.location||"Location not captured"} · <span style={{opacity:.7}}>{Object.keys(g.sources).length}/{SOURCES.length} sources</span></summary>
      <div style={{display:"grid",gap:8,marginTop:10}}>
        <div style={{fontSize:12,opacity:.8}}>📍 Location: <b>{g.location||"—"}</b> · Kingdom: <b>{g.kd}</b> · Latest: {g.latest?.time?new Date(g.latest.time).toLocaleString():"—"}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{SOURCES.map(([t,label])=><span key={t} style={{padding:"3px 7px",borderRadius:6,border:"1px solid rgba(148,163,184,.18)",fontSize:11}}>{label}: {g.sources[t]||0}</span>)}</div>
        {g.ops.length>0&&<div><b>🗡️ Operations</b>{g.ops.slice(0,12).map((o,i)=><div key={o.id||i} style={{padding:"6px 0",borderBottom:"1px solid rgba(148,163,184,.08)",fontSize:12}}><b>{o.operation||"Operation"}</b> → {o.target_province||"?"} · {o.success===false?"FAIL":"SUCCESS"} · seen {o.last_seen?new Date(o.last_seen).toLocaleString():"—"}</div>)}</div>}
        <button onClick={()=>setSelected(g.key===selected?null:g.key)} style={{width:"fit-content"}}>View combined record</button>
      </div>
    </details>)}</div>
    {!shown.length&&<p style={{opacity:.65}}>No structured province records match this filter.</p>}
  </div></div>;
}
