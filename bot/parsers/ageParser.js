'use strict';

const RACE_NAMES = ['Avian','Dark Elf','Dwarf','Dryad','Elf','Faery','Halfling','Human','Orc','Undead'];
const PERSONALITY_NAMES = ['The Artisan','The General','The Heretic','The Mystic','The Necromancer',
  'The Cleric','The Rogue','The Tactician','The Warrior','The War Hero','The Sage'];
const DRAGON_NAMES = ['Amethyst Dragon','Emerald Dragon','Ruby Dragon','Topaz Dragon','Sapphire Dragons'];

function emptyResult() {
  return { races: {}, personalities: {}, buildings: {}, spells: {}, thievery: {}, game_rules: {}, dragons: {}, science: {} };
}
function cleanBullet(line) { return line.replace(/^[•\-\*]+\s*/, '').trim(); }
function stripCite(text) { return text.replace(/\s*\[cite:\s*\d+\]/g, ''); }
function isPdfFormat(lines) {
  return lines.some(l => RACE_NAMES.some(r => l.startsWith(`${r} Bonuses:`)));
}

function parseStructuredFormat(lines) {
  const result = emptyResult();
  let currentSection = null, currentRace = null, currentPersonality = null, currentDragon = null;
  let inUnits = false, inPenalties = false;
  const SECTION_HEADERS = {
    'Buildings':'buildings','Science':'science','Spells':'spells','Thievery':'thievery',
    'Attacking and Defending':'attacking','Relations & Hostility':'relations',
    'Relations & Hostility Updates':'relations','Dragons':'dragons','Races':'races','Personalities':'personalities',
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], line = cleanBullet(raw);
    if (SECTION_HEADERS[raw] !== undefined) {
      currentSection = SECTION_HEADERS[raw]; currentRace = currentPersonality = currentDragon = null; inUnits = inPenalties = false; continue;
    }
    if (currentSection === 'races') {
      const isRace = RACE_NAMES.find(r => raw === r);
      if (isRace) { currentRace = isRace; currentPersonality = currentDragon = null; inUnits = inPenalties = false; result.races[currentRace] = { bonuses:[], penalties:[], units:{}, spells:[], war_doctrine:'', unique_passive:'' }; continue; }
      if (currentRace) {
        if (line === 'Units:') { inUnits = true; inPenalties = false; continue; }
        if (line === 'Bonuses:') { inUnits = inPenalties = false; continue; }
        if (line === 'Penalties:') { inUnits = false; inPenalties = true; continue; }
        const r = result.races[currentRace];
        if (inUnits) { const um = line.match(/^(Soldier|Offensive Specialist|Defensive Specialist|Elite Unit|Mercenary|Prisoner|War Horse):\s*(.+)/); if (um) r.units[um[1]] = um[2].trim(); continue; }
        if (line.startsWith('War Doctrine')) { r.war_doctrine = line; continue; }
        if (line.startsWith('Unique Passive')) { r.unique_passive = line; continue; }
        if (line.startsWith('Spells:')) { r.spells = line.replace('Spells:','').split(',').map(s=>s.trim()).filter(Boolean); continue; }
        if ((raw.startsWith('•')||raw.startsWith('-'))&&line) { if (inPenalties) r.penalties.push(line); else r.bonuses.push(line); }
        continue;
      }
    }
    if (currentSection === 'personalities') {
      const isP = PERSONALITY_NAMES.find(p => raw === p);
      if (isP) { currentPersonality = isP; currentRace = currentDragon = null; inPenalties = false; result.personalities[currentPersonality] = { bonuses:[], spells:[], unique_passive:'', starts_with:[] }; continue; }
      if (currentPersonality) {
        const p = result.personalities[currentPersonality];
        if (line.startsWith('Unique Passive')) { p.unique_passive = line; continue; }
        if (line.startsWith('Access to')) { p.spells = line.replace('Access to','').split(',').map(s=>s.trim()).filter(Boolean); continue; }
        if (line.startsWith('Starts with')) { p.starts_with.push(line); continue; }
        if ((raw.startsWith('•')||raw.startsWith('-'))&&line) p.bonuses.push(line);
        continue;
      }
    }
    if (currentSection === 'dragons') {
      const isDragon = DRAGON_NAMES.find(d => line.startsWith(d)||raw.startsWith(d));
      if (isDragon) { currentDragon = isDragon; currentRace = currentPersonality = null; result.dragons[currentDragon] = { effects:[] }; continue; }
      if (currentDragon&&(raw.startsWith('•')||raw.startsWith('-'))&&line) result.dragons[currentDragon].effects.push(line);
      continue;
    }
    if (!currentRace&&!currentPersonality&&!currentDragon&&(raw.startsWith('•')||raw.startsWith('-'))&&line) {
      if (currentSection==='buildings') result.buildings[`building_${Object.keys(result.buildings).length+1}`]=line;
      if (currentSection==='science') result.science[`science_${Object.keys(result.science).length+1}`]=line;
      if (currentSection==='spells') result.spells[`spell_${Object.keys(result.spells).length+1}`]=line;
      if (currentSection==='thievery') result.thievery[`thievery_${Object.keys(result.thievery).length+1}`]=line;
      if (currentSection==='attacking') result.game_rules[`attack_${Object.keys(result.game_rules).length+1}`]=line;
      if (currentSection==='relations') result.game_rules[`relation_${Object.keys(result.game_rules).length+1}`]=line;
    }
  }
  return result;
}

