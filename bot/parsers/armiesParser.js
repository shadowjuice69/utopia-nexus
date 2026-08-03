/**
 * Parse the ARMIES tab raw text from intel.utopia.site
 * Each data row looks like:
 * [slot] [kd#] [Name] [TimeRem] [Acres] [Ambush] [Gen] [Solds] [OSpec] [Elites] [Horses] [RawOff] [ModOff] [RawDef] [ModDef] [SomA]
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

function parseTimeRem(val) {
  // "29m 23s" => minutes float, "1h 51m" => hours float
  if (!val) return null;
  const hm = val.match(/(\d+)h\s*(\d+)m/);
  if (hm) return parseFloat(hm[1]) + parseFloat(hm[2]) / 60;
  const m = val.match(/(\d+)m/);
  if (m) return parseFloat(m[1]) / 60;
  return null;
}

function parseArmies(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Skip header/nav lines
  const SKIP = new Set(["KINGDOM","ENEMY","RECENT","KD STATS","OPS","USERS","NEWS",
    "OVERVIEW","WAR","MILITARY","SURVEY","SCIENCE","RESOURCES","ALL","ARMIES","GAINS",
    "OPS","WAR","GEN","ENEMY","WOL","SLOW KD"]);

  // Find the header row containing "Ambush"
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes("ambush")) { headerIdx = i; break; }
  }

  const provinces = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (SKIP.has(line.toUpperCase())) continue;
    if (i <= headerIdx) continue;

    // Each army row: split by 2+ spaces or tabs
    const cols = line.split(/\t|\s{2,}/).map(c => c.trim()).filter(Boolean);

    // Must have at least 10 cols and col[0] should be a small number (slot) or kd#
    // Pattern: slot(1-3) kd#(1-20) Name TimeRem Acres Ambush Gen Solds OSpec Elites Horses RawOff ModOff RawDef ModDef
    if (cols.length < 10) continue;

    // First col is slot (1-3), second is kd# (integer)
    if (!/^\d+$/.test(cols[0])) continue;
    if (!/^\d+$/.test(cols[1])) continue;

    const kd   = parseInt(cols[1]);
    const name = cols[2];
    const timeRem = parseTimeRem(cols[3]);
    const acres  = parseK(cols[4]);
    const ambush = parseK(cols[5]);
    const gen    = parseInt(cols[6]) || null;
    const solds  = parseK(cols[7]);
    const ospec  = parseK(cols[8]);
    const elites = parseK(cols[9]);
    const horses = parseK(cols[10]) || null;
    const rawOff = parseK(cols[11]);
    const modOff = parseK(cols[12]);
    const rawDef = parseK(cols[13]);
    const modDef = parseK(cols[14]);

    if (!name || !ambush) continue;

    if (!provinces[name]) {
      provinces[name] = {
        name,
        kd_slot: kd,
        acres,
        ambush,          // max ambush across armies = this province's ambush number
        generals: gen,
        raw_off: rawOff,
        mod_off: modOff,
        raw_def: rawDef,
        mod_def: modDef,
        armies: []
      };
    }

    // Update ambush to max seen (army with most troops out = hardest to ambush)
    if (ambush > provinces[name].ambush) provinces[name].ambush = ambush;

    provinces[name].armies.push({
      time_rem_hours: timeRem,
      soldiers: solds,
      off_specs: ospec,
      elites,
      horses,
      raw_off: rawOff,
      mod_off: modOff
    });
  }

  return Object.values(provinces);
}

module.exports = { parseArmies };
