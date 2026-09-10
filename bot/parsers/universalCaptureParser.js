const { parseKingdom } = require("./kingdomParser");
const { parseState } = require("./stateParser");
const { parseNews } = require("./newsParser");
const { parseArmies } = require("./armiesParser");
const { parseThrone } = require("./throneParser");

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function number(value) {
  const n = parseInt(String(value || "").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

function detectKind(url, text) {
  const u = String(url || "").toLowerCase();
  const t = String(text || "");
  if (u.includes("kingdom_details") || /Total Provinces\s*\d/i.test(t) || /Total Networth\s*[\d,]+gc/i.test(t)) return "kingdom";
  if (u.includes("throne")) return "throne";
  if (u.includes("council_state") || u.includes("province_state")) return "state";
  if (u.includes("province_news") || u.includes("province_logs") || u.includes("kingdom_news") || u.includes("kd_news")) return "news";
  if (u.includes("council_science") || u.includes("science")) return "science";
  if (u.includes("build") || u.includes("survey") || u.includes("council_internal")) return "survey";
  if (u.includes("military") || u.includes("train_army") || u.includes("release_army") || u.includes("draft_calculator") || u.includes("som")) return "som";
  if (u.includes("enchantment") || u.includes("wizards")) return "magic";
  if (u.includes("thievery")) return "thievery";
  return "universal";
}

function parseKingdomDetails(text) {
  const parsed = parseKingdom(text);
  const lines = String(text || "").split(/\r?\n/).map(clean).filter(Boolean);
  const provinces = [];
  const races = new Set(["Human", "Elf", "Orc", "Undead", "Halfling", "Faery", "Gnome", "Dwarf", "Dark Elf", "Draconian", "Dryad", "Bocan"]);
  const nobility = new Set(["Peasant", "Squire", "Knight", "Lord", "Lady", "Baron", "Baroness", "Viscount", "Viscountess", "Count", "Countess", "Marquis", "Marchioness", "Duke", "Duchess", "Prince", "Princess", "King", "Queen", "Emperor", "Empress", "Noble"]);

  const header = lines.findIndex(line => /^Slot\/Online$/i.test(line));
  if (header >= 0) {
    for (let i = header + 1; i < lines.length; i++) {
      const m = lines[i].match(/^(\d{1,2})\s+(.+?)\s+(Human|Elf|Orc|Undead|Halfling|Faery|Gnome|Dwarf|Dark Elf|Draconian|Dryad|Bocan)\s+([\d,]+)a\s+([\d,]+)gc\s+([\d,]+)gc\s+(.+?)\s+([\d,]+)$/i);
      if (!m) continue;
      const province = clean(m[2].replace(/\s*\*+$/, "").replace(/\s*\(M\)|\s*\(S\)/gi, ""));
      if (!province || races.has(province) || !nobility.has(clean(m[7]))) continue;
      provinces.push({
        slot: number(m[1]),
        name: province,
        race: clean(m[3]),
        land: number(m[4]),
        nw: number(m[5]),
        nwpa: number(m[6]),
        nobility: clean(m[7]),
        gains: number(m[8])
      });
    }
  }

  parsed.provinces = provinces;
  parsed.province_count_parsed = provinces.length;
  parsed.raw_kind = "kingdom_details";
  return parsed;
}

function parseSurvey(text) {
  const buildings = {};
  const known = [
    "Barren Land", "Homes", "Farms", "Mills", "Banks", "Training Grounds",
    "Armouries", "Military Barracks", "Forts", "Castles", "Hospitals", "Guilds",
    "Towers", "Thieves' Dens", "Watch Towers", "Universities", "Libraries", "Stables", "Dungeons"
  ];

  for (const line of String(text || "").split(/\r?\n/)) {
    const tabs = line.split(/\t/).map(clean);
    if (tabs.length >= 3 && known.includes(tabs[0])) {
      const qty = number(tabs[1]);
      const pct = parseFloat(String(tabs[2]).replace("%", ""));
      if (qty != null && Number.isFinite(pct)) {
        buildings[tabs[0].toLowerCase().replace(/[^a-z]+/g, "_")] = { qty, pct };
        continue;
      }
    }

    const m = line.match(/^(.+?)\s+([\d,]+)\s*\(([\d.]+)%\)/);
    if (m) {
      const name = clean(m[1]);
      const key = name.toLowerCase().replace(/[^a-z]+/g, "_");
      if (!buildings[key]) buildings[key] = { qty: number(m[2]), pct: parseFloat(m[3]) };
    }
  }

  return { buildings };
}

function parseScience(text) {
  const science = {};
  const effects = {};
  const known = new Set([
    "Alchemy", "Tools", "Housing", "Production", "Bookkeeping", "Artisan", "Strategy", "Siege",
    "Tactics", "Valor", "Heroism", "Resilience", "Crime", "Channeling", "Shielding", "Cunning",
    "Sorcery", "Finesse", "Arcana"
  ]);

  for (const line of String(text || "").split(/\r?\n/)) {
    const cols = line.split(/\t/).map(clean);
    if (cols.length < 2 || !known.has(cols[0])) continue;
    const books = number(cols[1]);
    if (books == null) continue;
    const key = cols[0].toLowerCase();
    science[key] = books;
    if (cols[2]) effects[key] = cols[2];
  }

  return { science, science_effects: effects };
}

function parseUniversalCapture(url, rawText) {
  const text = String(rawText || "");
  const kind = detectKind(url, text);
  const base = { kind, raw_length: text.length };

  if (kind === "kingdom") return { type: "kingdom", data: parseKingdomDetails(text), ...base };
  if (kind === "throne") return { type: "throne", data: parseThrone(text), ...base };
  if (kind === "state") return { type: "state", data: parseState(text), ...base };
  if (kind === "news") return { type: "news", data: { events: parseNews(text) }, ...base };
  if (kind === "som") return { type: "som", data: { armies: parseArmies(text), raw: text }, ...base };
  if (kind === "survey") return { type: "survey", data: { ...parseSurvey(text), raw: text }, ...base };
  if (kind === "science") return { type: "science", data: { ...parseScience(text), raw: text }, ...base };

  return {
    type: "universal-page",
    data: {
      page_kind: kind,
      url,
      text,
      raw_length: text.length
    },
    ...base
  };
}

module.exports = { detectKind, parseUniversalCapture, parseKingdomDetails, parseSurvey, parseScience };
