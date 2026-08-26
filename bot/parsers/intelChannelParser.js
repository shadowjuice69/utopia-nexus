function n(value) {
  if (value == null) return null;
  const m = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function clean(s) {
  return String(s || '').replace(/[\u0000-\u001F\uFFFD]/g, ' ').replace(/\s+/g, ' ').trim();
}

function inferSpellName(t) {
  const patterns = [
    [/\bfireball\b/i, 'fireball'],
    [/\bpitfalls\b/i, 'pitfalls'],
    [/\bgluttony\b/i, 'gluttony'],
    [/\bgreedy\b|turn greedy/i, 'greed'],
    [/\billuminated\b.*?exposed the thieves/i, 'illuminate'],
    [/\bruined .*?faith in the military/i, 'faith in military'],
    [/\bvow of chastity/i, 'love and peace'],
    [/\bblessed by nature/i, "nature's blessing"]
  ];
  for (const [re, name] of patterns) if (re.test(t)) return name;
  return null;
}

function parseSpell(text, self = false) {
  const t = clean(text);
  const explicit = t.match(/—\s*([^:]+):\s*Your wizards gather/i);
  const runes = n(t.match(/gather\s+([\d,]+)\s+runes/i)?.[1]);
  if (runes == null) return null;
  const spell = explicit?.[1]?.trim() || inferSpellName(t);
  const success = !/but the spell fails/i.test(t) && /the spell succeeds/i.test(t);
  const target = t.match(/Target kingdom is .*?\s*\((\d+:\d+)\).*?Select target province:\s*\d+\s+(.+?)\s*---/i);
  const duration = n(t.match(/for\s+(\d+)\s+days?/i)?.[1]);
  const wizardsKilled = n(t.match(/(\d+)\s+wizards?\s+were killed/i)?.[1]);
  return {
    type: self ? 'self_spell' : 'offensive_spell',
    spellName: spell,
    success,
    runes,
    targetKingdom: target?.[1] || null,
    targetProvince: target?.[2]?.trim() || null,
    durationDays: duration,
    wizardsKilled,
    raw: t
  };
}

function parseDragon(text) {
  const t = clean(text);
  if (!/^🐉|dragon/i.test(text.trim())) return null;
  const development = t.match(/begun development of the\s+(.+?)(?:\s+\([^)]*\))?$/i);
  const cancelled = t.match(/has cancelled their dragon project targeted at us/i);
  const completed = t.match(/completed our dragon,\s*(.+?),\s*and it sets flight to ravage\s*(.+?)\s*\((\d+:\d+)\)/i);
  const incoming = t.match(/Dragon at us\s*[—-]\s*(.+?)\s+(\d[\d,]*)\s+points of strength left/i);
  return { type:'dragon', eventType:development?'development':cancelled?'cancelled':completed?'completed':incoming?'incoming':'unknown', dragonName:development?.[1]?.trim() || completed?.[1]?.trim() || incoming?.[1]?.trim() || null, targetProvince:completed?.[2]?.trim() || null, targetKingdom:completed?.[3] || null, strength:incoming?n(incoming[2]):null, raw:t };
}