function parsePdfFormat(lines, fullText) {
  const result = emptyResult();
  const FLAT_MAP = { 'Buildings':'buildings','Science':'science','Spells':'spells','Thievery':'thievery','Attacking and Defending':'attacking','Relations & Hostility':'relations' };
  let currentFlat = null;
  for (const line of lines) {
    if (FLAT_MAP[line]) { currentFlat = FLAT_MAP[line]; continue; }
    if (['Dragons','Races','Personalities'].includes(line)) { currentFlat = null; continue; }
    if (currentFlat&&(line.startsWith('•')||line.startsWith('-'))) {
      const clean = cleanBullet(line); if (!clean) continue;
      if (currentFlat==='buildings') result.buildings[`building_${Object.keys(result.buildings).length+1}`]=clean;
      else if (currentFlat==='science') result.science[`science_${Object.keys(result.science).length+1}`]=clean;
      else if (currentFlat==='spells') result.spells[`spell_${Object.keys(result.spells).length+1}`]=clean;
      else if (currentFlat==='thievery') result.thievery[`thievery_${Object.keys(result.thievery).length+1}`]=clean;
      else if (currentFlat==='attacking'||currentFlat==='relations') result.game_rules[`rule_${Object.keys(result.game_rules).length+1}`]=clean;
    }
  }
  const dragonStart = fullText.indexOf('\nDragons\n'), dragonEnd = fullText.indexOf('\nRaces\n');
  if (dragonStart !== -1 && dragonEnd !== -1) {
    let dragonBlock = fullText.slice(dragonStart, dragonEnd);
    for (const d of DRAGON_NAMES) dragonBlock = dragonBlock.replace(new RegExp(`([^\\n])(${d})`,'g'),`$1\n$2`);
    let currentDragon = null;
    for (const line of dragonBlock.split('\n').map(l=>l.trim()).filter(Boolean)) {
      const dragon = DRAGON_NAMES.find(d => line===d||line.startsWith(d));
      if (dragon) { currentDragon = dragon; result.dragons[currentDragon] = { effects:[] }; continue; }
      if (currentDragon&&(line.startsWith('•')||line.startsWith('-'))) { const clean=cleanBullet(line); if (clean) result.dragons[currentDragon].effects.push(clean); }
    }
  }
  const joinedText = lines.join(' ');
  const racesIdx = joinedText.indexOf('Races '), persIdx = joinedText.indexOf('Personalities');
  const racesBlock = racesIdx !== -1 ? joinedText.slice(racesIdx, persIdx !== -1 ? persIdx : undefined) : '';
  const racePat = new RegExp(`(${RACE_NAMES.map(r=>r.replace(/ /g,'\\s+')).join('|')})\\s+Bonuses:`,'g');
  const raceMatches = [...racesBlock.matchAll(racePat)];
  for (let i = 0; i < raceMatches.length; i++) {
    const raceName = raceMatches[i][1].replace(/\s+/g,' ').trim();
    const start = raceMatches[i].index + raceMatches[i][0].length;
    const end = i+1 < raceMatches.length ? raceMatches[i+1].index : racesBlock.length;
    const data = racesBlock.slice(start, end).trim();
    const r = { bonuses:[], penalties:[], units:{}, spells:[], war_doctrine:'', unique_passive:'' };
    const wdM = data.match(/War Doctrine \(In War\):\s*(.+?)(?=Unique Passive|Spells:|Penalties:|Units:|$)/); if (wdM) r.war_doctrine = 'War Doctrine (In War): '+wdM[1].trim();
    const upNameM = data.match(/Unique Passive\s*[-–]\s*([^:]+):\s*(.+?)(?=Spells:|Penalties:|Units:|War Doctrine|$)/); if (upNameM) r.unique_passive = `Unique Passive - ${upNameM[1].trim()}: ${upNameM[2].trim()}`;
    const spM = data.match(/Spells:\s*(.+?)(?=Penalties:|Units:|War Doctrine|Unique Passive|$)/); if (spM) r.spells = spM[1].split(',').map(s=>s.trim()).filter(Boolean);
    const bonusText = data.split(/War Doctrine|Unique Passive|Spells:|Penalties:|Units:/)[0].trim();
    if (bonusText) bonusText.split(/,\s*(?=[+\-]|\w)/).forEach(b=>{b=b.trim();if(b)r.bonuses.push(b);});
    const penM = data.match(/Penalties:\s*(.+?)(?=Units:|War Doctrine|Unique Passive|Spells:|$)/); if (penM) penM[1].trim().split(/,\s*(?=[+\-]|\w)/).forEach(p=>{p=p.trim();if(p)r.penalties.push(p);});
    const unitTypes = ['Soldier','Offensive Specialist','Defensive Specialist','Elite Unit','Mercenary','Prisoner','War Horse'];
    const unitsM = data.match(/Units:\s*(.+?)$/); if (unitsM) unitTypes.forEach(ut=>{const um=unitsM[1].match(new RegExp(`${ut}\\s*\\(([^)]+)\\)`));if(um)r.units[ut]=um[1].trim();});
    result.races[raceName] = r;
  }
  let inP = false;
  for (const line of lines) {
    if (line === 'Personalities') { inP = true; continue; }
    if (inP&&(line.startsWith('•')||line.startsWith('-'))) {
      const clean = cleanBullet(line), pm = clean.match(/^(The \w[\w\s]*?):\s*(.+)/);
      if (pm&&PERSONALITY_NAMES.includes(pm[1].trim())) {
        const pname=pm[1].trim(), pdata=pm[2].trim(), p={bonuses:[],spells:[],unique_passive:'',starts_with:[]};
        const passM=pdata.match(/Passive:\s*(.+?)(?:\.|$)/); if(passM) p.unique_passive='Passive: '+passM[1].trim();
        const swM=pdata.match(/starts with\s+(.+?)(?=Passive:|$)/i); if(swM) p.starts_with.push('Starts with '+swM[1].trim());
        pdata.split(/starts with|Passive:/i)[0].split(/,\s*(?=[+\-]|\w)/).forEach(b=>{b=b.trim().replace(/\.$/,'');if(b&&b.length>2)p.bonuses.push(b);});
        result.personalities[pname]=p;
      }
    }
  }
  return result;
}

