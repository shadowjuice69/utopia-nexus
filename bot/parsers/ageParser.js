function parseAgeFile(rawText) {
  const lines = rawText.split('\n').map(l => l.replace(/^\uFEFF/, '').trim()).filter(Boolean);

  const result = {
    races: {},
    personalities: {},
    buildings: {},
    spells: {},
    thievery: {},
    game_rules: {},
    dragons: {},
    science: {}
  };

  let currentSection = null;
  let currentRace = null;
  let currentPersonality = null;
  let currentDragon = null;
  let inUnits = false;
  let inPenalties = false;

  const RACE_NAMES = ['Avian','Dark Elf','Dwarf','Dryad','Elf','Faery','Halfling','Human','Orc','Undead'];
  const PERSONALITY_NAMES = ['The Artisan','The General','The Heretic','The Mystic','The Necromancer','The Cleric','The Rogue','The Tactician','The Warrior','The War Hero','The Sage'];
  const DRAGON_NAMES = ['Amethyst Dragon','Emerald Dragon','Ruby Dragon','Topaz Dragon','Sapphire Dragons'];

  function cleanBullet(line) {
    return line.replace(/^[•\-\*]+\s*/, '').replace(/^[•\-\*]+\s*/, '').trim();
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = cleanBullet(raw);

    // Section headers
    if (raw === 'Buildings') { currentSection = 'buildings'; currentRace = null; currentPersonality = null; currentDragon = null; inUnits = false; inPenalties = false; continue; }
    if (raw === 'Science') { currentSection = 'science'; currentRace = null; currentPersonality = null; currentDragon = null; inUnits = false; inPenalties = false; continue; }
    if (raw === 'Spells') { currentSection = 'spells'; currentRace = null; currentPersonality = null; currentDragon = null; inUnits = false; inPenalties = false; continue; }
    if (raw === 'Thievery') { currentSection = 'thievery'; currentRace = null; currentPersonality = null; currentDragon = null; inUnits = false; inPenalties = false; continue; }
    if (raw === 'Attacking and Defending') { currentSection = 'attacking'; currentRace = null; currentPersonality = null; currentDragon = null; inUnits = false; inPenalties = false; continue; }
    if (raw === 'Relations & Hostility' || raw === 'Relations & Hostility Updates') { currentSection = 'relations'; currentRace = null; currentPersonality = null; currentDragon = null; inUnits = false; inPenalties = false; continue; }
    if (raw === 'Dragons') { currentSection = 'dragons'; currentRace = null; currentPersonality = null; currentDragon = null; inUnits = false; inPenalties = false; continue; }
    if (raw === 'Races') { currentSection = 'races'; currentRace = null; currentPersonality = null; currentDragon = null; inUnits = false; inPenalties = false; continue; }
    if (raw === 'Personalities') { currentSection = 'personalities'; currentRace = null; currentPersonality = null; currentDragon = null; inUnits = false; inPenalties = false; continue; }

    // Race detection
    if (currentSection === 'races') {
      const isRace = RACE_NAMES.find(r => raw === r);
      if (isRace) {
        currentRace = isRace;
        currentPersonality = null;
        currentDragon = null;
        inUnits = false;
        inPenalties = false;
        result.races[currentRace] = { bonuses: [], penalties: [], units: {}, spells: [], war_doctrine: '', unique_passive: '' };
        continue;
      }

      if (currentRace) {
        if (line === 'Units:') { inUnits = true; inPenalties = false; continue; }
        if (line === 'Bonuses:') { inUnits = false; inPenalties = false; continue; }
        if (line === 'Penalties:') { inUnits = false; inPenalties = true; continue; }

        const r = result.races[currentRace];

        if (inUnits) {
          const unitMatch = line.match(/^(Soldier|Offensive Specialist|Defensive Specialist|Elite Unit|Mercenary|Prisoner|War Horse):\s*(.+)/);
          if (unitMatch) r.units[unitMatch[1]] = unitMatch[2].trim();
          continue;
        }

        if (line.startsWith('War Doctrine')) { r.war_doctrine = line; continue; }
        if (line.startsWith('Unique Passive')) { r.unique_passive = line; continue; }
        if (line.startsWith('Spells:')) { r.spells = line.replace('Spells:', '').split(',').map(s => s.trim()).filter(Boolean); continue; }

        if ((raw.startsWith('•') || raw.startsWith('-')) && line) {
          if (inPenalties) r.penalties.push(line);
          else r.bonuses.push(line);
        }
        continue;
      }
    }

    // Personality detection
    if (currentSection === 'personalities') {
      const isPersonality = PERSONALITY_NAMES.find(p => raw === p);
      if (isPersonality) {
        currentPersonality = isPersonality;
        currentRace = null;
        currentDragon = null;
        inPenalties = false;
        result.personalities[currentPersonality] = { bonuses: [], spells: [], unique_passive: '', starts_with: [] };
        continue;
      }

      if (currentPersonality) {
        const p = result.personalities[currentPersonality];
        if (line.startsWith('Unique Passive')) { p.unique_passive = line; continue; }
        if (line.startsWith('Access to')) { p.spells = line.replace('Access to', '').split(',').map(s => s.trim()).filter(Boolean); continue; }
        if (line.startsWith('Starts with')) { p.starts_with.push(line); continue; }
        if ((raw.startsWith('•') || raw.startsWith('-')) && line) p.bonuses.push(line);
        continue;
      }
    }

    // Dragon detection
    if (currentSection === 'dragons') {
      const isDragon = DRAGON_NAMES.find(d => line.startsWith(d) || raw.startsWith(d));
      if (isDragon) {
        currentDragon = isDragon;
        currentRace = null;
        currentPersonality = null;
        result.dragons[currentDragon] = { effects: [] };
        continue;
      }
      if (currentDragon && (raw.startsWith('•') || raw.startsWith('-')) && line) {
        result.dragons[currentDragon].effects.push(line);
      }
      continue;
    }

    // Flat sections
    if (!currentRace && !currentPersonality && !currentDragon && (raw.startsWith('•') || raw.startsWith('-')) && line) {
      if (currentSection === 'buildings') result.buildings[`building_${Object.keys(result.buildings).length + 1}`] = line;
      if (currentSection === 'science') result.science[`science_${Object.keys(result.science).length + 1}`] = line;
      if (currentSection === 'spells') result.spells[`spell_${Object.keys(result.spells).length + 1}`] = line;
      if (currentSection === 'thievery') result.thievery[`thievery_${Object.keys(result.thievery).length + 1}`] = line;
      if (currentSection === 'attacking') result.game_rules[`attack_${Object.keys(result.game_rules).length + 1}`] = line;
      if (currentSection === 'relations') result.game_rules[`relation_${Object.keys(result.game_rules).length + 1}`] = line;
    }
  }

  return result;
}

