import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";
import { loadNexusConfig, getNexusConfig } from "../services/nexusConfig";

const ACTIVE_HOURS = 72;
const ageHours = value => value ? (Date.now() - new Date(value).getTime()) / 3600000 : Infinity;
const statusFor = op => ageHours(op.last_seen || op.updated_at || op.created_at) <= ACTIVE_HOURS ? "ACTIVE" : "STALE";

export default function OpsIntel(){
 const [ops,setOps]=useState([]),[kd,setKd]=useState(""),[loading,setLoading]=useState(true),[search,setSearch]=useState(""),[filter,setFilter]=useState("active");
 const load=useCallback(async()=>{
   const c=await loadNexusConfig(true), currentKd=c?.kd||getNexusConfig().kd||"";
   if(!currentKd){setLoading(false);return;}
   const {data,error}=await supabase.from("intel_ops").select("*").eq("kd_code",currentKd).order("last_seen",{ascending:false}).limit(500);
   if(error) console.error(error);
   setKd(currentKd);setOps(data||[]);setLoading(false);
 },[]);
 useEffect(()=>{load();const iv=setInterval(load,30000);return()=>clearInterval(iv)},[load]);
 const shown=useMemo(()=>{
   const q=search.trim().toLowerCase();
   return ops.filter(o=>{
     const status=statusFor(o);
     if(filter==="active"&&status!=="ACTIVE")return false;
     if(filter==="stale"&&status!=="STALE")return false;
     return !q||JSON.stringify(o).toLowerCase().includes(q);
   });
 },[ops,search,filter]);
 const provinces=useMemo(()=>{
   const map=new Map();
   for(const o of shown){const p=o.province||"Unknown province";if(!map.has(p))map.set(p,[]);map.get(p).push(o)}
   return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
 },[shown]);
 if(loading)return <div className="loading">⏳ Loading active operations...</div>;
 return <div className="intel-panel"><div className="panel">
  <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><div><h2 style={{margin:0}}>🗡️ OPS · {kd}</h2><small style={{opacity:.7}}>Multi-row operation tracker grouped by source province. Active = seen within {ACTIVE_HOURS} hours.</small></div><span>{shown.length} records · {provinces.length} provinces</span></div>
  <div style={{display:"flex",gap:8,margin:"12px 0",flexWrap:"wrap"}}>{[["active","Active"],["all","All observed"],["stale","Stale"]].map(([v,l])=><button key={v} onClick={()=>setFilter(v)}>{l}</button>)}<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search every operation field..." style={{flex:1,minWidth:220}}/></div>
  {provinces.map(([province,list])=><div key={province} style={{border:"1px solid rgba(148,163,184,.18)",borderRadius:8,marginBottom:10,overflow:"hidden"}}>
    <div style={{padding:"9px 10px",fontWeight:700,display:"flex",justifyContent:"space-between",gap:8}}><span>{province}</span><span style={{opacity:.7,fontSize:12}}>{list.length} operations</span></div>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr><th align="left">Status</th><th align="left">Operation</th><th align="left">Category</th><th align="left">Target</th><th align="left">Result</th><th align="left">Threat</th><th align="left">Last Seen</th></tr></thead><tbody>{list.map((o,i)=><tr key={o.id||i}><td>{statusFor(o)}</td><td>{o.operation||"—"}</td><td>{o.category||"—"}</td><td>{o.target_province||"—"}</td><td>{o.success===true?"SUCCESS":o.success===false?"FAIL":"—"}</td><td>{o.threat_score??"—"}</td><td>{o.last_seen?new Date(o.last_seen).toLocaleString():"—"}</td></tr>)}</tbody></table></div>
  </div>)}
  {!provinces.length&&<p style={{opacity:.65}}>No operations match this view. Switch to <b>All observed</b> to see older intelligence.</p>}
 </div></div>;
}
