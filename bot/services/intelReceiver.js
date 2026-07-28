const http = require("http");
const supabaseService = require("./supabase");
const logger = require("./logger");
const { parseThrone } = require("../parsers/throneParser");
const { parseKingdom } = require("../parsers/kingdomParser");

const INTEL_KEY = process.env.INTEL_KEY || "";
const PORT = parseInt(process.env.PORT || "3000", 10);
const MY_KD = process.env.MY_KD || "4:9";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => resolve(body));
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
    text.split("\n").forEach(l => {
      let m;
      if ((m = l.match(/Net Offensive Points at Home[\s\t]+([\d,]+)/i))) offense = parseInt(m[1].replace(/,/g,""),10);
      if ((m = l.match(/Net Defensive Points at Home[\s\t]+([\d,]+)/i))) defense = parseInt(m[1].replace(/,/g,""),10);
      if ((m = l.match(/we have (\d+) generals/i))) generals = parseInt(m[1],10);
      const troopNames = ["Soldiers","Warriors","Axemen","Berserkers","War Horses","Thieves","Wizards"];
      for (const name of troopNames) {
        const re = new RegExp("^" + name + "\t([\d,]+)", "i");
        if ((m = l.match(re))) troops[name.toLowerCase().replace(" ","_")] = parseInt(m[1].replace(/,/g,""),10);
      }
    });
    result.data = { offense, defense, generals, troops };
  } else {
    result.type = "unknown";
    result.data = { text };
  }
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

        if (INTEL_KEY && key !== INTEL_KEY) {
          res.writeHead(403); res.end("forbidden"); return;
        }
        if (!prov || !data_simple) {
          res.writeHead(400); res.end("missing data"); return;
        }

        console.log("[INTEL URL]", url);
        console.log("[INTEL PROV]", prov);
        console.log("[INTEL KEY]", key);
        console.log("[INTEL DATA SNIPPET]", data_simple.substring(0, 100));
        const parsed = parseIntel(url, prov, data_simple);
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