function summarize(parsed) {
  const lines = [];
  if (Object.keys(parsed.races).length) lines.push(`🧬 ${Object.keys(parsed.races).length} Races`);
  if (Object.keys(parsed.personalities).length) lines.push(`🎭 ${Object.keys(parsed.personalities).length} Personalities`);
  if (Object.keys(parsed.dragons).length) lines.push(`🐉 ${Object.keys(parsed.dragons).length} Dragons`);
  if (Object.keys(parsed.spells).length) lines.push(`✨ ${Object.keys(parsed.spells).length} Spell changes`);
  if (Object.keys(parsed.thievery).length) lines.push(`🗡️ ${Object.keys(parsed.thievery).length} Thievery changes`);
  if (Object.keys(parsed.buildings).length) lines.push(`🏗️ ${Object.keys(parsed.buildings).length} Building changes`);
  if (Object.keys(parsed.science).length) lines.push(`🔬 ${Object.keys(parsed.science).length} Science changes`);
  if (Object.keys(parsed.game_rules).length) lines.push(`⚔️ ${Object.keys(parsed.game_rules).length} Game rule changes`);
  return lines.join('\n');
}

// Process in chunks to avoid memory issues with large files
function parseAgeFileChunked(rawText) {
  const SECTION_HEADERS = ['Buildings','Science','Spells','Thievery','Attacking and Defending','Relations & Hostility','Relations & Hostility Updates','Dragons','Races','Personalities'];
  const lines = rawText.split('\n').map(l => l.replace(/^\uFEFF/, '').trim());

  // Find section boundaries
  const sections = [];
  let currentHeader = null;
  let currentStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (SECTION_HEADERS.includes(raw)) {
      if (currentHeader) sections.push({ header: currentHeader, lines: lines.slice(currentStart, i) });
      currentHeader = raw;
      currentStart = i;
    }
  }
  if (currentHeader) sections.push({ header: currentHeader, lines: lines.slice(currentStart) });

  // Parse each section independently and merge
  const merged = { races: {}, personalities: {}, buildings: {}, spells: {}, thievery: {}, game_rules: {}, dragons: {}, science: {} };

  for (const section of sections) {
    const chunk = section.lines.join('\n');
    const parsed = parseAgeFile(chunk);
    Object.assign(merged.races, parsed.races);
    Object.assign(merged.personalities, parsed.personalities);
    Object.assign(merged.buildings, parsed.buildings);
    Object.assign(merged.spells, parsed.spells);
    Object.assign(merged.thievery, parsed.thievery);
    Object.assign(merged.game_rules, parsed.game_rules);
    Object.assign(merged.dragons, parsed.dragons);
    Object.assign(merged.science, parsed.science);
  }

  return merged;
}

module.exports = { parseAgeFile, parseAgeFileChunked, summarize };
