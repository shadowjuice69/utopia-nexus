// Parses Utopia throne/military/science page pastes into structured intel

function cleanNum(str) {
  if (!str) return null;
  return str.replace(/,/g, "").trim();
}

function parseThrone(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    // Province name — usually first non-empty line or contains "the province of"
    if (!result.name) {
      const provMatch = line.match(/^(.+?)\s*(?:\(([^)]+)\))?\s*$/);
      if (provMatch && !lower.includes(':') && line.length < 60) {
        result.name = provMatch[1].trim();
        if (provMatch[2]) result.combo = provMatch[2].trim();
      }
    }

    // Race/Personality combo
    const comboMatch = line.match(/Race:\s*(.+)/i) || line.match(/^([A-Z][a-z]+)\s*\/\s*([A-Z][a-z]+)/);
    if (comboMatch && !result.race) {
      result.race = comboMatch[1]?.trim();
    }

    // Kingdom
    const kdMatch = line.match(/Kingdom.*?:\s*(.+?)\s*\((\d+:\d+)\)/i);
    if (kdMatch) {
      result.kingdom = kdMatch[1].trim();
      result.coordinates = kdMatch[2];
    }

    // Networth
    const nwMatch = line.match(/(?:Net\s*[Ww]orth|NW)[\s:]*([0-9,]+)/i);
    if (nwMatch) result.nw = cleanNum(nwMatch[1]);

    // Acres
    const acresMatch = line.match(/(?:Acres?|Land)[\s:]*([0-9,]+)/i);
    if (acresMatch) result.acres = cleanNum(acresMatch[1]);

    // Offense/Defense
    const offMatch = line.match(/(?:Offense|Off(?:ensive)?\s*(?:Force)?)[\s:]*([0-9,]+)/i);
    if (offMatch) result.off = cleanNum(offMatch[1]);

    const defMatch = line.match(/(?:Defense|Def(?:ensive)?\s*(?:Force)?)[\s:]*([0-9,]+)/i);
    if (defMatch) result.def = cleanNum(defMatch[1]);

    // BE
    const beMatch = line.match(/(?:Building\s*Eff(?:iciency)?|BE)[\s:]*([0-9.]+)\s*%?/i);
    if (beMatch) result.be = cleanNum(beMatch[1]);

    // Wages
    const wagesMatch = line.match(/Wages?[\s:]*([0-9.]+)\s*%?/i);
    if (wagesMatch) result.wages = cleanNum(wagesMatch[1]);

    // Stealth
    const stealthMatch = line.match(/Stealth[\s:]*([0-9.]+)\s*%?/i);
    if (stealthMatch) result.stlth = cleanNum(stealthMatch[1]);

    // Mana
    const manaMatch = line.match(/Mana[\s:]*([0-9.]+)\s*%?/i);
    if (manaMatch) result.mana = cleanNum(manaMatch[1]);

    // Peasants/Peons
    const peasantMatch = line.match(/(?:Peasants?|Peons?)[\s:]*([0-9,]+)/i);
    if (peasantMatch) result.peons = cleanNum(peasantMatch[1]);

    // Honor
    const honorMatch = line.match(/Honor[\s:]*([0-9,]+)/i);
    if (honorMatch) result.honor = cleanNum(honorMatch[1]);

    // TPA
    const otpaMatch = line.match(/(?:Offensive?\s*TPA|oTPA)[\s:]*([0-9.]+)/i);
    if (otpaMatch) result.o_tpa = otpaMatch[1].trim();

    const dtpaMatch = line.match(/(?:Defensive?\s*TPA|dTPA)[\s:]*([0-9.]+)/i);
    if (dtpaMatch) result.d_tpa = dtpaMatch[1].trim();

    // WPA
    const owpaMatch = line.match(/(?:Offensive?\s*WPA|oWPA)[\s:]*([0-9.]+)/i);
    if (owpaMatch) result.o_wpa = owpaMatch[1].trim();

    const dwpaMatch = line.match(/(?:Defensive?\s*WPA|dWPA)[\s:]*([0-9.]+)/i);
    if (dwpaMatch) result.d_wpa = dwpaMatch[1].trim();

    // Population %
    const popMatch = line.match(/(?:Pop(?:ulation)?\s*(?:Satisfaction)?|Happiness)[\s:]*([0-9.]+)\s*%?/i);
    if (popMatch) result.pop_pct = cleanNum(popMatch[1]);

    // Spells active
    if (lower.includes('spell') && lower.includes('active') || lower.includes('enchantment')) {
      const spellLine = lines.slice(i, i + 5).join(' ');
      const spellMatch = spellLine.match(/(?:spells?|enchantments?)[\s:]*(.+?)(?:\n|$)/i);
      if (spellMatch) result.good_spells = spellMatch[1].trim();
    }

    // MAP
    const mapMatch = line.match(/(?:Military\s*Access\s*(?:Pact)?|MAP)[\s:]*(.+)/i);
    if (mapMatch && !result.map) result.map = mapMatch[1].trim();
  }

  return result;
}

