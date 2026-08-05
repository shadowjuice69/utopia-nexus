const http = require("http");
const supabaseService = require("./supabase");
const logger = require("./logger");
const { parseThrone } = require("../parsers/throneParser");
const { parseKingdom } = require("../parsers/kingdomParser");
const { parseState } = require("../parsers/stateParser");
const { parseNews } = require("../parsers/newsParser");
const { parseArmies } = require("../parsers/armiesParser");

const INTEL_KEY = process.env.INTEL_KEY || "";
const PORT = parseInt(process.env.PORT || "3000", 10);
const MY_KD = process.env.MY_KD || "4:9";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      console.log("[RAW INTEL RECEIVED]", body.substring(0, 300));
      resolve(body);
    });
    req.on("error", reject);
  });
}

function parseIntel(url, prov, text) {
  const result = { url, prov, updated: new Date().toISOString() };
  console.log("[DEBUG URL CHECK]", JSON.stringify(url), url.includes("kingdom_details"));
  const kdMatch = url.match(/kd[=\/](\d+:\d+)/) || text.match(/\((\d+:\d+)\)/);
  result.kd = kdMatch ? kdMatch[1] : MY_KD;

  if (url.includes("kingdom_details") || text.includes("The kingdom of") || text.includes("Total Provinces") || text.includes("Total Networth")) {
    result.type = "kingdom";
    result.data = parseKingdom(text);
  } else if (url.includes("throne")) {
    result.type = "throne";
    const lines = text.split("\n").map(s => s.trim()).filter(Boolean);
    const get = (label) => {
      for (const line of lines) {
        const parts = line.split("\t");
        for (let i = 0; i < parts.length - 1; i++) {
          if (parts[i].toLowerCase().trim() === label.toLowerCase()) return parts[i+1].trim();
        }
      }
      return null;
    };
    console.log("[THRONE RAW LENGTH]", text.length);
console.log("[THRONE RAW START]", text.substring(0,500));

const parsed = parseThrone(text);

    result.data = {
        race: parsed.race,
        ruler: parsed.ruler,
        land: parsed.acres,
        networth: parsed.nw,
        honor: parsed.honor,
        offense: parsed.off,
        defense: parsed.def,
        be: parsed.be,
        peasants: parsed.peons,

        troops: {
          soldiers: parsed.soldiers,
          off_specs: parsed.off_specs,
          def_specs: parsed.def_specs,
          elites: parsed.elites,
          war_horses: parsed.war_horses,
          prisoners: parsed.prisoners
        },

        thieves: Number(parsed.thieves || 0),
        wizards: Number(parsed.wizards || 0),
        tpa: Number(parsed.o_tpa || parsed.r_tpa || parsed.d_tpa || 0),
        wpa: Number(parsed.o_wpa || parsed.r_wpa || parsed.d_wpa || 0),

        spells: parsed.good_spells
      };
  } else if (url.includes("survey") || url.includes("council_internal") || url.includes("/build")) {
    result.type = "survey";
    const buildings = {};
    text.split("\n").forEach(l => {
      // Tab-separated format: "Building Name	Quantity	% of Total	..."
      const tabs = l.split("\t");
      if (tabs.length >= 3) {
        const name = tabs[0].trim();
        const qty = parseInt(tabs[1].replace(/,/g,""), 10);
        const pctStr = tabs[2].replace('%','').trim();
        const pct = parseFloat(pctStr);
        const KNOWN = ["Barren Land","Homes","Farms","Mills","Banks","Training Grounds","Armouries","Military Barracks","Forts","Castles","Hospitals","Guilds","Towers","Thieves' Dens","Watch Towers","Universities","Libraries","Stables","Dungeons"];
        if (KNOWN.includes(name) && !isNaN(qty) && !isNaN(pct)) {
          buildings[name.toLowerCase().replace(/[^a-z]/g,"_")] = { qty, pct };
        }
      }
      // Fallback: old format "Name  1234  (12.3%)"
      const m = l.match(/^(.+?)\s+([\d,]+)\s*\(([\d.]+)%\)/);
      if (m) {
        const name = m[1].trim().toLowerCase().replace(/[^a-z]/g,"_");
        if (!buildings[name]) buildings[name] = { qty: parseInt(m[2].replace(/,/g,""),10), pct: parseFloat(m[3]) };
      }
    });
    result.data = { buildings };
  } else if (url.includes("council_science") || url.includes("sciences") || url.includes("/science")) {
    result.type = "science";
    const scienceData = {};
    const scienceEffects = {};
    text.split("\n").forEach(l => {
      const tabs = l.split("\t");
      if (tabs.length >= 2) {
        const KNOWN = ["Alchemy","Tools","Housing","Production","Bookkeeping","Artisan","Strategy","Siege","Tactics","Valor","Heroism","Resilience","Crime","Channeling","Shielding","Cunning","Sorcery","Finesse","Arcana"];
        const name = tabs[0].trim();
        if (KNOWN.includes(name)) {
          const books = parseInt(tabs[1].replace(/,/g,""), 10);
          const effect = tabs[2] ? tabs[2].trim() : null;
          if (!isNaN(books)) {
            scienceData[name.toLowerCase()] = books;
            if (effect) scienceEffects[name.toLowerCase()] = effect;
          }
        }
      }
    });
    result.data = { science: scienceData, science_effects: scienceEffects };
  } else if (url.includes("som") || url.includes("military")) {
    result.type = "som";
    let offense = null, defense = null, generals = null;
    const troops = {};
    const armies = []; // deployed armies with return times
    let inArmyTable = false;
    const TROOP_NAMES = ["Soldiers","Warriors","Axemen","Berserkers","War Horses","Thieves","Wizards"];

    text.split("\n").forEach(l => {
      let m;
      if ((m = l.match(/Net Offensive Points at Home[\s\t]+(\d[\d,]*)/i))) offense = parseInt(m[1].replace(/,/g,""),10);
      if ((m = l.match(/Net Defensive Points at Home[\s\t]+(\d[\d,]*)/i))) defense = parseInt(m[1].replace(/,/g,""),10);
      if ((m = l.match(/we have (\d+) generals/i))) generals = parseInt(m[1],10);

      // Detect army table header - "Standing Army" line
      if (l.includes("Standing Army")) {
        inArmyTable = true;
        return;
      }
      // Parse return times from "(X days left)" lines - keep collecting until we hit a troop row
      if (inArmyTable) {
        const armyMatches = [...l.matchAll(/\(([\d.]+) days left\)/gi)];
        if (armyMatches.length > 0) {
          armyMatches.forEach(am => armies.push({ return_days: parseFloat(am[1]), troops: {} }));
          return;
        }
      }

      if (inArmyTable) {
        if (l.includes("Military Training") || l.includes("Science Book")) { inArmyTable = false; return; }
        // Parse troop row: "Warriors  768  1,666  971"
        for (const name of TROOP_NAMES) {
          if (l.trim().startsWith(name)) {
            const cols = l.split(/\t+|\s{2,}/).map(c => c.trim()).filter(Boolean);
            if (cols.length >= 2) {
              const key = name.toLowerCase().replace(" ","_");
              const home = parseInt((cols[1]||"0").replace(/,/g,"").replace("-","0")) || 0;
              troops[key] = home;
              // Store per-army troop counts
              armies.forEach((army, i) => {
                const val = parseInt((cols[i+2]||"0").replace(/,/g,"").replace("-","0")) || 0;
                army.troops[key] = val;
              });
            }
            break;
          }
        }
        // Generals row
        if (l.trim().startsWith("Generals")) {
          const cols = l.split(/\t+|\s{2,}/).map(c => c.trim()).filter(Boolean);
          if (!generals && cols[1]) generals = parseInt(cols[1]) || null;
        }
      }
    });
    result.data = { offense, defense, generals, troops, armies };
  } else if (url.includes("council_state") || url.includes("province_state")) {
    result.type = "state";
    result.data = parseState(text);
  } else if (url.includes("province_news") || url.includes("province_logs") || url.includes("kd_news") || url.includes("kingdom_news")) {
    result.type = "news";
    result.data = { events: parseNews(text, prov) };
  } else if (url.includes("intel.utopia.site") || text.includes('"source":"intel-site-csv"') || text.includes('"source":"intel-site"') || prov === "intel-site") {
    result.type = "intel-site";
    // Check if raw CSV (starts with #,Name)
    const isRawCSV = text.trimStart().startsWith("#,Name") || text.trimStart().startsWith("#%2C") || url.includes("source=intel-site-csv");
    if (isRawCSV) {
      result.source = "intel-site-csv";
      result.data = { rows: [{ raw: text }] };
      result.tab = "overview";
    } else {
      result.source = "intel-site";
      try {
        const parsed = JSON.parse(text);
        result.data = parsed;
        result.tab = parsed.tab || "overview";
        result.kd = parsed.kd || result.kd;
      } catch(e) {
        result.data = { rows: [{ raw: text }] };
      }
    }
  } else {
    result.type = "unknown";
    result.data = { text };
  }
  return result;
}

