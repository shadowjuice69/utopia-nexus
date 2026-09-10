const crypto = require('crypto');
const http = require('http');
const supabaseService = require('./supabase');
const logger = require('./logger');
const dataSteward = require('./dataStewardService');
const { classifyUniversalCapture } = require('./dataStewardUniversalClassifier');
const { guardCapture } = require('./provinceIntelIdentityGuard');

const CURSOR_KEY = 'universal_steward_cursor';
const INTERNAL_PORT = Number(process.env.PORT || 3000);
let cursor = 0;
let running = false;
let timer = null;
let cursorLoaded = false;

async function loadCursor() {
  if (cursorLoaded) return;
  cursorLoaded = true;
  const sb = supabaseService.getClient();
  if (!sb) return;
  try {
    const { data } = await sb.from('bot_settings').select('value').eq('key', CURSOR_KEY).limit(1);
    const value = data?.[0]?.value;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) cursor = parsed;
  } catch (error) {
    logger.warn(`[UNIVERSAL STEWARD] cursor load failed: ${error.message}`);
  }
}

async function saveCursor(value) {
  const sb = supabaseService.getClient();
  if (!sb) return;
  try {
    await sb.from('bot_settings').upsert({ key: CURSOR_KEY, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' });
  } catch (error) {
    logger.warn(`[UNIVERSAL STEWARD] cursor save failed: ${error.message}`);
  }
}

function toData(row) {
  const parsed = row.parsed && typeof row.parsed === 'object' ? { ...row.parsed } : {};
  parsed.url = parsed.url || row.url || null;
  parsed.text = parsed.text || '';
  parsed.page_kind = parsed.page_kind || row.tab || null;
  parsed.capture_id = parsed.capture_id || row.id;
  parsed.raw_text = row.raw_text || parsed.raw_text || '';
  parsed.raw = parsed.raw || row.raw_text || '';
  parsed._universal = true;
  return parsed;
}

function routeData(type, data, classification) {
  const route = dataSteward.ROUTES[type];
  if (!route) return { raw: data.raw || '', _universal_classification: classification };
  const allowed = new Set(route.fields || []);
  const selected = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowed.has(key)) selected[key] = value;
  }
  if (allowed.has('raw') && data.raw) selected.raw = data.raw;
  if (allowed.has('raw_text') && data.raw_text) selected.raw_text = data.raw_text;
  if (allowed.has('_universal')) selected._universal = true;
  if (allowed.has('_universal_classification')) selected._universal_classification = classification;
  return selected;
}

async function preserveCapture(row, data, classification, reason = 'unclassified') {
  const sb = supabaseService.getClient();
  if (!sb) return null;
  const payload = {
    ...data,
    __universal_capture: {
      ingest_id: row.id,
      classification,
      preserved_reason: reason,
      preserved_at: new Date().toISOString()
    }
  };
  const raw = row.raw_text || data.raw_text || data.raw || data.text || '';
  const hash = crypto.createHash('sha256').update(JSON.stringify([row.id, row.url, row.kd_code, row.province, payload])).digest('hex');
  const { data: existing, error: lookupError } = await sb.from('intel_complete_vault').select('id').eq('payload_hash', hash).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing;
  const { data: saved, error } = await sb.from('intel_complete_vault').insert({
    kd_code: row.kd_code || null,
    province: row.province || null,
    source: 'universal-capture',
    tab: row.tab || null,
    url: row.url || null,
    data_type: 'universal-capture',
    raw_text: raw,
    payload,
    field_names: Object.keys(payload),
    payload_hash: hash,
    is_current: true
  }).select('id').single();
  if (error) throw error;
  return saved;
}