function parseMilitary(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = { units: {} };

  for (const line of lines) {
    // Soldiers
    const soldierMatch = line.match(/Soldiers?[\s:]*([0-9,]+)/i);
    if (soldierMatch) result.units.soldiers = cleanNum(soldierMatch[1]);

    // Off specs
    const offSpecMatch = line.match(/(?:Off(?:ensive)?\s*Spec(?:ialist)?s?)[\s:]*([0-9,]+)/i);
    if (offSpecMatch) result.units.off_specs = cleanNum(offSpecMatch[1]);

    // Def specs
    const defSpecMatch = line.match(/(?:Def(?:ensive)?\s*Spec(?:ialist)?s?)[\s:]*([0-9,]+)/i);
    if (defSpecMatch) result.units.def_specs = cleanNum(defSpecMatch[1]);

    // Elites
    const eliteMatch = line.match(/(?:Elite(?:\s*Units?)?|Elites)[\s:]*([0-9,]+)/i);
    if (eliteMatch) result.units.elites = cleanNum(eliteMatch[1]);

    // War Horses
    const horseMatch = line.match(/(?:War\s*Horses?|Horses?)[\s:]*([0-9,]+)/i);
    if (horseMatch) result.units.war_horses = cleanNum(horseMatch[1]);

    // Mercs
    const mercMatch = line.match(/(?:Mercenaries|Mercs?)[\s:]*([0-9,]+)/i);
    if (mercMatch) result.units.mercs = cleanNum(mercMatch[1]);

    // Prisoners
    const prisonerMatch = line.match(/Prisoners?[\s:]*([0-9,]+)/i);
    if (prisonerMatch) result.units.prisoners = cleanNum(prisonerMatch[1]);

    // Generals
    const genMatch = line.match(/Generals?[\s:]*([0-9,]+)/i);
    if (genMatch) result.generals = cleanNum(genMatch[1]);
  }

  return result;
}

function summarizeIntel(parsed) {
  const parts = [];
  if (parsed.name) parts.push(`**${parsed.name}**`);
  if (parsed.combo || parsed.race) parts.push(parsed.combo || parsed.race);
  if (parsed.nw) parts.push(`NW: ${parseInt(parsed.nw).toLocaleString()}`);
  if (parsed.acres) parts.push(`Acres: ${parseInt(parsed.acres).toLocaleString()}`);
  if (parsed.off) parts.push(`Off: ${parseInt(parsed.off).toLocaleString()}`);
  if (parsed.def) parts.push(`Def: ${parseInt(parsed.def).toLocaleString()}`);
  if (parsed.be) parts.push(`BE: ${parsed.be}%`);
  return parts.join(' | ');
}

module.exports = { parseThrone, parseMilitary, summarizeIntel };