function decodeCombo(combo) {
  if (!combo) return {};
  const RACE_MAP = {
    "Un": "Undead", "El": "Elf", "Or": "Orc", "Dw": "Dwarf",
    "Hu": "Human", "Av": "Avian", "Fa": "Faery", "Ha": "Halfling",
    "Dk": "Dark Elf", "Dr": "Dryad"
  };
  const PERS_MAP = {
    "Ta": "Tactician", "He": "Heretic", "Ge": "General", "Sa": "Sage",
    "Wh": "War Hero", "Wa": "Warrior", "My": "Mystic", "Ro": "Rogue",
    "Kn": "Knight", "Se": "Merchant"
  };
  const parts = combo.split("/");
  const result = {};
  if (parts[0] && RACE_MAP[parts[0].trim()]) result.race = RACE_MAP[parts[0].trim()];
  if (parts[1] && PERS_MAP[parts[1].trim()]) result.personality = PERS_MAP[parts[1].trim()];
  return result;
}

async function saveIntel(parsed, prov) {
  const sb = supabaseService.getClient();
  if (!sb) return;
  try {
    if (parsed.type === "throne") {
      const { data, error } = await sb.from("intel_throne").upsert({
        province: prov,
        kd_code: parsed.kd,
        ...parsed.data,
        thieves: Number(parsed.data.thieves || parsed.data.troops?.thieves || 0),
        wizards: Number(parsed.data.wizards || parsed.data.troops?.wizards || 0),

        tpa: Number(String(parsed.data.thieves || parsed.data.troops?.thieves || "")
          .match(/([\d.]+)\s*tpa/i)?.[1] || 0),

        wpa: Number(String(parsed.data.wizards || parsed.data.troops?.wizards || "")
          .match(/([\d.]+)\s*wpa/i)?.[1] || 0),
        updated_at: new Date().toISOString()
      }, { onConflict: "province,kd_code" });

      if (error) {
        logger.error(`[THRONE SAVE ERROR] ${error.message}`);
        return;
      }

      logger.info(`[THRONE RESULT] data=${JSON.stringify(data)} error=${JSON.stringify(error)}`);
      logger.info(`[THRONE SAVED] ${prov}`);

      // Also update provinces table for own kingdom members
      const myKd = process.env.MY_KD || "3:2";
      if (parsed.kd === myKd) {
        const d = parsed.data;
        const provUpdate = {};
        if (d.land)       provUpdate.acres    = d.land;
        if (d.networth)   provUpdate.nw       = d.networth;
        if (d.offense)    provUpdate.off      = d.offense;
        if (d.defense)    provUpdate.def      = d.defense;
        if (d.be)         provUpdate.be       = d.be;
        if (d.race)       provUpdate.race     = d.race;
        if (d.peasants)   provUpdate.peons = d.peasants;
        if (d.thieves)    provUpdate.thieves  = Number(d.thieves) || 0;
        if (d.wizards)    provUpdate.wizards  = Number(d.wizards) || 0;
        if (d.spells)     provUpdate.good_spells = d.spells;
        if (parsed.kd)    provUpdate.kd_code  = parsed.kd;
        provUpdate.updated_at = new Date().toISOString();

        const { error: provErr } = await sb.from("provinces")
          .update(provUpdate)
          .eq("name", prov);
        if (provErr) logger.error(`[PROVINCE UPDATE ERROR] ${provErr.message}`);
        else logger.info(`[PROVINCE UPDATED] ${prov}`);
      }
    } else if (parsed.type === "science") {
      const sci = parsed.data.science || {};
      const effects = parsed.data.science_effects || {};
      const { error: sciErr } = await sb.from("intel_science").upsert({
        province: prov,
        kd_code: parsed.kd,
        alchemy:     parseInt(sci.alchemy     || 0),
        artisan:     parseInt(sci.artisan     || 0),
        bookkeeping: parseInt(sci.bookkeeping || 0),
        channeling:  parseInt(sci.channeling  || 0),
        crime:       parseInt(sci.crime       || 0),
        finesse:     parseInt(sci.finesse     || 0),
        heroism:     parseInt(sci.heroism     || 0),
        housing:     parseInt(sci.housing     || 0),
        production:  parseInt(sci.production  || 0),
        resilience:  parseInt(sci.resilience  || 0),
        shielding:   parseInt(sci.shielding   || 0),
        siege:       parseInt(sci.siege       || 0),
        strategy:    parseInt(sci.strategy    || 0),
        tactics:     parseInt(sci.tactics     || 0),
        tools:       parseInt(sci.tools       || 0),
        valor:       parseInt(sci.valor       || 0),
        arcana:      parseInt(sci.arcana || 0) + parseInt(sci.cunning || 0) + parseInt(sci.sorcery || 0),
        science_effects: Object.keys(effects).length > 0 ? effects : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "province" });
      if (sciErr) console.error("[SCIENCE SAVE ERROR]", sciErr.message);
    } else if (parsed.type === "som") {
      console.log("[MIL DATA]", JSON.stringify(parsed.data).substring(0, 200));
      const { error: milErr } = await sb.from("intel_military").upsert({
        province: prov, kd_code: parsed.kd, ...parsed.data,
        armies: parsed.data.armies || [],
        updated_at: new Date().toISOString()
      }, { onConflict: "province,kd_code" });
      if (milErr) console.error("[MIL SAVE ERROR]", milErr.message);
    } else if (parsed.type === "survey") {
      console.log("[SURVEY DATA]", JSON.stringify(parsed.data).substring(0, 200));
      const { error: bldErr } = await sb.from("intel_buildings").upsert({
        province: prov, kd_code: parsed.kd, buildings: parsed.data.buildings,
        updated_at: new Date().toISOString()
      }, { onConflict: "province,kd_code" });
      if (bldErr) console.error("[BUILDINGS SAVE ERROR]", bldErr.message);

    } else if (parsed.type === "kingdom") {
      const { error: kdErr } = await sb.from("kingdoms").upsert({
        kd_id: parsed.data.kd_code,
        kd_name: parsed.data.kingdom_name,
        kd_type: "enemy",
        is_active: true,
        updated_at: new Date().toISOString()
      }, { onConflict: "kd_id" });

      if (kdErr) {
        logger.error(`[KINGDOM SAVE ERROR] ${kdErr.message}`);
      } else {
        logger.info(`[KINGDOM SAVED] ${parsed.data.kingdom_name}`);
      }
    }

    if (parsed.type === "state") {
      const { error: stateErr } = await sb.from("intel_state").upsert({
        province: prov, kd_code: parsed.kd, ...parsed.data,
        updated_at: new Date().toISOString()
      }, { onConflict: "province,kd_code" });
      if (stateErr) logger.error(`[STATE SAVE ERROR] ${stateErr.message}`);
      else logger.info(`[STATE SAVED] ${prov}`);
    }
    if (parsed.type === "news") {
      const events = parsed.data.events || [];
      if (events.length > 0) {
        const { error: newsErr } = await sb.from("news_events").insert(
          events.map(e => ({ ...e, kd_code: parsed.kd }))
        );
        if (newsErr) logger.error(`[NEWS SAVE ERROR] ${newsErr.message}`);
        else logger.info(`[NEWS SAVED] ${events.length} events for ${prov}`);
      }
    }
    if (parsed.type === "intel-site") {
      const sb = supabaseService.getClient();
      if (!sb) return;
      try {
        const siteData = parsed.data;
        const tab = parsed.tab || "overview";
        const kd = parsed.kd || "unknown";

        // Check if this is CSV data
        const csvRaw = parsed.data && parsed.data.rows && parsed.data.rows[0] && parsed.data.rows[0].raw ? parsed.data.rows[0].raw : null;
        const isCSV = parsed.source === "intel-site-csv" || (csvRaw && csvRaw.startsWith("#,Name"));
        logger.info(`[INTEL-SITE DEBUG] source=${parsed.source} isCSV=${isCSV} csvRaw_start=${csvRaw ? csvRaw.substring(0,30) : "null"}`);
        if (isCSV) {
          // Parse CSV directly from the raw text field
          const csvText = csvRaw || (siteData && siteData.rows && siteData.rows[0] ? siteData.rows[0].raw : "");

          // Proper CSV parser that handles quoted fields
          function parseCSVLine(line) {
            const result = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const ch = line[i];
              if (ch === '"') {
                inQuotes = !inQuotes;
              } else if (ch === "," && !inQuotes) {
                result.push(current.trim());
                current = "";
              } else {
                current += ch;
              }
            }
            result.push(current.trim());
            return result;
          }

          const csvLines = csvText.split("\n").map(l => l.trim()).filter(Boolean);
          if (csvLines.length > 1) {
            const headers = parseCSVLine(csvLines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9%]/g, "_").replace(/_+/g, "_"));
            for (let ci = 1; ci < csvLines.length; ci++) {
              const vals = parseCSVLine(csvLines[ci]);
              if (vals.length < 3) continue;
              const row = {};
              headers.forEach((h, idx) => { row[h] = (vals[idx] || "").trim(); });
              if (!row.name) continue;

              const parseNum = (v) => {
                if (!v) return null;
                const s = v.toString().trim().replace(/,/g, "");
                const km = s.match(/^([\d.]+)([km]?)$/i);
                if (!km) return parseFloat(s) || null;
                const num = parseFloat(km[1]);
                if (km[2].toLowerCase() === "k") return Math.round(num * 1000);
                if (km[2].toLowerCase() === "m") return Math.round(num * 1000000);
                return num || null;
              };

              const upsertData = {
                province: row.name,
                kd_code: kd,
                updated_at: new Date().toISOString()
              };
              // CSV header mapping (normalized: lowercase, special chars -> _)
              // #->_, Name->name, Combo->combo, Honor->honor, Acres->acres
              // NW->nw, Pop%->pop_, Army->army, Off->off, Def->def
              // DefHome->defhome, Peons->peons, rTpa->rtpa, oTpa->otpa
              // dTpa->dtpa, rWpa->rwpa, oWpa->owpa, dWpa->dwpa
              // Stlth->stlth, Mana->mana, MAP->map, BE->be, Wages->wages
              // OPs ToDo->ops_todo, GoodSpells->goodspells, BadSpells->badspells
              // Unique Cooldown->unique_cooldown, IntelAge->intelage
              if (row.combo) {
                upsertData.combo = row.combo;
                const decoded = decodeCombo(row.combo);
                if (decoded.race && !upsertData.race) upsertData.race = decoded.race;
                if (decoded.personality && !upsertData.personality) upsertData.personality = decoded.personality;
              }
              if (row.honor) upsertData.honor = row.honor;
              if (row.acres) upsertData.land = parseNum(row.acres);
              if (row.nw) upsertData.networth = String(parseNum(row.nw) || row.nw);
              if (row.off) upsertData.offense = String(parseNum(row.off) || row.off);
              if (row.def) upsertData.defense = String(parseNum(row.def) || row.def);
              if (row.defhome) upsertData.defense = String(parseNum(row.defhome) || row.defhome);
              if (row.be) upsertData.be = String(row.be).replace('%','').trim();
              if (row.rtpa) upsertData.tpa = parseFloat(row.rtpa) || null;
              if (row.otpa) upsertData.tpa = parseFloat(row.otpa) || null;
              if (row.rwpa) upsertData.wpa = parseFloat(row.rwpa) || null;
              if (row.owpa) upsertData.wpa = parseFloat(row.owpa) || null;
              if (row.map) upsertData.map = row.map.trim();
              if (row.pop_) upsertData.be = row.pop_.replace('%','').trim();
              if (row.peons) upsertData.peasants = parseNum(row.peons);
              if (row.goodspells) upsertData.good_spells = row.goodspells;
              if (row.badspells) upsertData.bad_spells = row.badspells;
              if (row.stlth) upsertData.stealth = row.stlth;
              if (row.mana) upsertData.mana = row.mana;
              if (row.wages) upsertData.wages = row.wages;
              if (row.ops_todo) upsertData.ops_status = row.ops_todo;
              if (row.intelage) upsertData.intel_age = row.intelage;
              if (row.unique_cooldown) upsertData.unique_cooldown = row.unique_cooldown;
              if (row.race) upsertData.race = row.race;
              if (row.personality) upsertData.personality = row.personality;
              if (row.ruler) upsertData.ruler = row.ruler;
              if (row.note) upsertData.note = row.note;
              if (row.discord) upsertData.discord = row.discord;
              if (row.location) upsertData.location = row.location;
              if (row.requests) upsertData.requests = row.requests;

              const { error: csvErr } = await sb.from("intel_throne").upsert(upsertData, { onConflict: "province,kd_code" });
              if (csvErr) logger.error(`[CSV SAVE ERROR] ${row.name}: ${csvErr.message}`);
              else logger.info(`[CSV SAVED] ${row.name} (${kd})`);
            }
          }
          return;
        }

        // ARMIES TAB handler
        if (tab === "armies") {
          const rawText = siteData && siteData.rows && siteData.rows[0] ? siteData.rows[0].raw : text;
          logger.info(`[ARMIES RAW] ${(rawText || text).substring(0, 500)}`);
          const armyProvs = parseArmies(rawText || text);
          logger.info(`[ARMIES] Parsed ${armyProvs.length} provinces from armies tab for ${kd}`);
          for (const ap of armyProvs) {
            // Upsert ambush into intel_throne (works with any kd including unknown)
            const { error: armyErr } = await sb.from("intel_throne").upsert({
              province: ap.name,
              kd_code: kd,
              ambush: ap.ambush,
              updated_at: new Date().toISOString()
            }, { onConflict: "province,kd_code" });
            if (armyErr) logger.error(`[ARMIES SAVE ERROR] ${ap.name}: ${armyErr.message}`);
            else logger.info(`[ARMIES SAVED] ${ap.name} ambush=${ap.ambush}`);
          }
          return;
        }

        // Check if we got raw text (table not parsed) vs structured rows
        const isRaw = siteData && siteData.rows && siteData.rows[0] && siteData.rows[0].raw;

        if (isRaw) {
          const rawText = siteData.rows[0].raw;
          const lines = rawText.split("\n").map(l => l.trim()).filter(Boolean);

          // Detect if this is tab-separated table data from scrapeTable()
          const isTabular = lines.some(l => l.includes("\t") && l.split("\t").length > 5);

          if (isTabular) {
            // Find header row — contains "Name" or "Ruler" column
            let headerIdx = -1;
            let headers = [];
            for (let i = 0; i < lines.length; i++) {
              const cols = lines[i].split("\t").map(c => c.trim().toLowerCase());
              if (cols.includes("name") || cols.includes("ruler")) {
                headerIdx = i;
                headers = cols;
                break;
              }
            }

            if (headerIdx === -1) {
              logger.info(`[INTEL-SITE] No header row found in tabular data`);
            } else {
              // Build header map handling empty columns (double-tab issue)
              const headerMap = {};
              headers.forEach((h, idx) => { if (h.trim()) headerMap[h.trim()] = idx; });
              logger.info(`[HEADER MAP] ${JSON.stringify(headerMap)}`);
              const nameIdx = headerMap["name"] !== undefined ? headerMap["name"] : headerMap["ruler"];
              const parseNum = (v) => {
                if (!v) return null;
                const s = v.toString().replace(/,/g,"").trim();
                const m = s.match(/^([\d.]+)([km]?)$/i);
                if (!m) return parseFloat(s) || null;
                const n = parseFloat(m[1]);
                if (m[2].toLowerCase()==="k") return Math.round(n*1000);
                if (m[2].toLowerCase()==="m") return Math.round(n*1000000);
                return Math.round(n) || null;
              };

              const h = headerMap;
              const colMap = {
                name: h["name"] !== undefined ? h["name"] : -1,
                ruler: h["ruler"] !== undefined ? h["ruler"] : -1,
                race: h["race"] !== undefined ? h["race"] : -1,
                personality: h["personality"] !== undefined ? h["personality"] : (h["persona..."] !== undefined ? h["persona..."] : -1),
                combo: h["combo"] !== undefined ? h["combo"] : -1,
                honor: h["honor"] !== undefined ? h["honor"] : (h["hon..."] !== undefined ? h["hon..."] : -1),
                acres: h["acres"] !== undefined ? h["acres"] : (h["acr..."] !== undefined ? h["acr..."] : -1),
                nw: h["nw"] !== undefined ? h["nw"] : -1,
                nwpa: h["nwpa"] !== undefined ? h["nwpa"] : (h["nw..."] !== undefined ? h["nw..."] : -1),
                pop: h["pop%"] !== undefined ? h["pop%"] : (h["po..."] !== undefined ? h["po..."] : -1),
                off: h["off"] !== undefined ? h["off"] : -1,
                def: h["def"] !== undefined ? h["def"] : -1,
                defhome: h["defhome"] !== undefined ? h["defhome"] : (h["defho..."] !== undefined ? h["defho..."] : -1),
                peons: h["peons"] !== undefined ? h["peons"] : (h["peo..."] !== undefined ? h["peo..."] : -1),
                rtpa: h["rtpa"] !== undefined ? h["rtpa"] : -1,
                otpa: h["otpa"] !== undefined ? h["otpa"] : -1,
                rwpa: h["rwpa"] !== undefined ? h["rwpa"] : (h["rw..."] !== undefined ? h["rw..."] : -1),
                owpa: h["owpa"] !== undefined ? h["owpa"] : (h["ow..."] !== undefined ? h["ow..."] : -1),
                stlth: h["stlth"] !== undefined ? h["stlth"] : -1,
                mana: h["mana"] !== undefined ? h["mana"] : (h["ma..."] !== undefined ? h["ma..."] : -1),
                map: h["map"] !== undefined ? h["map"] : -1,
                be: h["be"] !== undefined ? h["be"] : -1,
                wages: h["wages"] !== undefined ? h["wages"] : (h["wag..."] !== undefined ? h["wag..."] : -1),
                goodspells: h["goodspells"] !== undefined ? h["goodspells"] : -1,
                badspells: h["badspells"] !== undefined ? h["badspells"] : -1,
                intelage: h["intelage"] !== undefined ? h["intelage"] : -1,
              };

              const get = (row, key) => {
                const idx = colMap[key];
                return idx !== -1 && idx < row.length ? row[idx].trim() : null;
              };

              let saved = 0;
              logger.info(`[TABULAR LINES] total=${lines.length} headerIdx=${headerIdx} nameIdx=${nameIdx}`);
              if (lines.length > headerIdx + 1) logger.info(`[FIRST DATA ROW] ${JSON.stringify(lines[headerIdx+1].split("\t"))}`);
              for (let i = headerIdx + 1; i < lines.length; i++) {
                const row = lines[i].split("\t").map(c => c.trim());
                const name = get(row, "name") || get(row, "ruler");
                if (!name || name.length < 2) continue;
                // Skip if name looks like a header or nav item
                if (["id","kd","name","ruler","race","personality","combo"].includes(name.toLowerCase())) continue;

                const upsertData = {
                  province: name,
                  kd_code: kd,
                  updated_at: new Date().toISOString()
                };

                const race = get(row, "race"); if (race) upsertData.race = race;
                const pers = get(row, "personality"); if (pers) upsertData.personality = pers;
                const combo = get(row, "combo");
                if (combo) {
                  upsertData.combo = combo;
                  const decoded = decodeCombo(combo);
                  if (decoded.race) upsertData.race = decoded.race;
                  if (decoded.personality) upsertData.personality = decoded.personality;
                }
                const honor = get(row, "honor"); if (honor) upsertData.honor = honor;
                const acres = get(row, "acres"); if (acres) upsertData.land = parseNum(acres);
                const nw = get(row, "nw"); if (nw) upsertData.networth = String(parseNum(nw) || nw);
                const nwpa = get(row, "nwpa"); if (nwpa) upsertData.nwpa = nwpa;
                const off = get(row, "off"); if (off) upsertData.offense = String(parseNum(off) || off);
                const def = get(row, "def"); if (def) upsertData.defense = String(parseNum(def) || def);
                const defhome = get(row, "defhome"); if (defhome) upsertData.defense = String(parseNum(defhome) || defhome);
                const peons = get(row, "peons"); if (peons) upsertData.peasants = parseNum(peons);
                const rtpa = get(row, "rtpa"); if (rtpa) upsertData.tpa = parseFloat(rtpa) || null;
                const otpa = get(row, "otpa"); if (otpa) upsertData.tpa = parseFloat(otpa) || null;
                const rwpa = get(row, "rwpa"); if (rwpa) upsertData.wpa = parseFloat(rwpa) || null;
                const stlth = get(row, "stlth"); if (stlth) upsertData.stealth = stlth;
                const mana = get(row, "mana"); if (mana) upsertData.mana = mana;
                const map = get(row, "map"); if (map) upsertData.map = map.trim();
                const be = get(row, "be"); if (be) upsertData.be = be.replace("%","").trim();
                const wages = get(row, "wages"); if (wages) upsertData.wages = wages;
                const goodspells = get(row, "goodspells"); if (goodspells) upsertData.good_spells = goodspells;
                const badspells = get(row, "badspells"); if (badspells) upsertData.bad_spells = badspells;
                const intelage = get(row, "intelage"); if (intelage) upsertData.intel_age = intelage;

                const { error: itErr } = await sb.from("intel_throne").upsert(upsertData, { onConflict: "province,kd_code" });
                if (itErr) logger.error(`[INTEL-SITE TAB SAVE ERROR] ${name}: ${itErr.message}`);
                else { logger.info(`[INTEL-SITE TAB SAVED] ${name} (${kd})`); saved++; }
              }
              logger.info(`[INTEL-SITE] Saved ${saved} provinces from tabular data for ${kd}`);
            }
          } else {
            // Fallback: old line-by-line parser
            const provinces = [];
            let i = 0;
            while (i < lines.length) {
              const line = lines[i];
              if (["KINGDOM","ENEMY","RECENT","KD STATS","OPS","USERS","NEWS","OVERVIEW","WAR","MILITARY","SURVEY","SCIENCE","RESOURCES","ALL","ARMIES","GAINS"].includes(line.toUpperCase())) {
                i++; continue;
              }
              const nextLine = lines[i+1] || "";
              const nextNextLine = lines[i+2] || "";
              const isCombo = /^[A-Z][a-z]{1,2}\/[A-Z][a-z]{1,2}$/.test(nextLine);
              const thisLineIsCombo = /^[A-Z][a-z]{1,2}\/[A-Z][a-z]{1,2}$/.test(line);
              const isHonor = ["Lord","Lady","Knight","King","Queen","Noble","Squire","Prince","Princess","Duke","Duchess","Baron","Baroness","Emperor","Empress"].includes(nextLine) ||
                              ["Lord","Lady","Knight","King","Queen","Noble","Squire","Prince","Princess","Duke","Duchess","Baron","Baroness","Emperor","Empress"].includes(nextNextLine);
              const isKdCode = /^\d+:\d+$/.test(line);
              if (!thisLineIsCombo && !isKdCode && (isCombo || (line.length > 2 && line.length < 50 && /^[A-Z]/.test(line) && isHonor))) {
                provinces.push({ name: line, combo: nextLine });
              }
              i++;
            }
            logger.info(`[INTEL-SITE] Parsed ${provinces.length} provinces from raw text for ${kd}`);
            for (const prov of provinces) {
              if (!prov.name) continue;
              const { error: itErr } = await sb.from("intel_throne").upsert({
                province: prov.name, kd_code: kd, updated_at: new Date().toISOString()
              }, { onConflict: "province,kd_code" });
              if (itErr) logger.error(`[INTEL-SITE RAW SAVE ERROR] ${prov.name}: ${itErr.message}`);
              else logger.info(`[INTEL-SITE RAW SAVED] ${prov.name} (${kd})`);
            }
          }
        } else if (siteData && siteData.rows && siteData.rows.length > 0) {
          // Structured rows
          for (const row of siteData.rows) {
            if (!row.name || !row.name.trim()) continue;
            const province = row.name.trim();
            const upsertData = { province, kd_code: kd, updated_at: new Date().toISOString() };
            if (row.combo) upsertData.combo = row.combo;
            if (row.acres) upsertData.land = parseInt((row.acres||"0").replace(/[^0-9]/g,"")) || null;
            if (row.nw) upsertData.networth = parseInt((row.nw||"0").replace(/[^0-9]/g,"")) || null;
            if (row.off) upsertData.offense = parseInt((row.off||"0").replace(/[^0-9]/g,"")) || null;
            if (row.def) upsertData.defense = parseInt((row.def||"0").replace(/[^0-9]/g,"")) || null;
            if (row.be) upsertData.be = parseInt((row.be||"0").replace(/[^0-9]/g,"")) || null;
            if (row.honor || row.hon) upsertData.honor = row.honor || row.hon;
            if (row.rtpa) upsertData.tpa = parseFloat(row.rtpa) || null;
            if (row.rwpa) upsertData.wpa = parseFloat(row.rwpa) || null;
            const { error: itErr } = await sb.from("intel_throne").upsert(upsertData, { onConflict: "province,kd_code" });
            if (itErr) logger.error(`[INTEL-SITE SAVE ERROR] ${province}: ${itErr.message}`);
            else logger.info(`[INTEL-SITE SAVED] ${province} (${kd})`);
          }
        }
      } catch(siteErr) {
        logger.error(`[INTEL-SITE ERROR] ${siteErr.message}`);
      }
    }
    logger.info(`[INTEL SAVED] ${parsed.type} for ${prov}`);
  } catch(e) {
    logger.error(`[INTEL ERROR] ${e.message}`);
  }
}

