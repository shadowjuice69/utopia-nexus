import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const EMPTY = { name:"", description:"", race:"", personality:"", role:"", buildings:{}, military:{}, science:{}, spells:{}, thievery:{}, priorities:{}, notes:"", active:true };

function JsonEditor({ label, value, onChange }) {
  const [text, setText] = useState(JSON.stringify(value || {}, null, 2));
  useEffect(() => setText(JSON.stringify(value || {}, null, 2)), [value]);
  return <label style={{display:"block", marginBottom:10}}><div style={{color:"#aaa",fontSize:11,marginBottom:4}}>{label}</div><textarea value={text} onChange={e=>setText(e.target.value)} onBlur={()=>{try{onChange(JSON.parse(text));}catch{return;}}} style={{width:"100%",minHeight:80,boxSizing:"border-box",background:"#111",color:"#ddd",border:"1px solid #444",borderRadius:6,padding:8,fontFamily:"monospace",fontSize:11}} /></label>;
}

export default function AIReferenceBuilds() {
  const [builds,setBuilds]=useState([]), [selected,setSelected]=useState(null), [form,setForm]=useState(EMPTY), [loading,setLoading]=useState(true), [saving,setSaving]=useState(false), [msg,setMsg]=useState("");
  async function load(){ setLoading(true); const {data,error}=await supabase.from("ai_builds").select("*").order("updated_at",{ascending:false}); if(error)setMsg(error.message); else setBuilds(data||[]); setLoading(false); }
  useEffect(()=>{load()},[]);
  function edit(b){setSelected(b.id);setForm({...b});setMsg("");}
  function add(){setSelected("new");setForm({...EMPTY});setMsg("");}
  async function save(){ setSaving(true);setMsg(""); const payload={...form,version:form.version||1,updated_at:new Date().toISOString()}; delete payload.id; delete payload.created_at; const result=selected==="new"?await supabase.from("ai_builds").insert(payload).select().single():await supabase.from("ai_builds").update(payload).eq("id",selected).select().single(); if(result.error)setMsg(result.error.message); else {setMsg("Saved");await load();if(selected==="new")setSelected(result.data.id);setForm(result.data);} setSaving(false); }
  async function archive(){if(!selected||selected==="new")return;const {error}=await supabase.from("ai_builds").update({active:false,updated_at:new Date().toISOString()}).eq("id",selected);if(error)setMsg(error.message);else{setMsg("Archived");load();}}
  async function toggle(){if(!selected||selected==="new")return;const {error}=await supabase.from("ai_builds").update({active:!form.active,updated_at:new Date().toISOString()}).eq("id",selected);if(error)setMsg(error.message);else{setForm({...form,active:!form.active});setMsg(form.active?"Deactivated":"Activated");load();}}
  if(loading)return <div style={{padding:20,color:"#aaa",fontFamily:"monospace"}}>Loading reference builds...</div>;
  return <div style={{padding:12,fontFamily:"monospace",color:"#ddd"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h2 style={{margin:0,color:"#34d399",fontSize:16}}>🧠 AI Reference Builds</h2><div><button onClick={add} style={btn}>＋ Add Build</button> <button onClick={load} style={btn}>Refresh</button></div></div>
    {msg&&<div style={{background:"#182018",border:"1px solid #365936",padding:8,borderRadius:6,marginBottom:10,fontSize:11}}>{msg}</div>}
    <div style={{display:"grid",gridTemplateColumns:"minmax(220px, .7fr) minmax(320px,1.3fr)",gap:12}}>
      <div>{!builds.length&&<div style={{color:"#888"}}>No reference builds yet. Add Savage's first build.</div>}{builds.map(b=><div key={b.id} onClick={()=>edit(b)} style={{padding:10,marginBottom:7,border:"1px solid "+(selected===b.id?"#34d399":"#333"),borderRadius:7,background:"#171717",cursor:"pointer"}}><div style={{fontWeight:"bold"}}>{b.name||"Unnamed build"}</div><div style={{fontSize:10,color:"#888"}}>{b.race||"Any race"} · {b.personality||"Any personality"} · {b.role||"General"}</div><div style={{fontSize:10,color:b.active?"#65d48a":"#777",marginTop:4}}>{b.active?"ACTIVE":"INACTIVE"} · v{b.version||1}</div></div>)}</div>
      {selected&&<div style={{background:"#171717",border:"1px solid #333",borderRadius:8,padding:12}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><Field label="Name" value={form.name} set={v=>setForm({...form,name:v})}/><Field label="Role" value={form.role} set={v=>setForm({...form,role:v})}/><Field label="Race" value={form.race} set={v=>setForm({...form,race:v})}/><Field label="Personality" value={form.personality} set={v=>setForm({...form,personality:v})}/></div><Field label="Description" value={form.description} set={v=>setForm({...form,description:v})}/><JsonEditor label="Buildings" value={form.buildings} onChange={v=>setForm({...form,buildings:v})}/><JsonEditor label="Military" value={form.military} onChange={v=>setForm({...form,military:v})}/><JsonEditor label="Science" value={form.science} onChange={v=>setForm({...form,science:v})}/><JsonEditor label="Spells" value={form.spells} onChange={v=>setForm({...form,spells:v})}/><JsonEditor label="Thievery" value={form.thievery} onChange={v=>setForm({...form,thievery:v})}/><JsonEditor label="Priorities" value={form.priorities} onChange={v=>setForm({...form,priorities:v})}/><Field label="Notes" value={form.notes} set={v=>setForm({...form,notes:v})} area/><div style={{display:"flex",gap:7,marginTop:8}}><button onClick={save} disabled={saving} style={btn}>{saving?"Saving...":"Save Changes"}</button>{selected!=="new"&&<><button onClick={toggle} style={btn}>{form.active?"Deactivate":"Activate"}</button><button onClick={archive} style={btn}>Archive</button></>}</div></div>}
    </div>
  </div>;
}
function Field({label,value,set,area}){return <label style={{display:"block",marginBottom:9}}><div style={{color:"#aaa",fontSize:11,marginBottom:4}}>{label}</div>{area?<textarea value={value||""} onChange={e=>set(e.target.value)} style={inputStyle}/>:<input value={value||""} onChange={e=>set(e.target.value)} style={inputStyle}/>}</label>}
const inputStyle={width:"100%",boxSizing:"border-box",background:"#111",color:"#ddd",border:"1px solid #444",borderRadius:6,padding:7,fontFamily:"monospace",fontSize:11};
const btn={background:"#222",border:"1px solid #444",color:"#ddd",borderRadius:6,padding:"6px 10px",cursor:"pointer",fontFamily:"monospace",fontSize:11};
