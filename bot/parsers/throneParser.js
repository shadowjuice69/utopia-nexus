function cleanNum(str) {
  if (!str) return null;
  return str.toString().replace(/,/g, "").trim();
}

function parseThrone(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = {};
  const isGenesis = text.includes('spa)') || text.includes('ospa') || text.includes('dspa');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Province name and coordinates
    const provMatch = line.match(/The Province of (.+?)\s*\((\d+:\d+)\)/i);
    if (provMatch) {
      result.name = provMatch[1].trim();
      result.coordinates = provMatch[2];
      continue;
    }

    // WoL province format (no "The Province of")
    const wolProvMatch = line.match(/^(.+?)\s*\((\d+:\d+)\)$/);
    if (wolProvMatch && !result.name) {
      result.name = wolProvMatch[1].trim();
      result.coordinates = wolProvMatch[2];
      continue;
    }

    // Race
    const raceMatch = line.match(/Race[\s\t]+(\w[\w\s]*?)(?:\t|$)/i);
    if (raceMatch) { result.race = raceMatch[1].trim(); continue; }

    // Ruler/Personality
    const rulerMatch = line.match(/Ruler[\s\t]+(.+?)(?:\t|$)/i);
    if (rulerMatch) {
      const ruler = rulerMatch[1].trim();
      // Extract title and name
      const titleMatch = ruler.match(/(Baron|Viscount|Count|Duke|Prince|Knight|Lord|Marquis|Peasant)\s+(.+)/i);
      if (titleMatch) result.ruler = ruler;
      continue;
    }

    // Land/Acres
    const landMatch = line.match(/Land[\s\t]+([\d,]+)/i);
    if (landMatch) { result.acres = cleanNum(landMatch[1]); continue; }

    // Peasants
    const peasantMatch = line.match(/Peasants[\s\t]+([\d,]+)/i);
    if (peasantMatch) { result.peons = cleanNum(peasantMatch[1]); continue; }

    // Building Efficiency
    const beMatch = line.match(/Building\s*Eff\.?[\s\t]+([\d.]+)%/i);
    if (beMatch) { result.be = beMatch[1]; continue; }

    // Money/Gold
    const moneyMatch = line.match(/Money[\s\t]+([\d,]+)/i);
    if (moneyMatch) { result.gold = cleanNum(moneyMatch[1]); continue; }

    // Food
    const foodMatch = line.match(/Food[\s\t]+([\d,]+)/i);
    if (foodMatch) { result.food = cleanNum(foodMatch[1]); continue; }

    // Runes
    const runesMatch = line.match(/Runes[\s\t]+([\d,]+)/i);
    if (runesMatch) { result.runes = cleanNum(runesMatch[1]); continue; }

    // Networth
    const nwMatch = line.match(/Networth[\s\t]+([\d,]+)/i);
    if (nwMatch) { result.nw = cleanNum(nwMatch[1]); continue; }

    // Wages
    const wagesMatch = line.match(/Wages?[\s\t]+([\d.]+)%?/i);
    if (wagesMatch) { result.wages = wagesMatch[1]; continue; }

    // Stealth
    const stealthMatch = line.match(/Stealth[\s\t]+([\d.]+)%?/i);
    if (stealthMatch) { result.stlth = stealthMatch[1]; continue; }

    // Mana
    const manaMatch = line.match(/Mana[\s\t]+([\d.]+)%?/i);
    if (manaMatch) { result.mana = manaMatch[1]; continue; }

    // Honor
    const honorMatch = line.match(/Honor[\s\t]+([\d,]+)/i);
    if (honorMatch) { result.honor = cleanNum(honorMatch[1]); continue; }

    // Genesis — Off/Def Points
    const offPtsMatch = line.match(/Off\.?\s*Points[\s\t]+([\d,]+)/i);
    if (offPtsMatch) { result.off = cleanNum(offPtsMatch[1]); continue; }

    const defPtsMatch = line.match(/Def\.?\s*Points[\s\t]+([\d,]+)/i);
    if (defPtsMatch) { result.def = cleanNum(defPtsMatch[1]); continue; }

    // WoL Offense/Defense
    const offMatch = line.match(/(?:Offense|Off(?:ensive)?\s*Force)[\s\t]+([\d,]+)/i);
    if (offMatch) { result.off = cleanNum(offMatch[1]); continue; }

    const defMatch = line.match(/(?:Defense|Def(?:ensive)?\s*Force)[\s\t]+([\d,]+)/i);
    if (defMatch) { result.def = cleanNum(defMatch[1]); continue; }

    // TPA — Genesis format: "1,224 (1.0 tpa)"
    const tpaGenMatch = line.match(/Thieves[\s\t]+([\d,]+)\s*\(([\d.]+)\s*tpa\)/i);
    if (tpaGenMatch) {
      result.thieves = cleanNum(tpaGenMatch[1]);
      result.o_tpa = tpaGenMatch[2];
      result.d_tpa = tpaGenMatch[2];
      continue;
    }

    // WPA — Genesis format: "314 (0.3 wpa)"
    const wpaGenMatch = line.match(/Wizards[\s\t]+([\d,]+)\s*\(([\d.]+)\s*wpa\)/i);
    if (wpaGenMatch) {
      result.wizards = cleanNum(wpaGenMatch[1]);
      result.o_wpa = wpaGenMatch[2];
      result.d_wpa = wpaGenMatch[2];
      continue;
    }

    // Thieves plain
    const thievesMatch = line.match(/Thieves[\s\t]+([\d,]+)/i);
    if (thievesMatch && !result.thieves) { result.thieves = cleanNum(thievesMatch[1]); continue; }

    // Wizards plain
    const wizardsMatch = line.match(/Wizards[\s\t]+([\d,]+)/i);
    if (wizardsMatch && !result.wizards) { result.wizards = cleanNum(wizardsMatch[1]); continue; }

    // War Horses
    const horseMatch = line.match(/War\s*Horses[\s\t]+([\d,]+)/i);
    if (horseMatch) { result.war_horses = cleanNum(horseMatch[1]); continue; }

    // Prisoners
    const prisonerMatch = line.match(/Prisoners[\s\t]+([\d,]+)/i);
    if (prisonerMatch) { result.prisoners = cleanNum(prisonerMatch[1]); continue; }

    // Genesis units by name
    const unitPatterns = [
      { regex: /Soldiers[\s\t]+([\d,]+)/i, key: "soldiers" },
      { regex: /Quickblades[\s\t]+([\d,]+)/i, key: "off_specs" },
      { regex: /Pikemen[\s\t]+([\d,]+)/i, key: "def_specs" },
      { regex: /Golems[\s\t]+([\d,]+)/i, key: "elites" },
      { regex: /Off(?:ensive)?\s*Spec[\s\t]+([\d,]+)/i, key: "off_specs" },
      { regex: /Def(?:ensive)?\s*Spec[\s\t]+([\d,]+)/i, key: "def_specs" },
      { regex: /Elite[\s\t]+([\d,]+)/i, key: "elites" },
      { regex: /Mercenar[\w]+[\s\t]+([\d,]+)/i, key: "mercs" },
    ];
    for (const { regex, key } of unitPatterns) {
      const m = line.match(regex);
      if (m) { result[key] = cleanNum(m[1]); break; }
    }

    // Spells active
    if (lower.includes("love and peace") || lower.includes("duration:")) {
      const spellMatch = line.match(/Duration:\s*(.+)/i);
      if (spellMatch) result.good_spells = spellMatch[1].trim();
      continue;
    }

    // MAP
    const mapMatch = line.match(/(?:Military\s*Access\s*Pact|MAP)[\s\t]*:?\s*(.+)/i);
    if (mapMatch) { result.map = mapMatch[1].trim(); continue; }
  }

  // Mark as Genesis or WoL
  result.game_type = isGenesis ? "genesis" : "wol";

  return result;
}

