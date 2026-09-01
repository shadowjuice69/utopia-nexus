import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase";

const TYPES = ["war", "cf", "pump", "recovery", "defense", "economy", "custom"];
const EMPTY = { name:"", build_type:"war", province_id:"", description:"", race:"", personality:"", role:"", raw_text:"", buildings:{}, military:{}, science:{}, spells:{}, thievery:{}, priorities:[], notes:"", active:true, version:1 };
const emptyParsed = {buildings:{},military:{},science:{},spells:{},thievery:{},priorities:[]};

function parseBuild(text) {
  const out = {...emptyParsed}; let section=""; const lines=text.split(/\r?\n/);
  for (const raw of lines) {
    const line=raw.replace(/[*_]/g,"").trim(); if(!line) continue;
    const upper=line.toUpperCase();
    if(upper.includes("ECONOMY SCIENCE")){section="economy";continue;}
    if(upper.includes("MILITARY SCIENCE")){section="militaryScience";continue;}
    if(upper.includes("ARCANE SCIENCE")){section="arcane";continue;}
    if(upper.includes("SCIENCE ALLOCATION")){section="science";continue;}
    let m=line.match(/^(.+?)\s*[—-]\s*(\d+(?:\.\d+)?)%\s*$/);
    if(m && !upper.includes("SET BY")){out.buildings[m[1].trim().toLowerCase().replace(/[^a-z0-9]+/g,"_")]=Number(m[2]);continue;}
    m=line.match(/^(.+?)\s*[—-]\s*(\d+(?:\.\d+)?)\s*(ppa|tpa|wpa|ospa|epa\/dspa)\b/i);
    if(m){out.military[m[1].trim().toLowerCase().replace(/[^a-z0-9]+/g,"_")]={value:Number(m[2]),metric:m[3].toLowerCase()};continue;}
    m=line.match(/^(.+?)\s*[—-]\s*(\d+)\s*books?\b/i);
    if(m){out.science[m[1].trim().toLowerCase().replace(/[^a-z0-9]+/g,"_")]=Number(m[2]);continue;}
    m=line.match(/^(\d+)x\s+(.+)$/i);
    if(m && ["economy","militaryScience","arcane"].includes(section)){out.science[section+"_"+m[2].trim().toLowerCase().replace(/[^a-z0-9]+/g,"_")]=Number(m[1]);continue;}
    if(/^(peasants|thieves|wizards|off specs|elites\/acre)/i.test(line)) continue;
    if(section==="economy"||section==="militaryScience"||section==="arcane") { m=line.match(/^(\d+)x\s+(.+)$/i); if(m) out.science[section+"_"+m[2].trim().toLowerCase().replace(/[^a-z0-9]+/g,"_")]=Number(m[1]); }
  }
  const ratios=[...text.matchAll(/^(?:\s*)(peasants|thieves|wizards|off specs|elites\/acre[^—-]*)\s*[—-]\s*([\d+.]+)(ppa|tpa|wpa|ospa|epa\/dspa)/gim)];
  for(const x of ratios) out.military[x[1].trim().toLowerCase().replace(/[^a-z0-9]+/g,"_")]={value:Number(x[2]),metric:x[3].toLowerCase(),minimum:/at least|first/i.test(x[1]+x[0])};
  return out;
}
function pretty(v){return JSON.stringify(v??{},null,2)}
function typeLabel(t){return {war:"⚔️ War",cf:"🕊️ CF",pump:"📈 Pump",recovery:"🛡️ Recovery",defense:"🧱 Defense",economy:"💰 Economy",custom:"🔧 Custom"}[t]||t}

