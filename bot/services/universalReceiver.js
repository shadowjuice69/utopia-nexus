const http = require("http");
const { URLSearchParams } = require("url");
const supabaseService = require("./supabase");
const logger = require("./logger");
const { parseUniversalCapture } = require("../parsers/universalCaptureParser");

const INTEL_KEY = process.env.INTEL_KEY || "NikkoAce";
const PORT = parseInt(process.env.PORT || "10000", 10);
const MY_KD = process.env.MY_KD || null;
const MY_PROV = process.env.MY_PROV || null;

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function decodeRequest(body) {
  const form = new URLSearchParams(String(body || ""));
  const source = form.get("source") || "universal-capture";
  const tab = form.get("tab") || "universal";
  const url = form.get("url") || "";
  const prov = form.get("prov") || null;
  const kd = form.get("kd") || null;
  const captureId = form.get("capture_id") || null;
  const capturedAt = form.get("captured_at") || null;
  const dataSimple = form.get("data_simple") || "{}";

  let payload;
  try {
    payload = JSON.parse(dataSimple);
  } catch {
    payload = { visible_text: dataSimple, raw: dataSimple };
  }

  const subject = payload.subject_identity || {};
  const resolvedKd = subject.kd_code || kd || MY_KD || null;
  const resolvedProv = subject.province || prov || MY_PROV || null;
  const pageUrl = payload.page?.url || url;
  const visibleText = payload.visible_text || payload.text || "";
  const raw = payload.raw || payload.html || "";

  return {
    source,
    tab,
    url: pageUrl,
    prov: resolvedProv,
    kd: resolvedKd,
    capture_id: captureId || payload.capture_id || null,
    captured_at: capturedAt || payload.captured_at || null,
    payload,
    visibleText: String(visibleText),
    raw: String(raw)
  };
}

async function saveRaw(sb, request, parsed) {
  const row = {
    kd_code: request.kd,
    province: request.prov,
    source: request.source,
    tab: request.tab,
    url: request.url,
    data_type: parsed.type || "universal-page",
    raw_text: request.raw || request.visibleText || null,
    parsed: {
      capture_id: request.capture_id,
      captured_at: request.captured_at,
      ...parsed.data,
      _universal: {
        kind: parsed.kind,
        raw_length: parsed.raw_length
      }
    }
  };

  const { error } = await sb.from("intel_page_ingest").insert(row);
  if (error) throw new Error(`intel_page_ingest: ${error.message}`);
}

async function findExisting(sb, table, filters) {
  let query = sb.from(table).select("id").limit(1);
  for (const [key, value] of Object.entries(filters)) {
    if (value == null || value === "") return null;
    query = query.eq(key, value);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`${table} lookup: ${error.message}`);
  return data?.id || null;
}

async function upsertByIdentity(sb, table, filters, data) {
  const id = await findExisting(sb, table, filters);
  if (id) {
    const { error } = await sb.from(table).update(data).eq("id", id);
    if (error) throw new Error(`${table} update: ${error.message}`);
    return id;
  }
  const { data: inserted, error } = await sb.from(table).insert({ ...filters, ...data }).select("id").maybeSingle();
  if (error) throw new Error(`${table} insert: ${error.message}`);
  return inserted?.id || null;
}

async function saveKingdom(sb, request, data) {
  if (!data || !request.kd) return;

  await upsertByIdentity(
    sb,
    "kingdoms",
    { kd_code: request.kd },
    {
      kd_name: data.kingdom_name || data.kd_name || null,
      total_nw: data.total_nw,
      total_land: data.total_land,
      total_provinces: data.total_provinces ?? data.province_count_parsed,
      nw_rank: data.nw_rank,
      land_rank: data.land_rank,
      data
    }
  );

  for (const province of data.provinces || []) {
    await upsertByIdentity(
      sb,
      "provinces",
      { kd_code: request.kd, name: clean(province.name) },
      {
        slot: province.slot == null ? null : String(province.slot),
        race: province.race || null,
        acres: province.land == null ? null : String(province.land),
        nw: province.nw == null ? null : String(province.nw),
        nobility: province.nobility || null,
        gains: province.gains == null ? null : String(province.gains)
      }
    );
  }
}

