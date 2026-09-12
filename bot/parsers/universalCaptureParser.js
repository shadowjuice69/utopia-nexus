const { parseKingdom } = require("./kingdomParser");
const { parseState } = require("./stateParser");
const { parseNews } = require("./newsParser");
const { parseArmies } = require("./armiesParser");
const { parseThrone } = require("./throneParser");

function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function number(value) { const n = parseInt(String(value || "").replace(/[^0-9-]/g, ""), 10); return Number.isFinite(n) ? n : null; }
function htmlToText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/tr\s*>/gi, "\n")
    .replace(/<\/t[dh]\s*>/gi, "\t")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .split(/\r?\n/)
    .map(line => line.replace(/[ \t]+$/g, "").trim())
    .filter(Boolean)
    .join("\n");
}
function normalizeCaptureText(visibleText, raw) {
  const visible = String(visibleText || "").trim();
  const html = String(raw || "").trim();
  const htmlText = html ? htmlToText(html) : "";
  if (!visible) return htmlText;
  if (!htmlText) return visible;
  return `${visible}\n${htmlText}`;
}
function decodeHtml(value) {
  return clean(String(value || "")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'"));
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
  if (u.includes("enchantment") || u.includes("magic") || u.includes("wizards") || /\bspells?\b/i.test(t)) return "magic";
  if (u.includes("thievery") || u.includes("thieves") || /\bthievery\b/i.test(t)) return "thievery";
  return "universal";
}

function parseKingdomDetails(text, rawHtml = "") {
  const parsed = parseKingdom(text);
  const provinces = [];
  const races = new Set(["Human", "Elf", "Orc", "Undead", "Halfling", "Faery", "Gnome", "Dwarf", "Dark Elf", "Draconian", "Dryad", "Bocan"]);
  const nobility = new Set(["Peasant", "Squire", "Knight", "Lord", "Lady", "Baron", "Baroness", "Viscount", "Viscountess", "Count", "Countess", "Marquis", "Marchioness", "Duke", "Duchess", "Prince", "Princess", "King", "Queen", "Emperor", "Empress", "Noble"]);
  const cleanProvince = value => clean(decodeHtml(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s*\*+$/, "").replace(/\s*\(M\)|\s*\(S\)/gi, ""));
  const addProvince = cells => {
    if (!cells || cells.length < 8) return false;
    const slot = number(cells[0]);
    const province = cleanProvince(cells[1]);
    const race = clean(cells[2]);
    const land = number(cells[3]);
    const nw = number(cells[4]);
    const nwpa = number(cells[5]);
    const nob = clean(cells[6]);
    const gains = number(cells[7]);
    if (slot != null && province && races.has(race) && nobility.has(nob) && land != null && nw != null && nwpa != null && gains != null) {
      provinces.push({ slot, name: province, race, land, nw, nwpa, nobility: nob, gains });
      return true;
    }
    return false;
  };

  const html = String(rawHtml || "");
  if (html) {
    const tableMatch = html.match(/<table[^>]*id=["']clone_kingdom["'][^>]*>([\s\S]*?)<\/table>/i);
    if (tableMatch) {
      const rows = tableMatch[1].match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
      for (const row of rows) {
        const cells = (row.match(/<td\b[^>]*>[\s\S]*?<\/td>/gi) || [])
          .map(cell => decodeHtml(cell.replace(/^<td\b[^>]*>/i, "").replace(/<\/td>$/i, "").replace(/<[^>]+>/g, " ")));
        addProvince(cells);
      }
    }
  }

  if (!provinces.length) {
    const lines = String(text || "").split(/\r?\n/).map(clean).filter(Boolean);
    const header = lines.findIndex(line => /Slot\/Online/i.test(line));
    if (header >= 0) {
      for (let i = header + 1; i < lines.length; i++) {
        if (!/^\d{1,2}\b/.test(lines[i])) continue;
        const cells = [];
        let j = i;
        while (j < lines.length && cells.length < 8) {
          const current = clean(lines[j]);
          if (j !== i && /^\d{1,2}\b/.test(current)) break;
          cells.push(current);
          j++;
        }
        addProvince(cells);
        i = j - 1;
      }
    }
  }

  parsed.provinces = provinces.slice(0, 25);
  parsed.province_count_parsed = parsed.provinces.length;
  parsed.raw_kind = "kingdom_details";
  return parsed;
}

function parseSurvey(text) {
  const buildings = {};
  const known = ["Barren Land", "Homes", "Farms", "Mills", "Banks", "Training Grounds", "Armouries", "Military Barracks", "Forts", "Castles", "Hospitals", "Guilds", "Towers", "Thieves' Dens", "Watch Towers", "Universities", "Libraries", "Stables", "Dungeons"];
  for (const line of String(text || "").split(/\r?\n/)) {
    const tabs = line.split(/\t/).map(clean);
    if (tabs.length >= 3 && known.includes(tabs[0])) {
      const qty = number(tabs[1]);
      const pct = parseFloat(String(tabs[2]).replace("%", ""));
      if (qty != null && Number.isFinite(pct)) buildings[tabs[0].toLowerCase().replace(/[^a-z]+/g, "_")] = { qty, pct };
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
  const known = new Set(["Alchemy", "Tools", "Housing", "Production", "Bookkeeping", "Artisan", "Strategy", "Siege", "Tactics", "Valor", "Heroism", "Resilience", "Crime", "Channeling", "Shielding", "Cunning", "Sorcery", "Finesse", "Arcana"]);
  const source = String(text || "");
  const htmlRow = /<td[^>]*>\s*(Alchemy|Tools|Housing|Production|Bookkeeping|Artisan|Strategy|Siege|Tactics|Valor|Heroism|Resilience|Crime|Channeling|Shielding|Cunning|Sorcery|Finesse|Arcana)\s*<\/td>\s*<td[^>]*>\s*([\d,]+)\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
  let match;
  while ((match = htmlRow.exec(source)) !== null) {
    const name = clean(match[1]);
    const books = number(match[2]);
    if (books == null || !known.has(name)) continue;
    const key = name.toLowerCase();
    science[key] = books;
    const effect = decodeHtml(match[3]);
    if (effect) effects[key] = effect;
  }
  for (const line of source.split(/\r?\n/)) {
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

function parseActionPage(text, kind) {
  const lines = String(text || "").split(/\r?\n/).map(clean).filter(Boolean);
  const fields = {};
  for (const line of lines) {
    const m = line.match(/^([^:]{2,120}):\s*(.+)$/);
    if (m) fields[clean(m[1]).toLowerCase().replace(/[^a-z0-9]+/g, "_")] = clean(m[2]);
  }
  return {
    kind,
    fields,
    lines,
    spells: kind === "magic" ? lines.filter(l => /spell|cast|enchant|curse|magic/i.test(l)) : [],
    operations: kind === "thievery" ? lines.filter(l => /operation|thief|steal|sabotage|infiltrate|rob|assassinate|kidnap|nightstrike|intel/i.test(l)) : []
  };
}

function parseUniversalCapture(url, rawText, rawHtml = "") {
  const text = normalizeCaptureText(rawText, rawHtml);
  const kind = detectKind(url, text);
  const base = { kind, raw_length: text.length };
  if (kind === "kingdom") return { type: "kingdom", data: parseKingdomDetails(text, rawHtml || rawText), ...base };
  if (kind === "throne") return { type: "throne", data: parseThrone(text), ...base };
  if (kind === "state") return { type: "state", data: parseState(text), ...base };
  if (kind === "news") return { type: "news", data: { events: parseNews(text) }, ...base };
  if (kind === "som") return { type: "som", data: { armies: parseArmies(text), raw: text }, ...base };
  if (kind === "survey") return { type: "survey", data: { ...parseSurvey(text), raw: text }, ...base };
  if (kind === "science") return { type: "science", data: { ...parseScience(text), raw: text }, ...base };
  if (kind === "magic") return { type: "magic", data: parseActionPage(text, "magic"), ...base };
  if (kind === "thievery") return { type: "thievery", data: parseActionPage(text, "thievery"), ...base };
  return { type: "universal-page", data: { page_kind: kind, url, text, raw_length: text.length }, ...base };
}

module.exports = { detectKind, parseUniversalCapture, parseKingdomDetails, parseSurvey, parseScience, normalizeCaptureText, htmlToText };