function parseAgeFileChunked(rawText) {
  let text = String(rawText)
    .replace(/^\uFEFF/,'').replace(/\u000C/g,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n')
    .replace(/\bRuby\n+Dragon\b/g,'Ruby Dragon')
    .replace(/\bSapphire\n+Dragons\b/g,'Sapphire Dragons')
    .replace(/\bAmethyst\n+Dragon\b/g,'Amethyst Dragon')
    .replace(/\bEmerald\n+Dragon\b/g,'Emerald Dragon')
    .replace(/\bTopaz\n+Dragon\b/g,'Topaz Dragon');
  text = stripCite(text);
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
  return isPdfFormat(lines) ? parsePdfFormat(lines, text) : parseStructuredFormat(lines);
}

function summarize(parsed) {
  const lines = [];
  if (Object.keys(parsed.races).length)        lines.push(`🏁 ${Object.keys(parsed.races).length} Races`);
  if (Object.keys(parsed.personalities).length) lines.push(`🎭 ${Object.keys(parsed.personalities).length} Personalities`);
  if (Object.keys(parsed.dragons).length)       lines.push(`🐉 ${Object.keys(parsed.dragons).length} Dragons`);
  if (Object.keys(parsed.spells).length)        lines.push(`✨ ${Object.keys(parsed.spells).length} Spell changes`);
  if (Object.keys(parsed.thievery).length)      lines.push(`🗡️ ${Object.keys(parsed.thievery).length} Thievery changes`);
  if (Object.keys(parsed.buildings).length)     lines.push(`🏗️ ${Object.keys(parsed.buildings).length} Building changes`);
  if (Object.keys(parsed.science).length)       lines.push(`🔬 ${Object.keys(parsed.science).length} Science changes`);
  if (Object.keys(parsed.game_rules).length)    lines.push(`⚔️ ${Object.keys(parsed.game_rules).length} Game rule changes`);
  return lines.join('\n');
}

module.exports = { parseAgeFileChunked, summarize };
