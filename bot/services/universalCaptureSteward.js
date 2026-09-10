const supabaseService = require('./supabase');
const logger = require('./logger');
const dataSteward = require('./dataStewardService');
const { classifyUniversalCapture } = require('./dataStewardUniversalClassifier');

let cursor = 0;
let running = false;
let timer = null;

function toData(row) {
  const parsed = row.parsed && typeof row.parsed === 'object' ? { ...row.parsed } : {};
  parsed.url = parsed.url || row.url || null;
  parsed.text = parsed.text || null;
  parsed.page_kind = parsed.page_kind || row.tab || null;
  parsed.capture_id = parsed.capture_id || row.id;
  parsed.raw_text = row.raw_text || parsed.raw_text || '';
  parsed.raw = parsed.raw || row.raw_text || '';
  parsed._universal = true;
  return parsed;
}

async function processBatch() {
  if (running) return;
  const sb = supabaseService.getClient();
  if (!sb) return;
  running = true;
  try {
    const { data, error } = await sb.from('intel_page_ingest')
      .select('id,kd_code,province,source,tab,url,data_type,raw_text,parsed')
      .gt('id', cursor)
      .order('id', { ascending: true })
      .limit(20);
    if (error) throw error;

    for (const row of data || []) {
      cursor = Math.max(cursor, Number(row.id));
      if (String(row.data_type || '').toLowerCase() !== 'universal-capture') continue;

      const capture = {
        ...row,
        data: toData(row),
        title: row.parsed?.title,
        page_kind: row.parsed?.page_kind || row.tab
      };
      const classification = classifyUniversalCapture(capture);
      const context = {
        source: row.source || 'universal-capture',
        source_id: row.id,
        kd: row.kd_code,
        prov: row.province,
        url: row.url,
        data: {
          ...capture.data,
          _universal_classification: classification
        }
      };

      if (classification.type && classification.confidence >= 75) {
        await dataSteward.inspect({
          ...context,
          type: classification.type
        }, row.province);
      } else {
        // Unknown/ambiguous pages stay safely inside the existing Universal Capture
        // route. The Steward's vault is the lossless landing zone until a trusted
        // classification exists; nothing is discarded just because the page is new.
        await dataSteward.inspect({
          ...context,
          type: 'universal-capture'
        }, row.province);
      }

      await dataSteward.raise({
        source_type: 'universal-capture',
        source: row.source || 'universal-capture',
        source_id: row.id,
        kd_code: row.kd_code,
        province: row.province,
        issue_type: classification.type ? 'universal_capture_classified' : 'universal_capture_unclassified',
        severity: classification.type ? 'low' : 'medium',
        observed_value: {
          page_kind: row.tab,
          url: row.url,
          classification: classification.type,
          confidence: classification.confidence
        },
        raw_excerpt: row.raw_text || '',
        destination_table: classification.type ? (dataSteward.ROUTES[classification.type]?.table || 'intel_complete_vault') : 'intel_complete_vault',
        destination_dashboard: classification.type ? (dataSteward.ROUTES[classification.type]?.dashboard || 'Complete Vault / Universal Capture') : 'Complete Vault / Universal Capture',
        reason: classification.reason,
        recommendation: classification.ambiguous ? 'Keep in the lossless vault and improve classification evidence before trusting a specialized destination.' : 'Classified deterministically and handed to the existing Steward route.',
        confidence: classification.confidence,
        auto_resolved: Boolean(classification.type && classification.confidence >= 75)
      });
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
