function cleanNum(str) {
  if (!str) return null;
  return str.toString().replace(/,/g, "").replace(/\s*gold coins?/i, "").trim();
}

function parseThrone(text) {
  const result = {};
  const isGenesis = text.includes('YR0') || text.includes('ospa') || text.includes('dspa') || text.includes('epa)');

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Skip noise lines
    if (line.startsWith('http') || line.includes('next tick') || line.includes('Recent News') || line.includes('See all')) continue;

    // Duration/spells line
    if (line.startsWith('Duration:') || line.match(/^(Love and Peace|Inspire Army|Town Watch|Greater Protection|Minor Protection|Bloodlust|Fanaticism|Patriotism|Mist|Wrath|Salvation|Anonymity)/i)) {
      result.good_spells = (result.good_spells ? result.good_spells + ' · ' : '') + line.replace(/^Duration:\s*/i, '').trim();
      continue;
    }

    // Handle Utopia table format with tabs
    const parts = [line];

    const cols = line.split("\t").map(p => p.trim()).filter(Boolean);

    if (cols.length >= 2) {
      const key = cols[0];

      if (key === "Race") {
        result.race = cols[1];
        result.soldiers = cleanNum(cols[3]);
        continue;
      }

      if (key === "Ruler") {
        result.ruler = cols[1];
        result.off_specs = cleanNum(cols[3]);
        continue;
      }

      if (key === "Land") {
        result.acres = cleanNum(cols[1]);
        result.def_specs = cleanNum(cols[3]);
        continue;
      }

      if (key === "Peasants") {
        result.peons = cleanNum(cols[1]);
        result.elites = cleanNum(cols[3]);
        continue;
      }

      if (key === "Building Eff.") {
        result.be = cols[1].replace("%","");
        result.thieves = cleanNum(cols[3]);
        continue;
      }

      if (key === "Money") {
        result.gold = cleanNum(cols[1]);
        result.wizards = cleanNum(cols[3]);
        continue;
      }

      if (key === "Food") {
        result.food = cleanNum(cols[1]);
        result.war_horses = cleanNum(cols[3]);
        continue;
      }

      if (key === "Runes") {
        result.runes = cleanNum(cols[1]);
        result.prisoners = cleanNum(cols[3]);
        continue;
      }

      if (key === "Networth") {
        result.nw = cleanNum(cols[1]);
        result.def = cleanNum(cols[3]);
        continue;
      }
    }

    for (const part of parts) {
      // Province name
      const provMatch = part.match(/^The Province of (.+?)\s*\((\d+:\d+)\)$/i);
      if (provMatch) { result.name = provMatch[1].trim(); result.coordinates = provMatch[2]; continue; }

      // Key: Value patterns
      if (part.match(/^Race\s+\w/i)) { result.race = part.replace(/^Race\s+/i, '').trim(); continue; }
      if (part.match(/^Ruler\s+/i)) { result.ruler = part.replace(/^Ruler\s+/i, '').trim(); continue; }
      if (part.match(/^Land\s+[\d,]+/i)) { const m = part.match(/[\d,]+/); if (m) result.acres = cleanNum(m[0]); continue; }
      if (part.match(/^Peasants\s+[\d,]+/i)) { const m = part.match(/[\d,]+/); if (m) result.peons = cleanNum(m[0]); continue; }
      if (part.match(/^Building Eff/i)) { const m = part.match(/([\d.]+)%/); if (m) result.be = m[1]; continue; }
      if (part.match(/^Money\s+[\d,]+/i)) { const m = part.match(/[\d,]+/); if (m) result.gold = cleanNum(m[0]); continue; }
      if (part.match(/^Food\s+[\d,]+/i)) { const m = part.match(/[\d,]+/); if (m) result.food = cleanNum(m[0]); continue; }
      if (part.match(/^Runes\s+[\d,]+/i)) { const m = part.match(/[\d,]+/); if (m) result.runes = cleanNum(m[0]); continue; }
      if (part.match(/^Networth\s+/i)) { const m = part.match(/([\d,]+)/); if (m) result.nw = cleanNum(m[1]); continue; }
      if (part.match(/^Wages?\s+[\d.]+/i)) { const m = part.match(/([\d.]+)/); if (m) result.wages = m[1]; continue; }
      if (part.match(/^Stealth\s+[\d.]+/i)) { const m = part.match(/([\d.]+)/); if (m) result.stlth = m[1]; continue; }
      if (part.match(/^Mana\s+[\d.]+/i)) { const m = part.match(/([\d.]+)/); if (m) result.mana = m[1]; continue; }
      if (part.match(/^Honor\s+[\d,]+/i)) { const m = part.match(/[\d,]+/); if (m) result.honor = cleanNum(m[0]); continue; }
      if (part.match(/^Trade Balance/i)) continue;

      // Off/Def Points (Genesis)
      if (part.match(/^Off\.?\s*Points?\s+[\d,]+/i)) { const m = part.match(/([\d,]+)/); if (m) result.off = cleanNum(m[1]); continue; }
      if (part.match(/^Def\.?\s*Points?\s+[\d,]+/i)) { const m = part.match(/([\d,]+)/); if (m) result.def = cleanNum(m[1]); continue; }

      // WoL Offense/Defense
      if (part.match(/^Offense\s+[\d,]+/i)) { const m = part.match(/([\d,]+)/); if (m) result.off = cleanNum(m[1]); continue; }
      if (part.match(/^Defense\s+[\d,]+/i)) { const m = part.match(/([\d,]+)/); if (m) result.def = cleanNum(m[1]); continue; }

      // Units with spa values
      if (part.match(/^Soldiers\s+/i)) { const m = part.match(/([\d,]+)/); if (m) result.soldiers = cleanNum(m[1]); continue; }
      if (part.match(/^Quickblades\s+/i)) { const m = part.match(/([\d,]+)/); if (m) result.off_specs = cleanNum(m[1]); continue; }
      if (part.match(/^Pikemen\s+/i)) { const m = part.match(/([\d,]+)/); if (m) result.def_specs = cleanNum(m[1]); continue; }
      if (part.match(/^Golems\s+/i)) { const m = part.match(/([\d,]+)/); if (m) result.elites = cleanNum(m[1]); continue; }
      if (part.match(/^Off(?:ensive)?\s*Spec/i)) { const m = part.match(/([\d,]+)/); if (m) result.off_specs = cleanNum(m[1]); continue; }
      if (part.match(/^Def(?:ensive)?\s*Spec/i)) { const m = part.match(/([\d,]+)/); if (m) result.def_specs = cleanNum(m[1]); continue; }
      if (part.match(/^Elite/i)) { const m = part.match(/([\d,]+)/); if (m) result.elites = cleanNum(m[1]); continue; }
      if (part.match(/^War\s*Horses?\s+/i)) { const m = part.match(/([\d,]+)/); if (m) result.war_horses = cleanNum(m[1]); continue; }
      if (part.match(/^Prisoners?\s+/i)) { const m = part.match(/([\d,]+)/); if (m) result.prisoners = cleanNum(m[1]); continue; }
      if (part.match(/^Mercenar/i)) { const m = part.match(/([\d,]+)/); if (m) result.mercs = cleanNum(m[1]); continue; }
      if (part.match(/^Generals?\s+/i)) { const m = part.match(/([\d,]+)/); if (m) result.generals = cleanNum(m[1]); continue; }

      // Thieves with TPA
      const tpaMatch = part.match(/^Thieves\s+([\d,]+)\s*\(([\d.]+)\s*tpa\)/i);
      if (tpaMatch) { result.thieves = cleanNum(tpaMatch[1]); result.o_tpa = tpaMatch[2]; result.d_tpa = tpaMatch[2]; continue; }
      if (part.match(/^Thieves\s+[\d,]+/i)) { const m = part.match(/([\d,]+)/); if (m && !result.thieves) result.thieves = cleanNum(m[1]); continue; }

      // Wizards with WPA
      const wpaMatch = part.match(/^Wizards\s+([\d,]+)\s*\(([\d.]+)\s*wpa\)/i);
      if (wpaMatch) { result.wizards = cleanNum(wpaMatch[1]); result.o_wpa = wpaMatch[2]; result.d_wpa = wpaMatch[2]; continue; }
      if (part.match(/^Wizards\s+[\d,]+/i)) { const m = part.match(/([\d,]+)/); if (m && !result.wizards) result.wizards = cleanNum(m[1]); continue; }

      // MAP
      if (part.match(/^MAP\s*:/i) || part.match(/^Military Access Pact/i)) {
        result.map = part.replace(/^(?:MAP|Military Access Pact)\s*:?\s*/i, '').trim();
        continue;
      }
    }
  }

  if (result.race) result.race = result.race.split("\t")[0].trim();
  if (result.ruler) result.ruler = result.ruler.split("\t")[0].trim();

  result.game_type = isGenesis ? "genesis" : "wol";
  console.log("[PARSED INTEL]", JSON.stringify(result, null, 2));
  return result;
}

function parseMilitary(text) {
  return parseThrone(text);
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
