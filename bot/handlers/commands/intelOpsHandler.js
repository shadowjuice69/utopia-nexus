const supabaseService = require("../../services/supabase");

const PAGE_TYPES = ["throne", "som", "science", "survey", "state", "kingdom-page", "news"];
const label = { throne: "Thr", som: "Mil", science: "Sci", survey: "Def", state: "Gld", "kingdom-page": "KD", news: "Srv" };

function age(ts) {
  if (!ts) return "—";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
function n(v) { const x = Number(String(v ?? "").replace(/,/g, "")); return Number.isFinite(x) ? x : null; }
function fmt(v) { return v == null ? "?" : Number(v).toLocaleString(); }
function getArmyRows(armies) {
  return Array.isArray(armies) ? armies.filter(Boolean).map(a => ({
    returnDays: n(a.return_days ?? a.returnDays ?? a.days_left ?? a.days),
    troops: a.troops || {}, target: a.target || a.target_province || a.targetProvince || null,
    acres: n(a.acres ?? a.land ?? a.land_gained)
  })) : [];
}

async function identity(sb, userId) {
  const { data: direct } = await sb.from("provinces").select("name,kd_code,land,acres,nw,discord_id,user_id,r_tpa,r_wpa,ome,dme").eq("discord_id", userId).limit(1);
  if (direct?.[0]) return direct[0];
  const { data: p } = await sb.from("provinces").select("name,kd_code,land,acres,nw,discord_id,user_id,r_tpa,r_wpa,ome,dme").eq("user_id", userId).limit(1);
  return p?.[0] || null;
}

async function check(sb, kd) {
  const { data } = await sb.from("intel_page_ingest").select("province,data_type,received_at").eq("kd_code", kd).order("received_at", { ascending: false }).limit(1500);
  const rows = data || [];
  const map = new Map();
  for (const r of rows) {
    if (!r.province) continue;
    const key = r.province;
    if (!map.has(key)) map.set(key, {});
    const m = map.get(key);
    if (!m[r.data_type]) m[r.data_type] = r.received_at;
  }
  const provinces = [...map.keys()].sort((a,b) => a.localeCompare(b)).slice(0,25);
  let covered = 0;
  const out = provinces.map(p => {
    const m = map.get(p); const cells = PAGE_TYPES.map(t => m[t] ? "✓" : "·").join("");
    if (PAGE_TYPES.every(t => m[t])) covered++;
    return `• ${p.slice(0,22).padEnd(22)} ${cells}  ${PAGE_TYPES.filter(t=>!m[t]).map(t=>label[t]).join(",") || "OK"}`;
  });
  return `🧭 **Intel check — ${kd}**\n\`Thr Mil Sci Def Gld KD Srv\`\n**${provinces.length} provinces indexed · ${covered}/${provinces.length} complete**\n${out.join("\n") || "No captured provinces."}\n\n✓ captured  · · missing  · age is based on latest stored page`;
}

async function captureHealth(sb, kd, province) {
  const { data } = await sb.from("intel_page_ingest").select("province,data_type,received_at").eq("kd_code", kd).eq("province", province).order("received_at", { ascending: false }).limit(100);
  const latest = {};
  for (const r of data || []) if (!latest[r.data_type]) latest[r.data_type] = r.received_at;
  const lines = PAGE_TYPES.map(t => `${label[t].padEnd(3)} ${latest[t] ? `✓ ${age(latest[t])}` : "❌ missing"}`);
  return `🩺 **Capture health — ${province} (${kd})**\n${lines.join(" · ")}\n\nThis reports stored arrivals; it does not infer a page was collected when no record exists.`;
}

async function status(sb, p) {
  const kd = p.kd_code;
  const [mQ,tQ,sQ,gQ] = await Promise.all([
    sb.from("intel_military").select("offense,defense,generals,troops,updated_at").eq("province",p.name).eq("kd_code",kd).order("updated_at",{ascending:false}).limit(1),
    sb.from("intel_throne").select("thieves,wizards,tpa,wpa,ome,dme,updated_at").eq("province",p.name).eq("kd_code",kd).order("updated_at",{ascending:false}).limit(1),
    sb.from("intel_state").select("money,food,runes,peasants,updated_at").eq("province",p.name).eq("kd_code",kd).order("updated_at",{ascending:false}).limit(1),
    sb.from("intel_game_state").select("soldier_count,updated_at").eq("province",p.name).eq("kd_code",kd).order("updated_at",{ascending:false}).limit(1)
  ]);
  const m=mQ.data?.[0]||{}, t=tQ.data?.[0]||{}, s=sQ.data?.[0]||{}, g=gQ.data?.[0]||{};
  return `📊 **${p.name} — Status**\n**Offense:** ${fmt(m.offense)} · **Defense:** ${fmt(m.defense)} · **Gens:** ${fmt(m.generals)}\n**rTPA:** ${t.tpa ?? p.r_tpa ?? "?"} · **rWPA:** ${t.wpa ?? p.r_wpa ?? "?"}\n**Gold:** ${fmt(s.money)} · **Food:** ${fmt(s.food)} · **Runes:** ${fmt(s.runes)}\n**Peasants:** ${fmt(s.peasants)} · **Soldiers:** ${fmt(g.soldier_count)}\n_Stored intel: military ${age(m.updated_at)} · self ${age(s.updated_at)}_`;
}

async function left(sb, kd) {
  const { data } = await sb.from("intel_military").select("province,offense,generals,troops,updated_at").eq("kd_code",kd).order("updated_at",{ascending:false}).limit(100);
  const rows=[]; let total=0, gens=0;
  for(const r of data||[]) { const off=n(r.offense)||0; total+=off; gens+=n(r.generals)||0; rows.push({name:r.province,off,gens:r.generals,age:age(r.updated_at)}); }
  rows.sort((a,b)=>b.off-a.off);
  return `🏠 **Leftover offense — ${kd}**\n${rows.slice(0,25).map((r,i)=>`#${i+1} ${r.name} — ${fmt(r.off)} off · ${fmt(r.gens)}g avail _(${r.age})_`).join("\n") || "No military captures."}\n\n**total at-home offense:** ${fmt(total)} · **generals:** ${fmt(gens)}\n_Only captured military values are included._`;
}

async function survey(sb, query, kd) {
  const { data } = await sb.from("intel_buildings").select("province,buildings,updated_at").eq("kd_code",kd).ilike("province",`%${query}%`).order("updated_at",{ascending:false}).limit(1);
  const r=data?.[0]; if(!r) return `❌ No Survey/building capture found for **${query}** in ${kd}.`;
  const b=r.buildings||{}; const parts=Object.entries(b).slice(0,10).map(([k,v])=>`${k.replace(/_/g," ")} ${v?.qty ?? "?"} (${v?.pct ?? "?"}%)`);
  return `🏗️ **${r.province} — Survey** · ${age(r.updated_at)}\n${parts.join(" · ") || "No building rows parsed."}`;
}

async function econ(sb, kd, province) {
  const { data } = await sb.from("intel_state").select("province,daily_income,daily_wages,peasants,unemployed,unfilled_jobs,food_net_yesterday,runes_net_yesterday,updated_at").eq("kd_code",kd).eq("province",province).order("updated_at",{ascending:false}).limit(1);
  const r=data?.[0]; if(!r) return `❌ No economy/state capture for **${province}**.`;
  const net=(n(r.daily_income)||0)-(n(r.daily_wages)||0);
  return `💰 **${province} — Economy** _${age(r.updated_at)}_\nPeasants ${fmt(r.peasants)} · idle ${fmt(r.unemployed)} · unfilled jobs ${fmt(r.unfilled_jobs)}\nIncome ${fmt(r.daily_income)}/day · wages ${fmt(r.daily_wages)}/day\n**NET ${net>=0?"+":""}${fmt(net)}/day**\nFood net yesterday ${fmt(r.food_net_yesterday)} · Runes net yesterday ${fmt(r.runes_net_yesterday)}`;
}

async function kdecon(sb,kd){
  const {data}=await sb.from("intel_state").select("province,daily_income,daily_wages,updated_at").eq("kd_code",kd).order("updated_at",{ascending:false}).limit(100);
  const latest=new Map(); for(const r of data||[]) if(!latest.has(r.province)) latest.set(r.province,r);
  const rows=[...latest.values()].sort((a,b)=>(n(b.daily_income)||0)-(n(a.daily_income)||0));
  const ti=rows.reduce((s,r)=>s+(n(r.daily_income)||0),0), tw=rows.reduce((s,r)=>s+(n(r.daily_wages)||0),0);
  return `💰 **KD Economy — ${kd}**\n${rows.slice(0,25).map(r=>`${r.province} · ${fmt(r.daily_income)} income · ${fmt(r.daily_wages)} wages · ${age(r.updated_at)}`).join("\n") || "No economy captures."}\n\n**${rows.length} provinces** · income ${fmt(ti)} · wages ${fmt(tw)}\n_Forward projections use the shared Resource Forecast engine when available; this view does not fabricate a rate._`;
}

async function oprate(sb,kd){
  const {data}=await sb.from("intel_ops").select("province,operation,success,last_seen").eq("kd_code",kd).limit(2000);
  const map=new Map(); for(const r of data||[]){ const key=r.province||"?"; if(!map.has(key))map.set(key,{off:[],thief:[],intel:[]}); const x=map.get(key); const op=String(r.operation||"").toLowerCase(); const bucket=op.includes("spy")||op.includes("fireball")||op.includes("storm")||op.includes("spell")?"off":op.includes("thief")||op.includes("rob")||op.includes("kidnap")||op.includes("bribe")?"thief":"intel"; if(typeof r.success==="boolean")x[bucket].push(r.success); }
  const rate=a=>a.length?(100*a.filter(Boolean).length/a.length).toFixed(0)+"%":"--";
  return `📈 **Op rates — ${kd}**\n${[...map.entries()].slice(0,25).map(([p,x])=>`${p} · off ${rate(x.off)} · thief ${rate(x.thief)} · intel ${rate(x.intel)}`).join("\n") || "No operation records."}\n\n_-- = no classified outcomes; unknown outcomes are not counted._`;
}

async function tppa(sb,kd){
  const {data}=await sb.from("provinces").select("name,slot,kd_code,acres,peons,soldiers,off_specs,def_specs,elites,thieves,wizards,prisoners").eq("kd_code",kd).limit(100);
  const rows=[]; for(const p of data||[]){const land=n(p.acres); if(!land)continue; const pop=[p.peons,p.soldiers,p.off_specs,p.def_specs,p.elites,p.thieves,p.wizards,p.prisoners].reduce((s,v)=>s+(n(v)||0),0); rows.push({p,d:pop/land});} rows.sort((a,b)=>b.d-a.d);
  const totalPop=rows.reduce((s,r)=>s+r.d*(n(r.p.acres)||0),0), totalLand=rows.reduce((s,r)=>s+(n(r.p.acres)||0),0);
  return `👥 **TPPA — ${kd}** · ${rows.length} provinces\n${rows.map(r=>`${r.p.slot||"-"} ${r.p.name} · ${r.d.toFixed(2)} tppa · ${fmt(r.p.acres)}a`).join("\n") || "No normalized province data."}\n\n**KD:** ${totalLand? (totalPop/totalLand).toFixed(2):"?"} tppa · ${fmt(totalLand)} acres\n_Uses normalized captured population components; missing components are treated as unavailable for that province._`;
}

async function plunders(sb,kd,p){
  const attackerNW=n(p.nw); if(!attackerNW) return "❌ Your networth is unavailable; cannot rank plunder targets without fabricating the NW range.";
  const minNW=attackerNW*0.85,maxNW=attackerNW*1.25;
  const {data}=await sb.from("provinces").select("name,slot,nw,acres,kd_code").neq("kd_code",kd).gte("nw",minNW).lte("nw",maxNW).order("nw",{ascending:false}).limit(10);
  return `💰 **PLUNDERS — ${p.name}** · NW ${fmt(attackerNW)}\nrange 85–125% NW → ${fmt(minNW)}–${fmt(maxNW)}\n${(data||[]).map(x=>`#${x.slot||"?"} ${x.name} · NW ${fmt(x.nw)} · ${fmt(x.acres)}a`).join("\n") || "No normalized targets in range."}\n\n_Target ranking requires current gold/SoT/protection intel; no gold value is invented here._`;
}

async function incoming(sb,kd){
  const {data}=await sb.from("intel_military").select("province,armies,updated_at").eq("kd_code",kd).limit(100);
  const hits=[]; for(const r of data||[]) for(const a of getArmyRows(r.armies)) if(a.target) hits.push({owner:r.province,...a,age:age(r.updated_at)});
  return `📥 **Incoming — ${kd}**\n${hits.length?hits.slice(0,20).map(a=>`${a.target} ← ${a.owner} · ${a.returnDays==null?"?":a.returnDays+"d"} · ${a.age}`).join("\n"):"nothing incoming"}\n_Parsed from stored military army records; no incoming is inferred when the source does not identify a target._`;
}

async function eta(sb,kd,p){
  const {data}=await sb.from("intel_military").select("province,armies,updated_at").eq("kd_code",kd).eq("province",p.name).limit(1);
  const hits=[]; for(const r of data||[]) for(const a of getArmyRows(r.armies)) hits.push({...a,age:age(r.updated_at)});
  hits.sort((a,b)=>(a.returnDays??9999)-(b.returnDays??9999));
  return `⏱ **Returning — ${p.name}**\n${hits.length?hits.slice(0,10).map(a=>`${a.returnDays==null?"?":a.returnDays+"d"} · ${a.target||"army"} · ${a.age}`).join("\n"):"nothing out"}\n_Only armies explicitly present in the latest stored military record are shown._`;
}

module.exports = async function intelOpsHandler(interaction){
  const sb=supabaseService.getClient(); if(!sb) return interaction.reply({content:"❌ Supabase is unavailable.",ephemeral:true});
  const me=await identity(sb,interaction.user.id); if(!me) return interaction.reply({content:"❌ No Nexus province identity found. Register/link your province first.",ephemeral:true});
  const kd=me.kd_code;
  const sub=interaction.options.getSubcommand();
  let content;
  switch(sub){
    case "check": content=await check(sb,kd); break;
    case "capturehealth": content=await captureHealth(sb,kd,me.name); break;
    case "incoming": content=await incoming(sb,kd); break;
    case "eta": content=await eta(sb,kd,me); break;
    case "status": content=await status(sb,me); break;
    case "left": content=await left(sb,kd); break;
    case "plunders": content=await plunders(sb,kd,me); break;
    case "survey": content=await survey(sb,interaction.options.getString("province",true),kd); break;
    case "oprate": content=await oprate(sb,kd); break;
    case "kdecon": content=await kdecon(sb,kd); break;
    case "econ": content=await econ(sb,kd,me.name); break;
    case "tppa": content=await tppa(sb,kd); break;
    default: content="❌ Unknown Nexus intel command.";
  }
  return interaction.reply({content:content.slice(0,1950)});
};
