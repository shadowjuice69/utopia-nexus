require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const RACE_MAP = {
  "Av": "Avian", "De": "Dark Elf", "Dr": "Dryad", "Dw": "Dwarf",
  "El": "Elf", "Fa": "Faery", "Ha": "Halfling", "Hu": "Human",
  "Or": "Orc", "Un": "Undead", "Gn": "Gnome"
};

const PERS_MAP = {
  "Ar": "Artisan", "Cl": "Cleric", "Ge": "General", "He": "Heretic",
  "My": "Mystic", "Ne": "Necromancer", "Ro": "Rogue", "Sa": "Sage",
  "Ta": "Tactician", "Wa": "Warrior", "Wh": "War Hero"
};

function parseCombo(combo) {
  if (!combo) return { race: null, personality: null };
  const parts = combo.split("/");
  return {
    race: RACE_MAP[parts[0]] || parts[0],
    personality: PERS_MAP[parts[1]] || parts[1],
  };
}

function cleanNum(val) {
  if (!val) return null;
  const n = parseFloat(val.toString().replace(/,/g, "").trim());
  return isNaN(n) ? null : n;
}

function parseSpells(spellStr) {
  if (!spellStr) return null;
  const SPELL_ABBR = {
    "LP": "Love and Peace", "BB": "Builder's Boon", "IA": "Inner Strength",
    "MP": "Minor Protection", "FL": "Fountain of Life", "HI": "Holy Insight",
    "FoK": "Fog of Knowledge", "MF": "Mage's Fury", "MS": "Magic Shield",
  };
  return spellStr.split(",").map(s => SPELL_ABBR[s.trim()] || s.trim()).join(", ");
}

async function importCSV(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim().replace(/^#/, "").trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/(".*?"|[^,]+)(?=,|$)/g)?.map(c => c.replace(/"/g, "").trim()) || [];
    const row = {};
    headers.forEach((h, idx) => row[h] = cols[idx] || null);
    rows.push(row);
  }

  console.log(`Parsed ${rows.length} rows`);
  let success = 0, failed = 0;

  for (const row of rows) {
    const { race, personality } = parseCombo(row.Combo);
    const name = row.Name?.trim();
    if (!name) continue;

    const record = {
      name, kd_code: "3:2", race, personality,
      acres: cleanNum(row.Acres)?.toString(),
      nw: cleanNum(row.NW)?.toString(),
      off: cleanNum(row.Off)?.toString(),
      def: cleanNum(row.Def)?.toString(),
      be: row.BE?.replace("%", "") || null,
      o_tpa: cleanNum(row.oTpa)?.toString(),
      d_tpa: cleanNum(row.dTpa)?.toString(),
      o_wpa: cleanNum(row.oWpa)?.toString(),
      d_wpa: cleanNum(row.dWpa)?.toString(),
      honor: cleanNum(row.Honor)?.toString(),
      good_spells: parseSpells(row.GoodSpells),
      updated_at: new Date().toISOString(),
    };

    Object.keys(record).forEach(k => record[k] === null && delete record[k]);

    const { error } = await supabase
      .from("provinces")
      .upsert(record, { onConflict: "name" });

    if (error) { console.error(`❌ ${name}: ${error.message}`); failed++; }
    else { console.log(`✅ ${name} (${race} ${personality})`); success++; }
  }

  console.log(`\nDone: ${success} saved, ${failed} failed`);
}

const csvPath = process.argv[2];
if (!csvPath) { console.error("Usage: node importIntel.js <path-to-csv>"); process.exit(1); }
importCSV(path.resolve(csvPath));
