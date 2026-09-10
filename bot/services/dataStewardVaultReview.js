const supabaseService = require('./supabase');
const logger = require('./logger');
const dataSteward = require('./dataStewardService');
const { classifyUniversalCapture } = require('./dataStewardUniversalClassifier');

const REVIEW_INTERVAL_MS = Number(process.env.DATA_STEWARD_VAULT_REVIEW_INTERVAL_MS || 15 * 60 * 1000);
const BATCH_SIZE = Number(process.env.DATA_STEWARD_VAULT_REVIEW_BATCH || 20);
let timer = null;
let running = false;

function captureFromVault(row) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  const meta = payload.__universal_capture && typeof payload.__universal_capture === 'object'
    ? payload.__universal_capture
    : {};
  return {
    id: row.id,
    kd_code: row.kd_code,
    province: row.province,
    url: row.url,
    tab: row.tab,
    source: row.source || 'universal-capture',
    data_type: row.data_type,
    raw_text: row.raw_text || payload.raw_text || payload.raw || payload.text || '',
    parsed: payload,
    data: payload,
    title: payload.title || payload.page_title,
    page_kind: payload.page_kind || row.tab,
    capture_id: payload.capture_id || meta.ingest_id || row.id
  };
}

async function audit(sb, action, decision, details) {
  const { error } = await sb.from('nexus_data_steward_audit').insert({ action, decision, details });
  if (error) logger.warn(`[DATA STEWARD VAULT AUDIT] ${error.message}`);
}

async function reviewBatch() {
  if (running) return;
  const sb = supabaseService.getClient();
  if (!sb) return;
  running = true;
  try {
    const { data: rows, error } = await sb.from('intel_complete_vault')
      .select('id,kd_code,province,source,tab,url,data_type,raw_text,payload,payload_hash,is_current,received_at')
      .eq('is_current', true)
      .eq('source', 'universal-capture')
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw error;

    let promoted = 0;
    let held = 0;

    for (const row of rows || []) {
      try {
        const capture = captureFromVault(row);
        const classification = classifyUniversalCapture(capture);
        const classified = Boolean(classification.type && classification.confidence >= 75);

        if (!classified) {
          held++;
          await audit(sb, 'vault_review_held', 'unclassified_or_ambiguous', {
            vault_id: row.id,
            payload_hash: row.payload_hash,
            classification,
            url: row.url,
            tab: row.tab
          });
          continue;
        }

        const route = dataSteward.ROUTES[classification.type];
        if (!route || classification.type === 'universal-capture') {
          held++;
          continue;
        }

        await dataSteward.inspect({
          type: classification.type,
          source: 'universal-capture-vault-review',
          source_id: row.id,
          kd: row.kd_code,
          prov: row.province,
          url: row.url,
          data: row.payload || {}
        }, row.province);

        const http = require('http');
        const body = new URLSearchParams({
          key: process.env.INTEL_KEY || '',
          url: row.url || '',
          prov: row.province || '',
          kd: row.kd_code || '',
          tab: row.tab || capture.page_kind || '',
          data_simple: capture.raw_text
        }).toString();

        await new Promise((resolve, reject) => {
          const req = http.request({
            hostname: '127.0.0.1',
            port: Number(process.env.PORT || 3000),
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

        const { error: updateError } = await sb.from('intel_complete_vault')
          .update({ is_current: false })
          .eq('id', row.id)
          .eq('is_current', true);
        if (updateError) throw updateError;

        promoted++;
        await audit(sb, 'vault_capture_promoted', 'routed_to_destination', {
          vault_id: row.id,
          payload_hash: row.payload_hash,
          classification,
          destination_table: route.table,
          destination_dashboard: route.dashboard
        });
        logger.info(`[DATA STEWARD VAULT] promoted vault=${row.id} -> ${classification.type} (${route.table})`);
      } catch (error) {
        held++;
        logger.warn(`[DATA STEWARD VAULT] held vault=${row.id}: ${error.message}`);
      }
    }

    logger.info(`[DATA STEWARD VAULT] reviewed=${(rows || []).length} promoted=${promoted} held=${held}`);
  } catch (error) {
    logger.error(`[DATA STEWARD VAULT ERROR] ${error.stack || error.message}`);
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  logger.info(`[DATA STEWARD VAULT] enabled; interval=${REVIEW_INTERVAL_MS}ms; batch=${BATCH_SIZE}`);
  reviewBatch().catch(() => {});
  timer = setInterval(() => reviewBatch().catch(() => {}), REVIEW_INTERVAL_MS);
}

module.exports = { start, reviewBatch };
