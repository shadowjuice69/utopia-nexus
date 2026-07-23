const http = require("http");
const supabaseService = require("./supabase");
const logger = require("./logger");
const { parseThrone } = require("../parsers/throneParser");

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
  const kdMatch = url.match(/kd[=\/](\d+:\d+)/) || text.match(/\((\d+:\d+)\)/);
  result.kd = kdMatch ? kdMatch[1] : MY_KD;

  if (url.includes("throne")) {
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
  } else if (url.includes("survey")) {
    result.type = "survey";
    const buildings = {};
    text.split("\n").forEach(l => {
      const m = l.match(/^(.+?)\s+([\d,]+)\s*\(([\d.]+)%\)/);
      if (m) buildings[m[1].trim()] = { count: parseInt(m[2].replace(/,/g,""),10), pct: parseFloat(m[3]) };
    });
    result.data = { buildings };
  } else if (url.includes("som") || url.includes("military")) {
    result.type = "som";
    let offense = null, defense = null, generals = null;
    text.split("\n").forEach(l => {
      let m;
      if ((m = l.match(/Offense[^\d]*([\d,]+)/i))) offense = parseInt(m[1].replace(/,/g,""),10);
      if ((m = l.match(/Defense[^\d]*([\d,]+)/i))) defense = parseInt(m[1].replace(/,/g,""),10);
      if ((m = l.match(/Generals?[^\d]*(\d)/i))) generals = parseInt(m[1],10);
    });
    result.data = { offense, defense, generals };
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
        thieves: parsed.data.thieves,
        wizards: parsed.data.wizards,
        tpa: parsed.data.tpa,
        wpa: parsed.data.wpa,
        updated_at: new Date().toISOString()
      }, { onConflict: "province,kd_code" });

      if (error) {
        logger.error(`[THRONE SAVE ERROR] ${error.message}`);
        return;
      }

      logger.info(`[THRONE RESULT] data=${JSON.stringify(data)} error=${JSON.stringify(error)}`);
      logger.info(`[THRONE SAVED] ${prov}`);
    } else if (parsed.type === "som") {
      await sb.from("intel_military").upsert({
        province: prov, kd_code: parsed.kd, ...parsed.data,
        updated_at: new Date().toISOString()
      }, { onConflict: "province,kd_code" });
    } else if (parsed.type === "survey") {
      await sb.from("intel_buildings").upsert({
        province: prov, kd_code: parsed.kd, ...parsed.data,
        updated_at: new Date().toISOString()
      }, { onConflict: "province,kd_code" });
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
        const raw = await readBody(req);
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

        const parsed = parseIntel(url, prov, data_simple);
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
