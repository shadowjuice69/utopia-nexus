const supabaseService = require("../../services/supabase");
const nexusIdentity = require("../../services/nexusIdentityService");
const warSummaryHandler = require("./warSummaryHandler");
const investHandler = require("./investHandler");

const HELP = `**Savage / Nexus commands**\n/intel — existing Intel lookup and reports\n/me — your current province\n/prov <name> — province sheet\n/lookup <query> — find province\n/links — Discord ↔ province map\n/invest — science investment\n/compare <off|def> — kingdom comparison\n/wars — war history\n/militaryplans <text> — set/view persistent plan\n/mp <text> — military plan alias\n/orders <text> — add/view order timeline\n/ledger — recent event ledger\n/pin <text> — save a pin\n/unpin <n> — remove a pin\n/settz <timezone> — save timezone\n/quiet <text> — save quiet-hours setting\n/op <query> — operation performance\n/find <text> — post exactly what you entered\n/help — this list`;

function clean(v) { return String(v ?? "").trim(); }
function fmt(v) { return v == null ? "?" : Number(v).toLocaleString(); }
function age(ts) { if (!ts) return "?"; const m=Math.max(0,Math.floor((Date.now()-new Date(ts).getTime())/60000)); return m<60?`${m}m`:m<2880?`${Math.floor(m/60)}h`:`${Math.floor(m/1440)}d`; }
function textOption(i, names=["text","query","name"]) { for (const n of names) { const v=i.options.getString(n); if (v) return v; } return ""; }

async function resolve(interaction) {
  const me = interaction.nexusIdentity || await nexusIdentity.resolve(interaction.user.id);
  if (!me) throw new Error("No Nexus province identity found. Register/link your province first.");
  return me;
}

async function me(interaction, sb) {
  const p=await resolve(interaction); const kd=p.kd_code;
  const {data}=await sb.from("provinces").select("*").eq("name",p.name).eq("kd_code",kd).limit(1);
  const r=data?.[0]||p;
  return `🏰 **${r.name}** — ${kd}\nRace ${r.race||"?"} · Personality ${r.personality||"?"} · Role ${r.play_role||"?"}\nLand ${fmt(r.acres)} · NW ${fmt(r.nw)} · Honor ${fmt(r.honor)}\nTPA ${r.r_tpa??"?"} · WPA ${r.r_wpa??"?"}\n_Identity is resolved from the authenticated Nexus identity; Intel remains the existing source of truth._`;
}

async function prov(interaction,sb) {
  const me0=await resolve(interaction); const q=clean(textOption(interaction,["name","query","text"]))||me0.name;
  const {data}=await sb.from("provinces").select("*").eq("kd_code",me0.kd_code).ilike("name",`%${q}%`).limit(5);
  if(!data?.length)return `❌ No province found for **${q}** in ${me0.kd_code}.`;
  return data.map(p=>`🏰 **${p.name}** #${p.slot??"?"}\n${p.race||"?"}/${p.personality||"?"} · ${fmt(p.acres)}a · NW ${fmt(p.nw)} · O ${fmt(p.off)} · D ${fmt(p.def)} · TPA ${p.r_tpa??"?"} · WPA ${p.r_wpa??"?"}\nIntel age: ${age(p.updated_at)}`).join("\n\n");
}

async function lookup(interaction,sb) { const me0=await resolve(interaction); const q=clean(textOption(interaction,["query","text","name"])); if(!q)return "❌ Enter a province/name to look up."; const {data}=await sb.from("provinces").select("name,slot,kd_code,race,personality,acres,nw,off,def,r_tpa,r_wpa,updated_at").eq("kd_code",me0.kd_code).or(`name.ilike.%${q}%,ruler.ilike.%${q}%`).limit(10); return data?.length?data.map(p=>`#${p.slot??"?"} **${p.name}** · ${p.race||"?"}/${p.personality||"?"} · ${fmt(p.acres)}a · NW ${fmt(p.nw)} · O ${fmt(p.off)} · D ${fmt(p.def)} · TPA ${p.r_tpa??"?"} · WPA ${p.r_wpa??"?"} · ${age(p.updated_at)}`).join("\n"):"❌ No matching normalized Intel."; }

