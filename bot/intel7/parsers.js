function clean(value) {
  return String(value || "").replace(/[\u0000-\u001F\uFFFD]/g, " ").replace(/\s+/g, " ").trim();
}
function num(value) {
  if (value == null) return null;
  const m = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}
function base(type, raw) { return { type, raw: clean(raw) }; }

function parseThieves(raw) {
  const t = clean(raw);
  const out = [];
  const patterns = [
    /^(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+(?:performed|used|attempted)\s+(.+?)\s+(?:on|against|at)\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\).*$/i,
    /^(?:#?\d+\s*-\s*)?(.+?)\s*<<__(.+?)__\s+\*\*\|\s*(.+?)\s+\((\d+:\d+)\)\*\*>>\s*(.*)$/i,
  ];
  for (const line of t.split(/\n+/)) {
    const s = clean(line);
    let m = s.match(patterns[0]);
    if (m) { out.push({ type:"thieves", eventType:"operation", attackerProvince:m[1].trim(), attackerKingdom:m[2], operation:m[3].trim(), targetProvince:m[4].trim(), targetKingdom:m[5], success: !/fail|failed/i.test(s), resultValue:num(s.match(/(?:result|gained|stole|captured)\s*[:=]?\s*([\d,]+)/i)?.[1]) }); continue; }
    m = s.match(patterns[1]);
    if (m) { out.push({ type:"thieves", eventType:"operation", attackerProvince:m[1].trim(), operation:m[2].trim(), targetProvince:m[3].trim(), targetKingdom:m[4], success: !/FAIL/i.test(m[5]), resultValue:num(m[5].match(/^[\s:=-]*([\d,]+)/)?.[1]) }); }
  }
  return out;
}

function parseAttack(raw) {
  const t = clean(raw); const out=[];
  for (const line of t.split(/\n+/)) {
    let m = line.match(/^(?:⚔\s*)?(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+(invaded|attacked|ambushed armies from)\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\).*?(captured|took|looted)\s+([\d,]+)\s+(acres?|books?)/i);
    if (m) { out.push({ type:"attack", eventType:/ambushed/i.test(m[3])?"ambush":"attack", attackerProvince:m[1].trim(), attackerKingdom:m[2], targetProvince:m[4].trim(), targetKingdom:m[5], acresCaptured:/acres/i.test(m[8])?num(m[7]):null, loot:/books/i.test(m[8])?{books:num(m[7])}:null }); continue; }
    m = line.match(/^(?:⚔\s*)?(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\).*?Your forces arrive at\s+(.+?)\s*\((\d+:\d+)\)/i);
    if (m) out.push({ type:"attack", eventType:"battle", attackerProvince:m[1].trim(), attackerKingdom:m[2], targetProvince:m[3].trim(), targetKingdom:m[4], acresCaptured:num(line.match(/(?:captured|took|razed|destroyed)\s+([\d,]+)\s+acres/i)?.[1]), offenseSent:num(line.match(/(?:sent|offense)\s+([\d,]+)/i)?.[1]), enemyDefense:num(line.match(/(?:vs|defense)\s+([\d,]+)/i)?.[1]), loot:{gold:num(line.match(/looted\s+([\d,]+)\s+gold/i)?.[1]),books:num(line.match(/looted\s+([\d,]+)\s+books/i)?.[1]),runes:num(line.match(/([\d,]+)\s+runes/i)?.[1])} });
  }
  return out;
}

function parseSpell(raw, self) {
  const t=clean(raw); const m=t.match(/^(?:#?\d+\s*-\s*)?(.+?)(?:\s*\((\d+:\d+)\))?\s*[:—-]\s*(?:Your wizards gather\s+([\d,]+)\s+runes.*?\s)?(.+?):?\s*Your wizards gather\s+([\d,]+)\s+runes/i) || t.match(/(.+?)\s*:\s*(.+?)\s+Your wizards gather\s+([\d,]+)\s+runes/i);
  if (!m) return [];
  const runes=num(m[6]||m[3]); const spell=(m[5]||m[2]||"").trim();
  if (!runes || !spell) return [];
  return [{type:self?"self_spell":"offensive_spell",eventType:"spell",spellName:spell,runes,attackerProvince:(m[1]||"").trim(),attackerKingdom:m[2]||null,targetKingdom:t.match(/Target kingdom is .*?\((\d+:\d+)\)/i)?.[1]||null,targetProvince:t.match(/Select target province:\s*\d+\s+(.+?)\s*---/i)?.[1]?.trim()||null,success:!/(?:spell fails|FAIL)/i.test(t)}];
}
function parseDragon(raw){const t=clean(raw);if(!/(?:dragon|🐉)/i.test(t))return[];return[{type:"dragon",eventType:/cancelled/i.test(t)?"cancelled":/completed/i.test(t)?"completed":/strength left/i.test(t)?"incoming":"development",spellName:null,targetProvince:t.match(/ravage\s+(.+?)\s*\((\d+:\d+)\)/i)?.[1]?.trim()||null,targetKingdom:t.match(/ravage\s+.+?\s*\((\d+:\d+)\)/i)?.[1]||null,amount:num(t.match(/([\d,]+)\s+points? of strength/i)?.[1])}];}
function parseRitual(raw){const t=clean(raw);if(!/ritual/i.test(t))return[];return[{type:"ritual",eventType:"ritual",attackerProvince:t.match(/^#?\d+\s*-\s*(.+?)(?:\s*\/|\s*—|\s*Ritual)/i)?.[1]?.trim()||null,success:!/(?:fails|FAILED)/i.test(t),amount:num(t.match(/cast\s+\*?(\d+)\/?/i)?.[1])}];}
function parseAid(raw){const t=clean(raw);const m=t.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*:\s*We have sent\s+([\d,]+)\s+(.+?)\s+to\s+(.+?)\s*\((\d+:\d+)\)/i);if(!m)return[];return[{type:"aid",eventType:"aid",attackerProvince:m[1].trim(),amount:num(m[2]),resourceType:m[3].trim().toLowerCase(),targetProvince:m[4].trim(),targetKingdom:m[5]}];}
function parseIntel7(channelType, raw){switch(channelType){case"thieves":return parseThieves(raw);case"attacks":return parseAttack(raw);case"offensive":return parseSpell(raw,false);case"self":return parseSpell(raw,true);case"dragon":return parseDragon(raw);case"ritual":return parseRitual(raw);case"aid":return parseAid(raw);default:return[];}}
module.exports={parseIntel7};