export default function AIBuildManager(){
 const [builds,setBuilds]=useState([]),[selectedId,setSelectedId]=useState(null),[draft,setDraft]=useState(EMPTY),[raw,setRaw]=useState(""),[parsed,setParsed]=useState(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function load(){setLoading(true);const {data,error}=await supabase.from("ai_builds").select("*").order("active",{ascending:false}).order("name");if(error)setError(error.message);else setBuilds(data||[]);setLoading(false)}
 useEffect(()=>{load()},[]);
 function select(b){setSelectedId(b.id);setDraft({...EMPTY,...b});setRaw(b.raw_text||"");setParsed(null);setError("");setNotice("")}
 function fresh(){setSelectedId(null);setDraft({...EMPTY});setRaw("");setParsed(null);setError("");setNotice("")}
 function parse(){if(!raw.trim()){setError("Paste Savage's build first.");return}const p=parseBuild(raw);setParsed(p);setDraft(d=>({...d,...p,raw_text:raw}));setError("");setNotice("Build parsed. Review the detected sections, then save.")}
 async function save(){setSaving(true);setError("");const p=parsed||parseBuild(raw);const payload={...draft,...p,raw_text:raw,version:selectedId?((builds.find(b=>b.id===selectedId)?.version||1)+1):1};delete payload.id;delete payload.created_at;delete payload.updated_at;
  if(selectedId){const current=builds.find(b=>b.id===selectedId);const {error:ve}=await supabase.from("ai_build_versions").insert({build_id:selectedId,version:payload.version,snapshot:current});if(ve){setError(ve.message);setSaving(false);return}const {data,error}=await supabase.from("ai_builds").update(payload).eq("id",selectedId).select().single();if(error)setError(error.message);else{setBuilds(x=>x.map(b=>b.id===data.id?data:b));select(data);setNotice(`Saved ${data.name} v${data.version}`)}}
  else {const {data,error}=await supabase.from("ai_builds").insert(payload).select().single();if(error)setError(error.message);else{setBuilds(x=>[...x,data]);select(data);setNotice(`Created ${data.name}`)}}setSaving(false)}
 async function toggle(){if(!selectedId)return;const {data,error}=await supabase.from("ai_builds").update({active:!draft.active}).eq("id",selectedId).select().single();if(error)setError(error.message);else{setBuilds(x=>x.map(b=>b.id===data.id?data:b));select(data)}}
 return <div style={{fontFamily:"monospace",padding:12,color:"#ddd"}}>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h2 style={{margin:0,color:"#34d399"}}>🧠 Savage Build Library</h2><button onClick={fresh}>＋ Add Build</button></div>
  <div style={{display:"grid",gridTemplateColumns:"minmax(230px,.65fr) minmax(350px,1.35fr)",gap:14}}>
   <section className="panel"><div className="panel-header"><h3>Saved Builds</h3><button onClick={load}>Refresh</button></div>{loading?<div>Loading...</div>:builds.length?builds.map(b=><button key={b.id} onClick={()=>select(b)} style={{display:"block",width:"100%",textAlign:"left",padding:10,marginBottom:7,borderRadius:7,border:selectedId===b.id?"1px solid #34d399":"1px solid #334155",background:"#111827",color:"inherit"}}><b>{b.name||"Unnamed"}</b><br/><small>{typeLabel(b.build_type)} · v{b.version||1} · {b.active?"🟢 Active":"⚪ Inactive"}</small></button>):<div style={{color:"#888"}}>No builds yet.</div>}</section>
   <section className="panel">
    <div className="panel-header"><h3>{selectedId?"Update Build":"New Build"}</h3></div>
    {error&&<div style={{border:"1px solid #ef4444",padding:9,marginBottom:9,borderRadius:6}}>{error}</div>}{notice&&<div style={{border:"1px solid #34d399",padding:9,marginBottom:9,borderRadius:6}}>{notice}</div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}><label>Build Name<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Build Type<select value={draft.build_type} onChange={e=>setDraft({...draft,build_type:e.target.value})}>{TYPES.map(t=><option key={t} value={t}>{typeLabel(t)}</option>)}</select></label><label>Province / Player<input value={draft.province_id||""} onChange={e=>setDraft({...draft,province_id:e.target.value})}/></label><label>Race<input value={draft.race||""} onChange={e=>setDraft({...draft,race:e.target.value})}/></label><label>Personality<input value={draft.personality||""} onChange={e=>setDraft({...draft,personality:e.target.value})}/></label><label>Role<input value={draft.role||""} onChange={e=>setDraft({...draft,role:e.target.value})}/></label></div>
    <label style={{display:"block",marginTop:10}}>Paste Savage's Complete Build<textarea value={raw} onChange={e=>setRaw(e.target.value)} rows={16} placeholder="Paste the build exactly as Savage sent it. No JSON needed."/></label>
    <div style={{display:"flex",gap:8,margin:"8px 0",flexWrap:"wrap"}}><button onClick={parse}>🔍 Parse Build</button><button disabled={saving} onClick={save}>{saving?"Saving...":selectedId?"💾 Save New Version":"💾 Save Build"}</button>{selectedId&&<button onClick={toggle}>{draft.active?"Disable":"Activate"}</button>}</div>
    {parsed&&<div style={{background:"#0f172a",border:"1px solid #334155",borderRadius:8,padding:10}}><b>✅ Parsed Preview</b><div style={{marginTop:8,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><Preview title="Buildings" value={parsed.buildings}/><Preview title="Military" value={parsed.military}/><Preview title="Science / Books" value={parsed.science}/><Preview title="Other" value={{spells:parsed.spells,thievery:parsed.thievery,priorities:parsed.priorities}}/></div></div>}
    {selectedId&&<div style={{marginTop:10,color:"#888",fontSize:11}}>Saving creates a new version while preserving the previous build snapshot.</div>}
   </section>
  </div>
 </div>
}
function Preview({title,value}){return <div><div style={{color:"#34d399",marginBottom:4}}>{title}</div><pre style={{whiteSpace:"pre-wrap",fontSize:10,margin:0}}>{pretty(value)}</pre></div>}