function postToExistingReceiver(row, data) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      key: process.env.INTEL_KEY || '',
      url: row.url || data.url || '',
      prov: row.province || '',
      kd: row.kd_code || '',
      tab: row.tab || data.page_kind || '',
      data_simple: data.text || data.raw_text || row.raw_text || ''
    }).toString();

    const req = http.request({
      hostname: '127.0.0.1',
      port: INTERNAL_PORT,
      path: '/intel',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    }, res => {
      let response = '';
      res.on('data', chunk => { response += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(response);
        else reject(new Error(`receiver returned ${res.statusCode}: ${response}`));
      });
    });
    req.on('timeout', () => req.destroy(new Error('receiver timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function processBatch() {
  if (running) return;
  const sb = supabaseService.getClient();
  if (!sb) return;
  await loadCursor();
  running = true;
  try {
    const { data: rows, error } = await sb.from('intel_page_ingest')
      .select('id,kd_code,province,source,tab,url,data_type,raw_text,parsed')
      .gt('id', cursor)
      .order('id', { ascending: true })
      .limit(20);
    if (error) throw error;

    for (const row of rows || []) {
      const rowId = Number(row.id);
      if (!Number.isFinite(rowId) || rowId <= cursor) continue;
      if (String(row.data_type || '').toLowerCase() !== 'universal-capture') {
        cursor = rowId;
        await saveCursor(cursor);
        continue;
      }

      const data = toData(row);
      const capture = { ...row, data, title: row.parsed?.title, page_kind: row.parsed?.page_kind || row.tab };
      const classification = classifyUniversalCapture(capture);
      const classified = Boolean(classification.type && classification.confidence >= 75);

      try {
        if (classified) {
          const identityGuard = await guardCapture(row, classification.type);
          if (!identityGuard.allowed) {
            await dataSteward.raise({
              source_type: 'universal-capture', source: row.source || 'universal-capture', source_id: row.id,
              kd_code: row.kd_code, province: row.province, issue_type: 'invalid_province_kd_identity', severity: 'high',
              observed_value: { page_kind: row.tab, url: row.url, classification, validation: identityGuard.validation },
              raw_excerpt: row.raw_text || '',
              destination_table: dataSteward.ROUTES[classification.type]?.table || 'intel_complete_vault',
              destination_dashboard: dataSteward.ROUTES[classification.type]?.dashboard || 'Complete Vault / Universal Capture',
              reason: 'Province/KD identity did not match the authoritative provinces roster; active destination write was blocked.',
              recommendation: 'Keep the capture in the Complete Vault and do not write province intel under the wrong kingdom.',
              confidence: 100, auto_resolved: false
            });
            cursor = rowId;
            await saveCursor(cursor);
            continue;
          }

          await dataSteward.inspect({
            type: classification.type,
            source: row.source || 'universal-capture',
            source_id: row.id,
            kd: row.kd_code,
            prov: row.province,
            url: row.url,
            data: routeData(classification.type, data, classification)
          }, row.province);

          try {
            await postToExistingReceiver(row, data);
          } catch (routeError) {
            await preserveCapture(row, data, classification, 'destination-route-failed');
            await dataSteward.raise({
              source_type: 'universal-capture', source: row.source || 'universal-capture', source_id: row.id,
              kd_code: row.kd_code, province: row.province, issue_type: 'universal_capture_route_failed', severity: 'high',
              observed_value: { page_kind: row.tab, url: row.url, classification }, raw_excerpt: row.raw_text || '',
              destination_table: dataSteward.ROUTES[classification.type]?.table || 'intel_complete_vault',
              destination_dashboard: dataSteward.ROUTES[classification.type]?.dashboard || 'Complete Vault / Universal Capture',
              reason: routeError.message, recommendation: 'Keep the Universal Capture intact and retry routing after the existing receiver is healthy.',
              confidence: classification.confidence, auto_resolved: false
            });
            throw routeError;
          }
        } else {
          await preserveCapture(row, data, classification, 'unclassified-or-ambiguous');
          await dataSteward.inspect({
            type: 'universal-capture', source: row.source || 'universal-capture', source_id: row.id,
            kd: row.kd_code, prov: row.province, url: row.url,
            data: { ...data, _universal_classification: classification }
          }, row.province);
        }

        await dataSteward.raise({
          source_type: 'universal-capture', source: row.source || 'universal-capture', source_id: row.id,
          kd_code: row.kd_code, province: row.province,
          issue_type: classified ? 'universal_capture_classified' : 'universal_capture_unclassified',
          severity: classified ? 'low' : 'medium',
          observed_value: { page_kind: row.tab, url: row.url, classification: classification.type, confidence: classification.confidence },
          raw_excerpt: row.raw_text || '',
          destination_table: classified ? (dataSteward.ROUTES[classification.type]?.table || 'intel_complete_vault') : 'intel_complete_vault',
          destination_dashboard: classified ? (dataSteward.ROUTES[classification.type]?.dashboard || 'Complete Vault / Universal Capture') : 'Complete Vault / Universal Capture',
          reason: classification.reason,
          recommendation: classification.ambiguous ? 'Keep in the lossless vault and improve classification evidence before trusting a specialized destination.' : 'Classified deterministically and handed to the existing receiver destination parser.',
          confidence: classification.confidence,
          auto_resolved: classified
        });

        cursor = rowId;
        await saveCursor(cursor);
      } catch (error) {
        logger.warn(`[UNIVERSAL STEWARD] row=${row.id} held for retry: ${error.message}`);
        break;
      }
    }
  } catch (error) {
    logger.warn(`[UNIVERSAL STEWARD] ${error.message}`);
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  logger.info('[UNIVERSAL STEWARD] lossless universal-capture classifier enabled');
  processBatch().catch(() => {});
  timer = setInterval(() => processBatch().catch(() => {}), 10000);
}

module.exports = { start, processBatch };
