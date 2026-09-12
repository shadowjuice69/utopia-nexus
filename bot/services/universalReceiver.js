const http = require("http");
const { URLSearchParams } = require("url");
const supabaseService = require("./supabase");
const logger = require("./logger");
const { parseUniversalCapture } = require("../parsers/universalCaptureParser");

const INTEL_KEY = process.env.INTEL_KEY || null;
const PORT = parseInt(process.env.PORT || "10000", 10);
const MY_KD = process.env.MY_KD || null;
const MY_PROV = process.env.MY_PROV || null;
const SPARTAN_CAPTURE_URL = process.env.SPARTAN_CAPTURE_URL || "https://spartan-vert.vercel.app/api/capture";
const SPARTAN_CAPTURE_KEY = process.env.SPARTAN_CAPTURE_KEY || null;
function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function compact(data) { return Object.fromEntries(Object.entries(data || {}).filter(([, value]) => value !== undefined && value !== null)); }
function decodeRequest(body) {
  const form = new URLSearchParams(String(body || "")); const source = form.get("source") || "universal-capture"; const tab = form.get("tab") || "universal"; const url = form.get("url") || ""; const prov = form.get("prov") || null; const kd = form.get("kd") || null; const captureId = form.get("capture_id") || null; const capturedAt = form.get("captured_at") || null; const dataSimple = form.get("data_simple") || "{}";
  let payload; try { payload = JSON.parse(dataSimple); } catch { payload = { visible_text: dataSimple, raw: dataSimple }; }
  const subject = payload.subject_identity || {}; const pageUrl = payload.page?.url || url;
  const kingdomUrlMatch = pageUrl.match(/\/wol\/game\/kingdom_details\/(\d+)\/(\d+)/i); const urlKd = kingdomUrlMatch ? `${kingdomUrlMatch[1]}:${kingdomUrlMatch[2]}` : null;
  const resolvedKd = urlKd || subject.kd_code || kd || MY_KD || null; const resolvedProv = subject.province || prov || MY_PROV || null;
  return { source, tab, url: pageUrl, prov: resolvedProv, kd: resolvedKd, capture_id: captureId || payload.capture_id || null, captured_at: capturedAt || payload.captured_at || null, payload, visibleText: String(payload.visible_text || payload.text || ""), raw: String(payload.raw || payload.html || "") };
}
async function saveRaw(sb, request, parsed) { const row = { kd_code: request.kd, province: request.prov, source: request.source, tab: request.tab, url: request.url, data_type: parsed.type || "universal-page", raw_text: request.raw || request.visibleText || null, parsed: { capture_id: request.capture_id, captured_at: request.captured_at, ...parsed.data, _universal: { kind: parsed.kind, raw_length: parsed.raw_length } } }; const { error } = await sb.from("intel_page_ingest").insert(row); if (error) throw new Error(`intel_page_ingest: ${error.message}`); }
async function findExisting(sb, table, filters) { let query = sb.from(table).select("id").limit(1); for (const [key, value] of Object.entries(filters)) { if (value == null || value === "") return null; query = query.eq(key, value); } const { data, error } = await query.maybeSingle(); if (error) throw new Error(`${table} lookup: ${error.message}`); return data?.id || null; }
async function upsertByIdentity(sb, table, filters, data) { const payload = compact(data); const id = await findExisting(sb, table, filters); if (id) { const { error } = await sb.from(table).update(payload).eq("id", id); if (error) throw new Error(`${table} update: ${error.message}`); return id; } const { data: inserted, error } = await sb.from(table).insert({ ...filters, ...payload }).select("id").maybeSingle(); if (error) throw new Error(`${table} insert: ${error.message}`); return inserted?.id || null; }
async function saveKingdom(sb, request, data) { if (!data || !request.kd) return; const kingdomKd = data.kd_code || request.kd; await upsertByIdentity(sb, "kingdoms", { kd_code: kingdomKd }, { kd_name: data.kingdom_name || data.kd_name || null, total_nw: data.total_nw, total_land: data.total_land, total_provinces: data.total_provinces ?? data.province_count_parsed, nw_rank: data.nw_rank, land_rank: data.land_rank, data, updated_at: new Date().toISOString() }); for (const province of data.provinces || []) await upsertByIdentity(sb, "provinces", { kd_code: kingdomKd, name: clean(province.name) }, { slot: province.slot == null ? null : String(province.slot), race: province.race || null, acres: province.land == null ? null : String(province.land), nw: province.nw == null ? null : String(province.nw), nobility: province.nobility || null, gains: province.gains == null ? null : String(province.gains), nwpa: province.nwpa == null ? null : String(province.nwpa), updated_at: new Date().toISOString() }); }
async function saveStructured(sb, request, parsed) {
  const data = parsed.data || {}; const province = request.prov; const kd = request.kd; const now = new Date().toISOString();
  if (parsed.type === "kingdom") return saveKingdom(sb, request, data);
  if (parsed.type === "throne" && province) { await upsertByIdentity(sb, "intel_throne", { kd_code: kd, province }, compact({ race: data.race, personality: data.personality, ruler: data.ruler, land: data.acres == null ? data.land : String(data.acres), networth: data.nw == null ? data.networth : String(data.nw), honor: data.honor, offense: data.off == null ? data.offense : String(data.off), defense: data.def == null ? data.defense : String(data.def), be: data.be, mana: data.mana, stealth: data.stlth == null ? data.stealth : data.stlth, peasants: data.peons == null ? data.peasants : String(data.peons), troops: data.troops || compact({ soldiers: data.soldiers, off_specs: data.off_specs, def_specs: data.def_specs, elites: data.elites, war_horses: data.war_horses, prisoners: data.prisoners, mercs: data.mercs, generals: data.generals }), spells: data.spells || null, thieves: data.thieves, wizards: data.wizards, tpa: data.o_tpa == null ? data.tpa : Number(data.o_tpa), wpa: data.o_wpa == null ? data.wpa : Number(data.o_wpa), map: data.map, good_spells: data.good_spells, wages: data.wages, intel_age: data.intel_age, updated_at: now })); return; }
  if (parsed.type === "state" && province) { await upsertByIdentity(sb, "intel_state", { kd_code: kd, province }, { ...data, updated_at: now }); return; }
  if (parsed.type === "som" && province) { await upsertByIdentity(sb, "intel_military", { kd_code: kd, province }, { offense: data.offense, defense: data.defense, generals: data.generals, troops: data.troops || {}, armies: data.armies || [], updated_at: now }); return; }
  if (parsed.type === "survey" && province && data.buildings) { await upsertByIdentity(sb, "intel_buildings", { kd_code: kd, province }, { buildings: data.buildings, updated_at: now }); return; }
  if (parsed.type === "science" && province) { await upsertByIdentity(sb, "intel_science", { kd_code: kd, province }, { ...data.science, science_effects: data.science_effects || {}, updated_at: now }); return; }
  if (parsed.type === "magic" && province) { await upsertByIdentity(sb, "intel_magic", { kd_code: kd, province }, { spell: data.fields?.spell || data.fields?.spell_name || null, target_province: data.fields?.target || data.fields?.target_province || null, result: data.fields?.result || data.fields?.message || null, success: data.fields?.success ? /true|yes|success/i.test(data.fields.success) : null, details: data, raw_text: request.raw || request.visibleText || null, source: request.source, tab: request.tab, url: request.url, capture_id: request.capture_id, captured_at: request.captured_at, updated_at: now }); return; }
  if (parsed.type === "thievery" && province) { await upsertByIdentity(sb, "intel_thievery", { kd_code: kd, province }, { operation: data.fields?.operation || data.fields?.op || null, target_province: data.fields?.target || data.fields?.target_province || null, result: data.fields?.result || data.fields?.message || null, success: data.fields?.success ? /true|yes|success/i.test(data.fields.success) : null, details: data, raw_text: request.raw || request.visibleText || null, source: request.source, tab: request.tab, url: request.url, capture_id: request.capture_id, captured_at: request.captured_at, updated_at: now }); return; }
  if (parsed.type === "news") for (const event of data.events || []) { const row = { kd_code: kd, source_province: province, date: event.date || null, attacker_name: event.attacker_name || null, attacker_kd: event.attacker_kd || null, defender_name: event.defender_name || null, defender_kd: event.defender_kd || null, acres: event.acres ?? null, killed: event.killed ?? null, event_type: event.event_type || null, event_text: event.event_text || event.raw || null, raw: event.raw || null }; const { error } = await sb.from("news_events").insert(row); if (error) logger.warn(`[UNIVERSAL NEWS] ${error.message}`); }
}
async function postToSpartan(request, parsed) {
  if (!SPARTAN_CAPTURE_KEY) {
    logger.warn('[SPARTAN BRIDGE] SPARTAN_CAPTURE_KEY is not configured; local Universal Capture remains active.');
    return { skipped: true };
  }
  const body = JSON.stringify({
    userId: process.env.SPARTAN_CAPTURE_USER_ID || undefined,
    capture: {
      captureId: request.capture_id,
      capturedAt: request.captured_at,
      source: request.source,
      sourceId: request.capture_id,
      pageKind: parsed.kind || parsed.type || request.tab,
      url: request.url,
      provinceId: request.prov,
      kingdomId: request.kd,
      rawText: request.raw || request.visibleText,
      rawPayload: request.payload,
      parsedPayload: parsed,
    }
  });
  const target = new URL(SPARTAN_CAPTURE_URL);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-spartan-capture-key': SPARTAN_CAPTURE_KEY },
      timeout: 30000,
    }, res => {
      let response = '';
      res.on('data', chunk => { response += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve({ ok: true, status: res.statusCode, response });
        else reject(new Error(`Spartan returned ${res.statusCode}: ${response}`));
      });
    });
    req.on('timeout', () => req.destroy(new Error('Spartan bridge timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
async function handleCapture(request) { const parsed = parseUniversalCapture(request.url, request.visibleText, request.raw); const sb = supabaseService.getClient(); if (!sb) throw new Error("Supabase client unavailable"); await saveRaw(sb, request, parsed); await saveStructured(sb, request, parsed); try { await postToSpartan(request, parsed); } catch (error) { logger.warn(`[SPARTAN BRIDGE] capture=${request.capture_id || ''} failed: ${error.message}`); } logger.info(`[UNIVERSAL RECEIVER] type=${parsed.type} kind=${parsed.kind} kd=${request.kd || ""} prov=${request.prov || ""} capture=${request.capture_id || ""} parsed_fields=${Object.keys(parsed.data || {}).length}`); return { ok: true, capture_id: request.capture_id, kd: request.kd, province: request.prov, type: parsed.type, kind: parsed.kind, raw_length: parsed.raw_length }; }
function start() { const server = http.createServer(async (req, res) => { try { if (req.method === "GET" && req.url === "/health") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ ok: true, service: "universal-receiver", version: "1.3.0", spartanBridge: Boolean(SPARTAN_CAPTURE_KEY) })); } if (req.method !== "POST" || !req.url.startsWith("/intel")) { res.writeHead(404, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ ok: false, error: "Not found" })); } let body = ""; req.on("data", chunk => { body += chunk; }); req.on("end", async () => { try { const form = new URLSearchParams(body); if (INTEL_KEY && form.get("key") !== INTEL_KEY) { res.writeHead(401, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ ok: false, error: "Unauthorized" })); } const request = decodeRequest(body); const result = await handleCapture(request); res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(result)); } catch (error) { logger.error(`[UNIVERSAL RECEIVER ERROR] ${error.stack || error.message}`); res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: false, error: error.message })); } }); } catch (error) { logger.error(`[UNIVERSAL HTTP ERROR] ${error.stack || error.message}`); res.writeHead(500, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: false, error: error.message })); } }); server.listen(PORT, () => logger.info(`🌐 Universal Receiver listening on ${PORT}`)); return server; }
module.exports = { start, decodeRequest, handleCapture };
