/**
 * Parse the ARMIES tab data from intel.utopia.site
 * Each cell comes as its own line in this order:
 * id_a | # | Name | TimeRem | Acres | Ambush | Gen | Solds | OSpec | Elites | Horses | RawOff | ModOff | RawDef | ModDef | SomA
 * 16 values per row
 */

function parseK(val) {
  if (!val) return null;
  const s = val.toString().replace(/,/g, "").trim();
  const m = s.match(/^([\d.]+)([km]?)$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (m[2].toLowerCase() === "k") return Math.round(n * 1000);
  if (m[2].toLowerCase() === "m") return Math.round(n * 1000000);
  return Math.round(n) || null;
}

function parseArmies(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Skip header/nav lines
  const SKIP = new Set(["KINGDOM","ENEMY","RECENT","KD STATS","OPS","USERS","NEWS",
    "OVERVIEW","WAR","MILITARY","SURVEY","SCIENCE","RESOURCES","ALL","ARMIES","GAINS",
    "GEN","WOL","SLOW KD","ID_A","#","NAME","TIMEREM","TIMEREMAINING","ACRES","AMBUSH",
    "SOLDS","OSPEC","ELITES","HORSES","RAWOFF","MODOFF","RAWDEF","MODDEF","SOMA"]);

  // Find start — line after the header row (contains "Ambush")
  // The header appears as individual words on separate lines
  // Find index of "Ambush" line
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === "Ambush" || lines[i] === "AMBUSH") {
      // Skip forward past remaining header words (Gen, Solds, OSpec, etc)
      // Data starts when we hit a short number (the id_a like "2_1" or "1_1")
      for (let j = i + 1; j < lines.length; j++) {
        if (/^\d+_\d+$/.test(lines[j]) || /^\d+$/.test(lines[j])) {
          startIdx = j;
          break;
        }
      }
      break;
    }
  }

  if (startIdx === -1) return [];

  // Each row is 16 values: id_a, kd#, name, timerem, acres, ambush, gen, solds, ospec, elites, horses, rawoff, modoff, rawdef, moddef, soma
  const COLS = 16;
  const provinces = {};

  let i = startIdx;
  while (i + COLS <= lines.length) {
    const chunk = lines.slice(i, i + COLS);

    const idA    = chunk[0];  // e.g. "2_1"
    const kdNum  = chunk[1];  // e.g. "2"
    const name   = chunk[2];
    const timeRem = chunk[3];
    const acres  = parseK(chunk[4]);
    const ambush = parseK(chunk[5]);
    const gen    = parseInt(chunk[6]) || null;
    const solds  = parseK(chunk[7]);
    const ospec  = parseK(chunk[8]);
    const elites = parseK(chunk[9]);
    const horses = parseK(chunk[10]);
    const rawOff = parseK(chunk[11]);
    const modOff = parseK(chunk[12]);
    const rawDef = parseK(chunk[13]);
    const modDef = parseK(chunk[14]);

    // Validate: idA should be like "2_1", name shouldn't be a number
    if (!/^\d+_\d+$/.test(idA) && !/^\d+$/.test(idA)) { i++; continue; }
    if (!name || /^\d+$/.test(name)) { i++; continue; }
    if (!ambush) { i += COLS; continue; }

    if (!provinces[name]) {
      provinces[name] = { name, ambush, acres, raw_off: rawOff, raw_def: rawDef, mod_off: modOff, mod_def: modDef, armies: [] };
    }
    if (ambush > provinces[name].ambush) provinces[name].ambush = ambush;
    provinces[name].armies.push({ time_rem: timeRem, soldiers: solds, off_specs: ospec, elites, horses, raw_off: rawOff });

    i += COLS;
  }

  return Object.values(provinces);
}

module.exports = { parseArmies };
