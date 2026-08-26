function clean(value) {
  return String(value || "").replace(/[\u0000-\u001F\uFFFD]/g, " ").replace(/\s+/g, " ").trim();
}
function num(value) {
  if (value == null) return null;
  const m = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function parseThieves(raw) {
  const t = clean(raw), out = [];
  for (const line of t.split(/\n+/)) {
    const s = clean(line);
    let m = s.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+(?:performed|used|attempted)\s+(.+?)\s+(?:on|against|at)\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\).*$/i);
    if (m) { out.push({type:"thieves",eventType:"operation",attackerProvince:m[1].trim(),attackerKingdom:m[2],operation:m[3].trim(),targetProvince:m[4].trim(),targetKingdom:m[5],success:!/fail|failed/i.test(s)}); continue; }
    m = s.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*<<__(.+?)__\s+\*\*\|\s*(.+?)\s+\((\d+:\d+)\)\*\*>>\s*(.*)$/i);
    if (m) out.push({type:"thieves",eventType:"operation",attackerProvince:m[1].trim(),operation:m[2].trim(),targetProvince:m[3].trim(),targetKingdom:m[4],success:!/FAIL/i.test(m[5])});
  }
  return out;
}

function parseAttack(raw) {
  const t = clean(raw), out = [];
  for (const line of t.split(/\n+/)) {
    let m = line.match(/^(?:⚔\s*)?(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+(attacked|invaded|ambushed armies from)\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\).*?(captured|took|looted)\s+([\d,]+)\s+(acres?|books?)/i);
    if (m) {
      const isBooks = /books/i.test(m[8]);
      out.push({type:"attack",eventType:/ambushed/i.test(m[3])?"ambush":"attack",attackerProvince:m[1].trim(),attackerKingdom:m[2],targetProvince:m[4].trim(),targetKingdom:m[5],acresCaptured:isBooks?null:num(m[7]),loot:isBooks?{books:num(m[7])}:null});
      continue;
    }

    // Current Utopia Intel format: "9 - Jan (4:10) attacked and looted 20,090 books from 24 - Work work (6:9)."
    m = line.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+attacked\s+and\s+looted\s+([\d,]+)\s+(books?|acres?)\s+from\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)/i);
    if (m) {
      const books = /books?/i.test(m[4]);
      out.push({type:"attack",eventType:"attack",attackerProvince:m[1].trim(),attackerKingdom:m[2],targetProvince:m[5].trim(),targetKingdom:m[6],acresCaptured:books?null:num(m[3]),loot:books?{books:num(m[3])}:null});
      continue;
    }

    // Battle result format: "Your forces arrive at Silent Hills (1:8). A tough battle took place..."
    m = line.match(/Your forces arrive at\s+(.+?)\s*\((\d+:\d+)\)/i);
    if (m) {
      out.push({type:"attack",eventType:"battle",targetProvince:m[1].trim(),targetKingdom:m[2],success:/managed\s+a\s+victory|victory/i.test(line),acresCaptured:num(line.match(/(?:captured|took|razed|destroyed)\s+([\d,]+)\s+acres?/i)?.[1]),loot:{gold:num(line.match(/looted\s+([\d,]+)\s+gold/i)?.[1]),books:num(line.match(/looted\s+([\d,]+)\s+books/i)?.[1]),runes:num(line.match(/([\d,]+)\s+runes/i)?.[1])}});
    }
  }
  return out;
}

function parseSpell(raw, self) {
  const t=clean(raw), out=[];
  for (const line of t.split(/\n+/)) {
    const m=line.match(/^(?:#?\d+\s*-\s*)?(.+?)(?:\s*\((\d+:\d+)\))?.*?Your wizards gather\s+([\d,]+)\s+runes/i);
    if (!m) continue;
    const spell=line.match(/(?:cast|casts|spell)\s+([A-Za-z][A-Za-z '’-]{2,})/i)?.[1]?.trim()||line.split(/Your wizards gather/i)[0].trim();
    out.push({type:self?"self_spell":"offensive_spell",eventType:"spell",spellName:spell,runes:num(m[3]),attackerProvince:m[1]?.trim()||null,attackerKingdom:m[2]||null,targetKingdom:line.match(/\((\d+:\d+)\)/)?.[1]||null,success:!/(?:spell fails|FAIL)/i.test(line)});
  }
  return out;
}
function parseDragon(raw){const t=clean(raw);if(!/(?:dragon|🐉)/i.test(t))return[];return[{type:"dragon",eventType:/cancelled/i.test(t)?"cancelled":/completed/i.test(t)?"completed":"development",targetProvince:t.match(/ravage\s+(.+?)\s*\((\d+:\d+)\)/i)?.[1]?.trim()||null,targetKingdom:t.match(/ravage\s+.+?\s*\((\d+:\d+)\)/i)?.[1]||null,amount:num(t.match(/([\d,]+)\s+points? of strength/i)?.[1]),success:!/fail|failed/i.test(t)}];}
function parseRitual(raw){const t=clean(raw);if(!/ritual/i.test(t))return[];return[{type:"ritual",eventType:"ritual",attackerProvince:t.match(/^#?\d+\s*-\s*(.+?)(?:\s*\/|\s*—|\s*Ritual)/i)?.[1]?.trim()||null,success:!/(?:fails|FAILED)/i.test(t),amount:num(t.match(/cast\s+\*?(\d+)\/?/i)?.[1])}];}
function parseAid(raw){const t=clean(raw);const m=t.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*:\s*We have sent\s+([\d,]+)\s+(.+?)\s+to\s+(.+?)\s*\((\d+:\d+)\)/i);if(!m)return[];return[{type:"aid",eventType:"aid",attackerProvince:m[1].trim(),amount:num(m[2]),resourceType:m[3].trim().toLowerCase(),targetProvince:m[4].trim(),targetKingdom:m[5]}];}
function parseIntel7(channelType, raw){switch(channelType){case"thieves":return parseThieves(raw);case"attacks":return parseAttack(raw);case"offensive":return parseSpell(raw,false);case"self":return parseSpell(raw,true);case"dragon":return parseDragon(raw);case"ritual":return parseRitual(raw);case"aid":return parseAid(raw);default:return[];}}
module.exports={parseIntel7};