async function links(interaction,sb) { const me0=await resolve(interaction); const {data}=await sb.from("provinces").select("slot,name,discord_id").eq("kd_code",me0.kd_code).order("slot"); const linked=(data||[]).filter(x=>x.discord_id); return `🔗 **Province ↔ Discord — ${me0.kd_code}**\n${linked.map(x=>`#${x.slot??"?"} ${x.name} → <@${x.discord_id}>`).join("\n")||"No Discord links captured."}\n\n${linked.length}/${data?.length||0} linked`; }

async function compare(interaction,sb) { const me0=await resolve(interaction); const mode=(textOption(interaction,["mode","type","query"])||"off").toLowerCase(); const col=mode==="def"?"def":"off"; const {data}=await sb.from("provinces").select("name,slot,acres,nw,off,def,updated_at").eq("kd_code",me0.kd_code).order(col,{ascending:false}).limit(25); return `⚖️ **${mode.toUpperCase()} comparison — ${me0.kd_code}**\n${(data||[]).map(p=>`#${p.slot??"?"} ${p.name} · ${fmt(p[col])} ${col} · ${fmt(p.acres)}a · ${age(p.updated_at)}`).join("\n")||"No normalized Intel."}`; }

async function plans(interaction,sb) { const me0=await resolve(interaction); const raw=textOption(interaction,["text","plan","query"]); if(!raw){const {data}=await sb.from("nexus_military_plans").select("*").eq("kd_code",me0.kd_code).order("updated_at",{ascending:false}).limit(25); return `🪖 **Military plans — ${me0.kd_code}**\n${(data||[]).map(p=>`${p.province} · peas ${p.peasants_per_acre??"?"}/a · thieves ${p.thieves_per_acre??"?"}/a · wizards ${p.wizards_per_acre??"?"}/a · off ${p.off_specs_per_acre??"?"}/a · elites ${p.elites_per_acre??"?"}/a`).join("\n")||"No plans saved yet."}`;} const {error}=await sb.from("nexus_military_plans").upsert({kd_code:me0.kd_code,province:me0.name,combo:raw,race:me0.race||null,personality:me0.personality||null,set_by:interaction.user.id,updated_at:new Date().toISOString()},{onConflict:"kd_code,province"}); return error?`❌ ${error.message}`:`🪖 Saved military plan for **${me0.name}**: ${raw}`; }

async function orders(interaction,sb) { const me0=await resolve(interaction); const raw=textOption(interaction,["text","order","query"]); if(raw){const {error}=await sb.from("nexus_orders").insert({kd_code:me0.kd_code,province:me0.name,name:raw,instruction:raw,created_by:interaction.user.id}); if(error)return `❌ ${error.message}`; return `📌 Order added: **${raw}**`;} const {data}=await sb.from("nexus_orders").select("name,province,status,priority,eta,created_at").eq("kd_code",me0.kd_code).order("created_at",{ascending:false}).limit(25); return `📋 **Orders — ${me0.kd_code}**\n${(data||[]).map(o=>`${o.status.toUpperCase()} · ${o.name} · ${o.province||"KD"}${o.eta?` · ETA ${new Date(o.eta).toLocaleString()}`:""}`).join("\n")||"No orders."}`; }

async function ledger(interaction,sb){const me0=await resolve(interaction);const {data}=await sb.from("nexus_ledger").select("province,event_type,event_data,event_at").eq("kd_code",me0.kd_code).order("event_at",{ascending:false}).limit(25);return `📒 **Ledger — ${me0.kd_code}**\n${(data||[]).map(e=>`${new Date(e.event_at).toLocaleString()} · ${e.event_type} · ${e.province||"KD"} · ${JSON.stringify(e.event_data)}`).join("\n")||"No persistent ledger events have been recorded yet."}`;}

async function pin(interaction,sb){const raw=textOption(interaction,["text","query"]);if(!raw)return "❌ Enter text to pin.";const {data}=await sb.from("nexus_pins").select("pin_number").eq("user_id",interaction.user.id).order("pin_number",{ascending:false}).limit(1);const n=(data?.[0]?.pin_number||0)+1;const {error}=await sb.from("nexus_pins").insert({user_id:interaction.user.id,pin_number:n,text:raw});return error?`❌ ${error.message}`:`📌 **Pin #${n}** saved: ${raw}`;}
async function unpin(interaction,sb){const n=interaction.options.getInteger("number")??Number(textOption(interaction,["number","text"]));if(!Number.isInteger(n)||n<1)return "❌ Enter a valid pin number.";const {error}=await sb.from("nexus_pins").delete().eq("user_id",interaction.user.id).eq("pin_number",n);return error?`❌ ${error.message}`:`🗑️ Pin #${n} removed.`;}
async function settings(interaction,sb,kind){const raw=textOption(interaction,["timezone","text","query"]);if(!raw)return `⚙️ ${kind}: ${interaction.nexusSettings?.[kind]||"not set"}`;const payload={user_id:interaction.user.id,updated_at:new Date().toISOString()};if(kind==="timezone")payload.timezone=raw;else payload.quiet_text=raw;const {error}=await sb.from("nexus_user_settings").upsert(payload,{onConflict:"user_id"});return error?`❌ ${error.message}`:`⚙️ Saved ${kind}: **${raw}**`;}

module.exports=async function savageCommandHandler(interaction){const sb=supabaseService.getClient();if(!sb)return interaction.reply({content:"❌ Database unavailable.",ephemeral:true});try{let out;switch(interaction.commandName){case"me":out=await me(interaction,sb);break;case"prov":out=await prov(interaction,sb);break;case"lookup":out=await lookup(interaction,sb);break;case"links":out=await links(interaction,sb);break;case"compare":out=await compare(interaction,sb);break;case"militaryplans":case"mp":out=await plans(interaction,sb);break;case"orders":out=await orders(interaction,sb);break;case"ledger":out=await ledger(interaction,sb);break;case"pin":out=await pin(interaction,sb);break;case"unpin":out=await unpin(interaction,sb);break;case"settz":case"timeset":out=await settings(interaction,sb,"timezone");break;case"quiet":out=await settings(interaction,sb,"quiet");break;case"op":out="Use `/intel oprate` for the full historical operation-rate report; this command shares that existing Intel dataset.";break;case"find":out=textOption(interaction,["text","query"]);break;case"help":out=HELP;break;default:out="❌ Command not wired.";}return interaction.reply({content:String(out).slice(0,1950),ephemeral:true});}catch(e){console.error("[SAVAGE COMMAND]",e);return interaction.reply({content:`❌ ${e.message}`,ephemeral:true});}};

module.exports.HELP = HELP;
module.exports.wars = warSummaryHandler;
module.exports.invest = investHandler;