async function saveStructured(sb, request, parsed) {
  const data = parsed.data || {};
  const province = request.prov;
  const kd = request.kd;

  if (parsed.type === "kingdom") return saveKingdom(sb, request, data);

  if (parsed.type === "throne" && province) {
    await upsertByIdentity(sb, "intel_throne", { kd_code: kd, province }, {
      race: data.race || null,
      ruler: data.ruler || null,
      land: data.land == null ? null : String(data.land),
      networth: data.networth == null ? null : String(data.networth),
      honor: data.honor == null ? null : String(data.honor),
      offense: data.offense == null ? null : String(data.offense),
      defense: data.defense == null ? null : String(data.defense),
      be: data.be == null ? null : String(data.be),
      peasants: data.peasants == null ? null : String(data.peasants),
      troops: data.troops || {},
      spells: data.spells || null,
      thieves: Number(data.thieves || 0),
      wizards: Number(data.wizards || 0),
      tpa: Number(data.tpa || 0),
      wpa: Number(data.wpa || 0),
      good_spells: data.spells || null
    });
    return;
  }

  if (parsed.type === "state" && province) {
    await upsertByIdentity(sb, "intel_state", { kd_code: kd, province }, { ...data });
    return;
  }

  if (parsed.type === "som" && province) {
    await upsertByIdentity(sb, "intel_military", { kd_code: kd, province }, {
      offense: data.offense,
      defense: data.defense,
      generals: data.generals,
      troops: data.troops || {},
      armies: data.armies || []
    });
    return;
  }

  if (parsed.type === "survey" && province && data.buildings) {
    await upsertByIdentity(sb, "intel_buildings", { kd_code: kd, province }, { buildings: data.buildings });
    return;
  }

  if (parsed.type === "science" && province) {
    await upsertByIdentity(sb, "intel_science", { kd_code: kd, province }, {
      ...data.science,
      science_effects: data.science_effects || {}
    });
    return;
  }

  if (parsed.type === "news") {
    for (const event of data.events || []) {
      const row = {
        kd_code: kd,
        source_province: province,
        date: event.date || null,
        attacker_name: event.attacker_name || null,
        attacker_kd: event.attacker_kd || null,
        defender_name: event.defender_name || null,
        defender_kd: event.defender_kd || null,
        acres: event.acres ?? null,
        killed: event.killed ?? null,
        event_type: event.event_type || null,
        event_text: event.event_text || event.raw || null,
        raw: event.raw || null
      };
      const { error } = await sb.from("news_events").insert(row);
      if (error) logger.warn(`[UNIVERSAL NEWS] ${error.message}`);
    }
  }
}

async function handleCapture(request) {
  const parsed = parseUniversalCapture(request.url, request.visibleText);
  const sb = supabaseService.getClient();
  if (!sb) throw new Error("Supabase client unavailable");

  await saveRaw(sb, request, parsed);
  await saveStructured(sb, request, parsed);

  logger.info(`[UNIVERSAL RECEIVER] type=${parsed.type} kind=${parsed.kind} kd=${request.kd || ""} prov=${request.prov || ""} capture=${request.capture_id || ""}`);

  return {
    ok: true,
    capture_id: request.capture_id,
    kd: request.kd,
    province: request.prov,
    type: parsed.type,
    kind: parsed.kind,
    raw_length: parsed.raw_length
  };
}

function start() {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, service: "universal-receiver", version: "1.0.0" }));
      }

      if (req.method !== "POST" || !req.url.startsWith("/intel")) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Not found" }));
      }

      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", async () => {
        try {
          const form = new URLSearchParams(body);
          if (INTEL_KEY && form.get("key") !== INTEL_KEY) {
            res.writeHead(401, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
          }

          const request = decodeRequest(body);
          const result = await handleCapture(request);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (error) {
          logger.error(`[UNIVERSAL RECEIVER ERROR] ${error.stack || error.message}`);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: error.message }));
        }
      });
    } catch (error) {
      logger.error(`[UNIVERSAL HTTP ERROR] ${error.stack || error.message}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: error.message }));
    }
  });

  server.listen(PORT, () => logger.info(`🌐 Universal Receiver listening on ${PORT}`));
  return server;
}

module.exports = { start, decodeRequest, handleCapture };
