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

function parseUniversalCapture(url, rawText) {
  const text = String(rawText || "");
  const kind = detectKind(url, text);
  const base = { kind, raw_length: text.length };

  if (kind === "kingdom") return { type: "kingdom", data: parseKingdomDetails(text), ...base };
  if (kind === "throne") {
    const p = parseThrone(text);
    return { type: "throne", data: p, ...base };
  }
  if (kind === "state") return { type: "state", data: parseState(text), ...base };
  if (kind === "news") return { type: "news", data: { events: parseNews(text) }, ...base };
  if (kind === "som") return { type: "som", data: { armies: parseArmies(text), raw: text }, ...base };

  // These pages are intentionally retained as structured universal data until
  // their page-specific extractors are rebuilt. Raw capture remains authoritative.
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

module.exports = { detectKind, parseUniversalCapture, parseKingdomDetails };