function start() {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Utopia Nexus — intel receiver online");
      return;
    }

    if (req.method === "POST" && req.url === "/intel") {
      try {
        let raw;
          try {
            raw = await readBody(req);
          } catch(bodyErr) {
            logger.error(`[INTEL RECEIVER] aborted: ${bodyErr.message}`);
            res.writeHead(200); res.end(JSON.stringify({success:true})); return;
          }
        const params = new URLSearchParams(raw);
        const key = params.get("key") || "";
        const data_simple = params.get("data_simple") || "";
        const url = params.get("url") || "";
        const prov = params.get("prov") || "";
        const kdParam = params.get("kd") || "";

        if (INTEL_KEY && key !== INTEL_KEY) {
          res.writeHead(403); res.end("forbidden"); return;
        }
        if (!data_simple) {
          res.writeHead(400); res.end("missing data"); return;
        }

        console.log("[INTEL URL]", url);
        console.log("[INTEL PROV]", prov);
        console.log("[INTEL KEY]", key);
        console.log("[INTEL DATA SNIPPET]", data_simple.substring(0, 100));
        const tabParam = params.get("tab") || "";
        const parsed = parseIntel(url, prov, data_simple);
        if (kdParam) parsed.kd = kdParam;
        if (tabParam) parsed.tab = tabParam;
        console.log("[INTEL TYPE]", parsed.type);
        await saveIntel(parsed, prov);
        res.writeHead(200); res.end("ok");
      } catch(e) {
        logger.error(`[INTEL RECEIVER] ${e.message}`);
        res.writeHead(500); res.end("error");
      }
      return;
    }

    res.writeHead(404); res.end("not found");
  });

  server.listen(PORT, "0.0.0.0", () => {
    logger.info(`[INTEL RECEIVER] listening on port ${PORT}`);
  });
}

module.exports = { start };

module.exports = { start };