function parseRitual(text) {
  const t = clean(text);
  if (!/—\s*Ritual:/i.test(t)) return null;
  const who = t.match(/^#?\d+[-\s]+([^/]+?)\s*\/\s*\*\*#?\d+\s+(.+?)\*\*\s*[—-]\s*Ritual:/i);
  const cast = t.match(/cast\s+\*\*(\d+)\/(\d+)\*\*/i);
  return { type:'ritual', casterProvince:who?.[2]?.trim() || null, casterKingdom:null, success:!(/spell fails|FAILED/i.test(t)), castCount:cast?Number(cast[1]):null, castNeeded:cast?Number(cast[2]):null, raw:t };
}

function parseAid(text) {
  const t = clean(text);
  const m = t.match(/^#?\d+\s*-\s*(.+?):\s*We have sent\s+([\d,]+)\s+(.+?)\s+to\s+(.+?)\s+\((\d+:\d+)\)\./i);
  if (!m) return null;
  return { type:'aid', senderProvince:m[1].trim(), senderKingdom:null, targetProvince:m[4].trim(), targetKingdom:m[5], resourceType:m[3].trim().toLowerCase(), amount:n(m[2]), surplusGold:n(t.match(/added\s+([\d,]+)\s+gold coins to our aid surplus/i)?.[1]), raw:t };
}

function parseAttack(text) {
  const t = clean(text);
  const kd = t.match(/^#?\d+\s*-\s*(.+?)\s*\((\d+:\d+)\)\s+(invaded|attacked|ambushed armies from)\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\).*?(?:captured|took|looted)\s+([\d,]+)\s+(acres?|books?)/i);
  if (kd) return { type:'attack', attackType:/ambushed/i.test(kd[3])?'ambush':/looted/i.test(t)?'loot':'invasion', attackerProvince:kd[1].trim(), attackerKingdom:kd[2], targetProvince:kd[4].trim(), targetKingdom:kd[5], acresCaptured:/acres?/i.test(kd[7])?n(kd[6]):null, loot:/books?/i.test(kd[7])?{books:n(kd[6])}:null, raw:t };
  const pop = t.match(/^#?\d+\s*-\s*(.+?)\s*\((\d+:\d+)\)\s+killed\s+([\d,]+)\s+people within\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)/i);
  if (pop) return { type:'attack', attackType:'population_kill', attackerProvince:pop[1].trim(), attackerKingdom:pop[2], targetProvince:pop[4].trim(), targetKingdom:pop[5], peasants:n(pop[3]), raw:t };
  const battle = t.match(/(?:⚔\s*)?(.+?)\s*\((\d+:\d+)\)\s*[—-]\s*#?\d+\s*-\s*([^:]+):?/i);
  if (!battle || !/Your forces arrive at/i.test(t)) return null;
  const target = t.match(/arrive at\s+(.+?)\s*\((\d+:\d+)\)/i);
  const defense = n(t.match(/vs\s+([\d,]+)\s+def/i)?.[1]);
  const off = n(t.match(/(?:⚔|—)\s*([\d,]+)\s+off/i)?.[1]);
  const acres = n(t.match(/(?:razed|destroyed|recaptured)\s+([\d,]+)\s+acres/i)?.[1]);
  const loot = { gold:n(t.match(/looted\s+([\d,]+)\s+gold/i)?.[1]), food:n(t.match(/([\d,]+)\s+bushels/i)?.[1]), runes:n(t.match(/([\d,]+)\s+runes/i)?.[1]), books:n(t.match(/looted\s+([\d,]+)\s+books/i)?.[1]) };
  const imprisoned = n(t.match(/imprisoned\s+([\d,]+)\s+additional troops/i)?.[1]);
  const killed = n(t.match(/killed about\s+([\d,]+)\s+enemy troops/i)?.[1]);
  const returnDays = Number(t.match(/available again in\s+([\d.]+)\s+days/i)?.[1] || NaN);
  const losses = {};
  for (const m of t.matchAll(/lost\s+([\d,]+)\s+([A-Za-z ]+?)(?=,|\s+and\s+|\s+in this battle)/gi)) losses[m[2].trim().toLowerCase()] = n(m[1]);
  return { type:'attack', attackType:/recaptured/i.test(t)?'recapture':/ambush/i.test(t)?'ambush':/massacred/i.test(t)?'massacre':/looted/i.test(t)?'loot':'offensive', attackerProvince:battle[1].trim(), attackerKingdom:battle[2], targetProvince:target?.[1]?.trim()||null, targetKingdom:target?.[2]||null, acresCaptured:/recaptured/i.test(t)?null:acres, acresRecaptured:/recaptured/i.test(t)?acres:null, acresDestroyed:/razed|destroyed/i.test(t)?acres:null, offenseSent:off, enemyDefense:defense, kills:killed, prisoners:imprisoned, losses, loot:Object.values(loot).some(v=>v!=null)?loot:null, returnDays:Number.isFinite(returnDays)?returnDays:null, raw:t };
}

function parseChannelMessage({channelType,id,content,timestamp}) {
  const parser={attacks:parseAttack,offensive_spells:t=>parseSpell(t,false),self_spells:t=>parseSpell(t,true),dragon:parseDragon,ritual:parseRitual,aid:parseAid}[channelType];
  if(!parser)return[];
  const out=[];
  for(const chunk of String(content||'').split(/\n(?=⚔|🐉|#?\d+\s*-)/)){const event=parser(chunk);if(event)out.push({...event,messageId:id,timestamp});}
  return out;
}

module.exports={parseChannelMessage,parseSpell,parseDragon,parseRitual,parseAid,parseAttack};