function parseMilitary(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = { units: {} };

  for (const line of lines) {
    const patterns = [
      { regex: /Soldiers?[\s\t]+([\d,]+)/i, key: "soldiers" },
      { regex: /Off(?:ensive)?\s*Spec[\s\t]+([\d,]+)/i, key: "off_specs" },
      { regex: /Def(?:ensive)?\s*Spec[\s\t]+([\d,]+)/i, key: "def_specs" },
      { regex: /Elite[\s\t]+([\d,]+)/i, key: "elites" },
      { regex: /Quickblades[\s\t]+([\d,]+)/i, key: "off_specs" },
      { regex: /Pikemen[\s\t]+([\d,]+)/i, key: "def_specs" },
      { regex: /Golems[\s\t]+([\d,]+)/i, key: "elites" },
      { regex: /War\s*Horses?[\s\t]+([\d,]+)/i, key: "war_horses" },
      { regex: /Mercenar[\w]+[\s\t]+([\d,]+)/i, key: "mercs" },
      { regex: /Prisoners?[\s\t]+([\d,]+)/i, key: "prisoners" },
      { regex: /Generals?[\s\t]+([\d,]+)/i, key: "generals" },
    ];
    for (const { regex, key } of patterns) {
      const m = line.match(regex);
      if (m) { result.units[key] = cleanNum(m[1]); break; }
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
