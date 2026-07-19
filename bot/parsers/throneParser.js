function cleanNum(str) {
  if (!str) return null;
  return str.toString().replace(/,/g, "").replace(/\s*gold coins?/i, "").trim();
}

function parsePart(part, result) {
  part = part.trim();

  const patterns = [
    [/The Province of (.+?)\s*\((\d+:\d+)\)/i, m => { result.name = m[1].trim(); result.coordinates = m[2]; }],
    [/Race[\s\t]+(\w[\w\s]*?)$/i, m => result.race = m[1].trim()],
    [/Ruler[\s\t]+(.+)$/i, m => result.ruler = m[1].trim()],
    [/Land[\s\t]+([\d,]+)/i, m => result.acres = cleanNum(m[1])],
    [/Peasants[\s\t]+([\d,]+)/i, m => result.peons = cleanNum(m[1])],
    [/Building\s*Eff\.?[\s\t]+([\d.]+)%/i, m => result.be = m[1]],
    [/Money[\s\t]+([\d,]+)/i, m => result.gold = cleanNum(m[1])],
    [/Food[\s\t]+([\d,]+)/i, m => result.food = cleanNum(m[1])],
    [/Runes[\s\t]+([\d,]+)/i, m => result.runes = cleanNum(m[1])],
    [/Networth[\s\t]+([\d,]+)/i, m => result.nw = cleanNum(m[1])],
    [/Wages?[\s\t]+([\d.]+)%?/i, m => result.wages = m[1]],
    [/Stealth[\s\t]+([\d.]+)%?/i, m => result.stlth = m[1]],
    [/Mana[\s\t]+([\d.]+)%?/i, m => result.mana = m[1]],
    [/Honor[\s\t]+([\d,]+)/i, m => result.honor = cleanNum(m[1])],
    [/Off(?:ensive)?\.?\s*(?:Force|Points)?[\s\t]+([\d,]+)/i, m => result.off = cleanNum(m[1])],
    [/Def(?:ensive)?\.?\s*(?:Force|Points)?[\s\t]+([\d,]+)/i, m => result.def = cleanNum(m[1])],
    [/Thieves[\s\t]+([\d,]+)\s*\(([\d.]+)\s*tpa\)/i, m => { result.thieves = cleanNum(m[1]); result.o_tpa = m[2]; result.d_tpa = m[2]; }],
    [/Wizards[\s\t]+([\d,]+)\s*\(([\d.]+)\s*wpa\)/i, m => { result.wizards = cleanNum(m[1]); result.o_wpa = m[2]; result.d_wpa = m[2]; }],
    [/Thieves[\s\t]+([\d,]+)/i, m => { if (!result.thieves) result.thieves = cleanNum(m[1]); }],
    [/Wizards[\s\t]+([\d,]+)/i, m => { if (!result.wizards) result.wizards = cleanNum(m[1]); }],
    [/War\s*Horses?[\s\t]+([\d,]+)/i, m => result.war_horses = cleanNum(m[1])],
    [/Prisoners?[\s\t]+([\d,]+)/i, m => result.prisoners = cleanNum(m[1])],
    [/Soldiers?[\s\t]+([\d,]+)/i, m => result.soldiers = cleanNum(m[1])],
    [/Quickblades[\s\t]+([\d,]+)/i, m => result.off_specs = cleanNum(m[1])],
    [/Pikemen[\s\t]+([\d,]+)/i, m => result.def_specs = cleanNum(m[1])],
    [/Golems[\s\t]+([\d,]+)/i, m => result.elites = cleanNum(m[1])],
    [/Off(?:ensive)?\s*Spec[\s\t]+([\d,]+)/i, m => result.off_specs = cleanNum(m[1])],
    [/Def(?:ensive)?\s*Spec[\s\t]+([\d,]+)/i, m => result.def_specs = cleanNum(m[1])],
    [/Elites?[\s\t]+([\d,]+)/i, m => result.elites = cleanNum(m[1])],
    [/Mercenar[\w]+[\s\t]+([\d,]+)/i, m => result.mercs = cleanNum(m[1])],
    [/Generals?[\s\t]+([\d,]+)/i, m => result.generals = cleanNum(m[1])],
    [/MAP[\s\t]*:?\s*(.+)/i, m => result.map = m[1].trim()],
    [/Military\s*Access\s*Pact[\s\t]*:?\s*(.+)/i, m => result.map = m[1].trim()],
  ];

  for (const [regex, handler] of patterns) {
    const m = part.match(regex);
    if (m) { handler(m); break; }
  }
}

function parseThrone(text) {
  const result = {};
  const isGenesis = text.includes('spa)') || text.includes('ospa') || text.includes('dspa') || text.includes('YR0');

  // Split by newlines, then split each line by tabs
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Handle spells
    if (line.match(/Duration:\s*/i)) {
      const spellMatch = line.match(/Duration:\s*(.+)/i);
      if (spellMatch) {
        result.good_spells = (result.good_spells ? result.good_spells + ' ' : '') + spellMatch[1].trim();
      }
      continue;
    }

    // Split tab-separated fields on same line
    const parts = line.split('\t').map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      parsePart(part, result);
    }
  }

  result.game_type = isGenesis ? "genesis" : "wol";
  return result;
}

function parseMilitary(text) {
  const result = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const parts = line.split('\t').map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
      parsePart(part, result);
    }
  }
  return result;
}

function summarizeIntel(parsed) {
  const parts = [];
  if (parsed.name) parts.push(`**${parsed.name}**`);
  if (parsed.race) parts.push(parsed.race);
  if (parsed.game_type) parts.push(`[${parsed.game_type.toUpperCase()}]`);
  if (parsed.nw) parts.push(`NW: ${parseInt(parsed.nw).toLocaleString()}`);
  if (parsed.acres) parts.push(`Acres: ${parseInt(parsed.acres).toLocaleString()}`);
  if (parsed.off) parts.push(`Off: ${parseInt(parsed.off).toLocaleString()}`);
  if (parsed.def) parts.push(`Def: ${parseInt(parsed.def).toLocaleString()}`);
  if (parsed.be) parts.push(`BE: ${parsed.be}%`);
  return parts.join(' | ');
}

module.exports = { parseThrone, parseMilitary, summarizeIntel };
