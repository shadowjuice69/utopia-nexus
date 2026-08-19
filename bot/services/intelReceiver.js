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
const MY_KD = process.env.MY_KD;

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

function parseIntel(url, prov, text, source="") {
  const result = { url, prov, updated: new Date().toISOString() };
  console.log("[DEBUG URL CHECK]", JSON.stringify(url), url.includes("kingdom_details"));
  const kdMatch = url.match(/kd[=\\/](\\d+:\\d+)/) || text.match(/\\((\\d+:\\d+)\\)/);
  result.kd = kdMatch ? kdMatch[1] : MY_KD;

  if (source === "kingdom-page") {
    result.type = "kingdom-page";
    try {
      const parsed = JSON.parse(text);
      result.data = parsed;
      result.kd = parsed.kd_code || result.kd;
    } catch(e) {
      result.data = { raw: text };
    }
  } else if (url.includes("kingdom_details") || text.includes("The kingdom of") || text.includes("Total Provinces") || text.includes("Total Networth")) {
    result.type = "kingdom";
    result.data = parseKingdom(text);
  } else if (url.includes("throne") || url.includes("SPY_ON_THRONE")) {
    result.type = "throne";
    const lines = text.split("\\n").map(s => s.trim()).filter(Boolean);
    const get = (label) => {
      for (const line of lines) {
        const parts = line.split("\\t");
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
    text.split("\\n").forEach(l => {
      const tabs = l.split("\\t");
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
      const m = l.match(/^(.+?)\\s+([\\d,]+)\\s*\\(([\\d.]+)%\\)/);
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
    text.split("\\n").forEach(l => {
      const tabs = l.split("\\t");
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
    const armies = [];
    let inArmyTable = false;
    const TROOP_NAMES = ["Soldiers","Warriors","Axemen","Berserkers","War Horses","Thieves","Wizards"];

    text.split("\\n").forEach(l => {
      let m;
      if ((m = l.match(/Net Offensive Points at Home[\\s\\t]+(\\d[\\d,]*)/i))) offense = parseInt(m[1].replace(/,/g,""),10);
      if ((m = l.match(/Net Defensive Points at Home[\\s\\t]+(\\d[\\d,]*)/i))) defense = parseInt(m[1].replace(/,/g,""),10);
      if ((m = l.match(/we have (\\d+) generals/i))) generals = parseInt(m[1],10);
      if (l.includes("Standing Army")) { inArmyTable = true; return; }
      if (inArmyTable) {
        const armyMatches = [...l.matchAll(/\\(([\\d.]+) days left\\)/gi)];
        if (armyMatches.length > 0) {
          armyMatches.forEach(am => armies.push({ return_days: parseFloat(am[1]), troops: {} }));
          return;
        }
      }
      if (inArmyTable) {
        if (l.includes("Military Training") || l.includes("Science Book")) { inArmyTable = false; return; }
        for (const name of TROOP_NAMES) {
          if (l.trim().startsWith(name)) {
            const cols = l.split(/\\t+|\\s{2,}/).map(c => c.trim()).filter(Boolean);
            if (cols.length >= 2) {
              const key = name.toLowerCase().replace(" ","_");
              const home = parseInt((cols[1]||"0").replace(/,/g,"").replace("-","0")) || 0;
              troops[key] = home;
              armies.forEach((army, i) => {
                const val = parseInt((cols[i+2]||"0").replace(/,/g,"").replace("-","0")) || 0;
                army.troops[key] = val;
              });
            }
            break;
          }
        }
        if (l.trim().startsWith("Generals")) {
          const cols = l.split(/\\t+|\\s{2,}/).map(c => c.trim()).filter(Boolean);
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
        tpa: Number(String(parsed.data.thieves || parsed.data.troops?.thieves || "").match(/([\d.]+)\s*tpa/i)?.[1] || 0),
        wpa: Number(String(parsed.data.wizards || parsed.data.troops?.wizards || "").match(/([\d.]+)\s*wpa/i)?.[1] || 0),
        updated_at: new Date().toISOString()
      }, { onConflict: "province,kd_code" });
      if (error) { logger.error(`[THRONE SAVE ERROR] ${error.message}`); return; }
      logger.info(`[THRONE RESULT] data=${JSON.stringify(data)} error=${JSON.stringify(error)}`);
      logger.info(`[THRONE SAVED] ${prov}`);
      const myKd = process.env.MY_KD;
      if (parsed.kd === myKd) {
        const d = parsed.data;
        const provUpdate = {};
        if (d.land) provUpdate.acres = d.land;
        if (d.networth) provUpdate.nw = d.networth;
        if (d.offense) provUpdate.off = d.offense;
        if (d.defense) provUpdate.def = d.defense;
        if (d.be) provUpdate.be = d.be;
        if (d.race) provUpdate.race = d.race;
        if (d.peasants) provUpdate.peons = d.peasants;
        if (d.thieves) provUpdate.thieves = Number(d.thieves) || 0;
        if (d.wizards) provUpdate.wizards = Number(d.wizards) || 0;
        if (d.spells) provUpdate.good_spells = d.spells;
        if (parsed.kd) provUpdate.kd_code = parsed.kd;
        provUpdate.updated_at = new Date().toISOString();
        const { error: provErr } = await sb.from("provinces").update(provUpdate).eq("name", prov);
        if (provErr) logger.error(`[PROVINCE UPDATE ERROR] ${provErr.message}`);
        else logger.info(`[PROVINCE UPDATED] ${prov}`);
      }
    } else if (parsed.type === "science") {
      const sci = parsed.data.science || {};
      const effects = parsed.data.science_effects || {};
      const { error: sciErr } = await sb.from("intel_science").upsert({
        province: prov,
        kd_code: parsed.kd,
        alchemy: parseInt(sci.alchemy || 0), artisan: parseInt(sci.artisan || 0), bookkeeping: parseInt(sci.bookkeeping || 0), channeling: parseInt(sci.channeling || 0), crime: parseInt(sci.crime || 0), finesse: parseInt(sci.finesse || 0), heroism: parseInt(sci.heroism || 0), housing: parseInt(sci.housing || 0), production: parseInt(sci.production || 0), resilience: parseInt(sci.resilience || 0), sorcery: parseInt(sci.sorcery || 0), strategy: parseInt(sci.strategy || 0), tactics: parseInt(sci.tactics || 0), tools: parseInt(sci.tools || 0), valor: parseInt(sci.valor || 0), siege: parseInt(sci.siege || 0), shielding: parseInt(sci.shielding || 0), cunning: parseInt(sci.cunning || 0), arcana: parseInt(sci.arcana || 0), updated_at: new Date().toISOString()
      }, { onConflict: "province,kd_code" });
      if (sciErr) logger.error(`[SCIENCE SAVE ERROR] ${sciErr.message}`);
    } else if (parsed.type === "survey") {
      const { error } = await sb.from("intel_buildings").upsert({ province: prov, kd_code: parsed.kd, buildings: parsed.data.buildings || {}, updated_at: new Date().toISOString() }, { onConflict: "province,kd_code" });
      if (error) logger.error(`[SURVEY SAVE ERROR] ${error.message}`);
    } else if (parsed.type === "som") {
      const { error } = await sb.from("intel_military").upsert({ province: prov, kd_code: parsed.kd, offense: parsed.data.offense, defense: parsed.data.defense, generals: parsed.data.generals, troops: parsed.data.troops, armies: parsed.data.armies, updated_at: new Date().toISOString() }, { onConflict: "province,kd_code" });
      if (error) logger.error(`[SOM SAVE ERROR] ${error.message}`);
    } else if (parsed.type === "state") {
      const { error } = await sb.from("provinces").update({ state_data: parsed.data, updated_at: new Date().toISOString() }).eq("name", prov);
      if (error) logger.error(`[STATE SAVE ERROR] ${error.message}`);
    } else if (parsed.type === "news") {
      for (const event of (parsed.data.events || [])) {
        const { error } = await sb.from("news_events").insert({ kd_code: parsed.kd, province: prov, event_type: event.type || "news", event_text: event.text || event.raw || "", event_time: event.time || new Date().toISOString() });
        if (error) logger.error(`[NEWS SAVE ERROR] ${error.message}`);
      }
    } else if (parsed.type === "kingdom") {
      const { error } = await sb.from("kingdoms").upsert({ kd_code: parsed.kd, data: parsed.data, updated_at: new Date().toISOString() }, { onConflict: "kd_code" });
      if (error) logger.error(`[KINGDOM SAVE ERROR] ${error.message}`);
    } else if (parsed.type === "kingdom-page") {
      const { error } = await sb.from("kingdoms").upsert({ kd_code: parsed.kd, data: parsed.data, updated_at: new Date().toISOString() }, { onConflict: "kd_code" });
      if (error) logger.error(`[KINGDOM PAGE SAVE ERROR] ${error.message}`);
    } else if (parsed.type === "intel-site") {
      const siteData = parsed.data || {};
      const kd = parsed.kd || MY_KD;
      const tab = parsed.tab || siteData.tab || "overview";
      const isCSV = parsed.source === "intel-site-csv" || (siteData.rows && siteData.rows[0] && siteData.rows[0].raw && (siteData.rows[0].raw.trimStart().startsWith("#,Name") || siteData.rows[0].raw.trimStart().startsWith("#%2C")));
      if (isCSV) {
        const csvRaw = siteData.rows && siteData.rows[0] ? siteData.rows[0].raw : "";
        const csvText = csvRaw || "";
        function parseCSVLine(line) {
          const result = []; let current = ""; let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') inQuotes = !inQuotes;
            else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
            else current += ch;
          }
          result.push(current.trim()); return result;
        }
        const csvLines = csvText.split("\\n").map(l => l.trim()).filter(Boolean);
        if (csvLines.length > 1) {
          const headers = parseCSVLine(csvLines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9%]/g, "_").replace(/_+/g, "_"));
          for (let ci = 1; ci < csvLines.length; ci++) {
            const vals = parseCSVLine(csvLines[ci]); if (vals.length < 3) continue;
            const row = {}; headers.forEach((h, idx) => { row[h] = (vals[idx] || "").trim(); }); if (!row.name) continue;
            const parseNum = (v) => { if (!v) return null; const s = v.toString().trim().replace(/,/g, ""); const km = s.match(/^([\d.]+)([km]?)$/i); if (!km) return parseFloat(s) || null; const num = parseFloat(km[1]); if (km[2].toLowerCase() === "k") return Math.round(num * 1000); if (km[2].toLowerCase() === "m") return Math.round(num * 1000000); return num || null; };
            const upsertData = { province: row.name, kd_code: kd, updated_at: new Date().toISOString() };
            if (row.combo) { upsertData.combo = row.combo; const decoded = decodeCombo(row.combo); if (decoded.race) upsertData.race = decoded.race; if (decoded.personality) upsertData.personality = decoded.personality; }
            if (row.honor) upsertData.honor = row.honor; if (row.acres) upsertData.land = parseNum(row.acres); if (row.nw) upsertData.networth = String(parseNum(row.nw) || row.nw); if (row.off) upsertData.offense = String(parseNum(row.off) || row.off); if (row.def) upsertData.defense = String(parseNum(row.def) || row.def); if (row.defhome) upsertData.defense = String(parseNum(row.defhome) || row.defhome); if (row.be) upsertData.be = String(row.be).replace('%','').trim(); if (row.rtpa) upsertData.tpa = parseFloat(row.rtpa) || null; if (row.otpa) upsertData.tpa = parseFloat(row.otpa) || null; if (row.rwpa) upsertData.wpa = parseFloat(row.rwpa) || null; if (row.owpa) upsertData.wpa = parseFloat(row.owpa) || null; if (row.map) upsertData.map = row.map.trim(); if (row.pop_) upsertData.be = row.pop_.replace('%','').trim(); if (row.peons) upsertData.peasants = parseNum(row.peons); if (row.goodspells) upsertData.good_spells = row.goodspells; if (row.badspells) upsertData.bad_spells = row.badspells; if (row.stlth) upsertData.stealth = row.stlth; if (row.mana) upsertData.mana = row.mana; if (row.wages) upsertData.wages = row.wages; if (row.ops_todo) upsertData.ops_status = row.ops_todo; if (row.intelage) upsertData.intel_age = row.intelage; if (row.unique_cooldown) upsertData.unique_cooldown = row.unique_cooldown; if (row.race) upsertData.race = row.race; if (row.personality) upsertData.personality = row.personality; if (row.ruler) upsertData.ruler = row.ruler; if (row.note) upsertData.note = row.note; if (row.discord) upsertData.discord = row.discord; if (row.location) upsertData.location = row.location; if (row.requests) upsertData.requests = row.requests;
            const { error: csvErr } = await sb.from("intel_throne").upsert(upsertData, { onConflict: "province,kd_code" }); if (csvErr) logger.error(`[CSV SAVE ERROR] ${row.name}: ${csvErr.message}`); else logger.info(`[CSV SAVED] ${row.name} (${kd})`);
          }
        }
        return;
      }
      if (tab === "armies") {
        const rawText = siteData && siteData.rows && siteData.rows[0] ? siteData.rows[0].raw : "";
        logger.info(`[ARMIES RAW] ${(rawText || "").substring(0, 500)}`);
        const armyProvs = parseArmies(rawText || "");
        logger.info(`[ARMIES] Parsed ${armyProvs.length} provinces from armies tab for ${kd}`);
        for (const ap of armyProvs) {
          const { error: armyErr } = await sb.from("intel_throne").upsert({ province: ap.name, kd_code: kd, ambush: ap.ambush, updated_at: new Date().toISOString() }, { onConflict: "province,kd_code" });
          if (armyErr) logger.error(`[ARMIES SAVE ERROR] ${ap.name}: ${armyErr.message}`); else logger.info(`[ARMIES SAVED] ${ap.name} ambush=${ap.ambush}`);
        }
        return;
      }
      const isRaw = siteData && siteData.rows && siteData.rows[0] && siteData.rows[0].raw;
      if (isRaw) {
        const rawText = siteData.rows[0].raw;
        const lines = rawText.split("\\n").map(l => l.trim()).filter(Boolean);
        const isCSVFormat = lines.some(l => l.startsWith("#,Name") || l.startsWith("#, Name"));
        if (isCSVFormat) {
          logger.info(`[INTEL-SITE] Raw CSV detected for ${kd}; use CSV handler`);
        } else {
          const provinces = []; let i = 0;
          while (i < lines.length) {
            const line = lines[i], nextLine = lines[i+1] || "", nextNextLine = lines[i+2] || "";
            const isCombo = /^[A-Z][a-z]{1,2}\/[A-Z][a-z]{1,2}$/.test(nextLine);
            const thisLineIsCombo = /^[A-Z][a-z]{1,2}\/[A-Z][a-z]{1,2}$/.test(line);
            const isHonor = ["Lord","Lady","Knight","King","Queen","Noble","Squire","Prince","Princess","Duke","Duchess","Baron","Baroness","Emperor","Empress"].includes(nextLine) || ["Lord","Lady","Knight","King","Queen","Noble","Squire","Prince","Princess","Duke","Duchess","Baron","Baroness","Emperor","Empress"].includes(nextNextLine);
            const isKdCode = /^\d+:\d+$/.test(line);
            if (!["KINGDOM","ENEMY","RECENT","KD STATS","OPS","USERS","NEWS","OVERVIEW","WAR","MILITARY","SURVEY","SCIENCE","RESOURCES","ALL","ARMIES","GAINS"].includes(line.toUpperCase()) && !thisLineIsCombo && !isKdCode && (isCombo || (line.length > 2 && line.length < 50 && /^[A-Z]/.test(line) && isHonor))) provinces.push({ name: line, combo: nextLine });
            i++;
          }
          logger.info(`[INTEL-SITE] Parsed ${provinces.length} provinces from raw text for ${kd}`);
          for (const p of provinces) {
            if (!p.name) continue;
            const decoded = decodeCombo(p.combo);
            const { error } = await sb.from("intel_throne").upsert({ province: p.name, kd_code: kd, combo: p.combo || null, race: decoded.race || null, personality: decoded.personality || null, updated_at: new Date().toISOString() }, { onConflict: "province,kd_code" });
            if (error) logger.error(`[INTEL-SITE RAW SAVE ERROR] ${p.name}: ${error.message}`); else logger.info(`[INTEL-SITE RAW SAVED] ${p.name} race=${decoded.race} (${kd})`);
          }
        }
      } else if (siteData && siteData.rows && siteData.rows.length > 0) {
        for (const row of siteData.rows) {
          if (!row.name || !row.name.trim()) continue;
          const province = row.name.trim();
          const upsertData = { province, kd_code: kd, updated_at: new Date().toISOString() };
          if (row.combo) upsertData.combo = row.combo; if (row.acres) upsertData.land = parseInt((row.acres||"0").replace(/[^0-9]/g,"")) || null; if (row.nw) upsertData.networth = parseInt((row.nw||"0").replace(/[^0-9]/g,"")) || null; if (row.off) upsertData.offense = parseInt((row.off||"0").replace(/[^0-9]/g,"")) || null; if (row.def) upsertData.defense = parseInt((row.def||"0").replace(/[^0-9]/g,"")) || null; if (row.be) upsertData.be = String(parseInt((row.be||"0").replace(/[^0-9]/g,"")) || ""); if (row.honor || row.hon) upsertData.honor = row.honor || row.hon; if (row.rtpa) upsertData.tpa = parseFloat(row.rtpa) || null; if (row.rwpa) upsertData.wpa = parseFloat(row.rwpa) || null;
          const { error } = await sb.from("intel_throne").upsert(upsertData, { onConflict: "province,kd_code" });
          if (error) logger.error(`[INTEL-SITE SAVE ERROR] ${province}: ${error.message}`); else logger.info(`[INTEL-SITE SAVED] ${province} (${kd})`);
        }
      }
    }
    logger.info(`[INTEL SAVED] ${parsed.type} for ${prov}`);
  } catch(e) { logger.error(`[INTEL ERROR] ${e.message}`); }
}

function start() {
  const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

    console.log("[REQUEST]", req.method, req.url);
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Utopia Nexus — intel receiver online");
      return;
    }

    // Utopia's site settings use the Render base URL. Accept both the base
    // path and the explicit /intel endpoint, while keeping one Intel handler.
    if (req.method === "POST" && (req.url === "/" || req.url === "/intel")) {
      const compatibilityPath = req.url === "/";
      if (compatibilityPath) logger.info("[INTEL COMPAT] POST / accepted as /intel");
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
        const source = params.get("source") || "";
        const parsed = parseIntel(url, prov, data_simple, source);
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

    if (req.method === "POST" && req.url === "/ai/ask") {
      try {
        let raw = await readBody(req);
        const params = new URLSearchParams(raw);
        const key = params.get("key") || "";
        const question = params.get("question") || "";
        const context = params.get("context") || "";
        if (INTEL_KEY && key !== INTEL_KEY) { res.writeHead(403); res.end("forbidden"); return; }
        if (!question) { res.writeHead(400); res.end("missing question"); return; }
        const { askOpenRouter } = require("./openrouterService");
        const sb = supabaseService.getClient();
        const contextLines = [];
        if (sb) {
          const { data: settings } = await sb.from("bot_settings").select("key, value");
          const kdName = settings?.find(s => s.key === "kingdom_name")?.value || "Judo";
          const kdCode = settings?.find(s => s.key === "kingdom_code")?.value || "3:2";
          contextLines.push(`KINGDOM: ${kdName} (${kdCode})`);
          const { data: provs } = await sb.from("provinces").select("name, race, personality, play_role, nw, acres, off, def, be, o_tpa, o_wpa").order("nw", { ascending: false }).limit(30);
          if (provs && provs.length > 0) {
            contextLines.push(`KINGDOM MEMBERS (${provs.length}):`);
            for (const p of provs) {
              let line = `  - ${p.name} ${p.race || ""} ${p.personality || ""} (${p.play_role || "?"})`;
              if (p.nw) line += ` NW:${p.nw}`;
              if (p.acres) line += ` Acres:${p.acres}`;
              if (p.off) line += ` Off:${p.off}`;
              if (p.def) line += ` Def:${p.def}`;
              contextLines.push(line);
            }
          }
        }
        const answer = await askOpenRouter(question, `${contextLines.join("\\n")}\\n${context}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ answer }));
      } catch(e) { logger.error(`[AI ASK ERROR] ${e.message}`); res.writeHead(500); res.end(JSON.stringify({error:"AI unavailable"})); }
      return;
    }

    res.writeHead(404); res.end("not found");
  });
  server.listen(PORT, () => console.log(`[INTEL RECEIVER] listening on ${PORT}`));
}

module.exports = { start, parseIntel, saveIntel };
