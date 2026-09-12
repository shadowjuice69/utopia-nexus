const crypto = require('crypto');
const supabaseService = require('./supabase');
const logger = require('./logger');
const stewardSystem = require('./spartanStewardSystem');

const INTERVAL_MS = Math.max(500, Number(process.env.SPARTAN_PROCESSOR_INTERVAL_MS || 2000));
const BATCH_SIZE = Math.max(1, Math.min(50, Number(process.env.SPARTAN_PROCESSOR_BATCH_SIZE || 10)));
const WORKER_ID = process.env.RENDER_INSTANCE_ID || `spartan-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
let timer = null;
let running = false;
function compact(value) { return Object.fromEntries(Object.entries(value || {}).filter(([, v]) => v !== undefined && v !== null)); }
async function loadCapture(sb, flow) {
  if (!flow?.capture_id) return null;
  const { data, error } = await sb.from('spartan_capture_vault').select('id,capture_id,source,province_id,kingdom_id,page_kind,url,raw_text,raw_payload,parsed_payload,content_hash,captured_at').eq('capture_id', flow.capture_id).order('id', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(`capture lookup: ${error.message}`);
  return data || null;
}
function extractState(flow, capture) {
  const parsed = capture?.parsed_payload || {};
  const data = parsed?.data || {};
  return compact({ capture_id: flow.capture_id, source: flow.source, page_kind: flow.page_kind, province_id: flow.province_id, kingdom_id: flow.kingdom_id, url: capture?.url || null, parsed_type: parsed?.type || null, parsed_kind: parsed?.kind || null, raw_length: parsed?.raw_length || null, data, raw_text: capture?.raw_text || null, raw_payload: capture?.raw_payload || {}, content_hash: capture?.content_hash || null, captured_at: capture?.captured_at || null, processed_at: new Date().toISOString() });
}
async function addEdge(sb, flowId, fromSystem, toSystem, eventType, payload = {}) {
  const { error } = await sb.from('spartan_data_edges').insert({ flow_id: flowId, from_system: fromSystem, to_system: toSystem, event_type: eventType, payload });
  if (error) throw new Error(`spartan_data_edges: ${error.message}`);
}
async function quarantine(sb, flow, job, stewardResult) {
  const capture = await loadCapture(sb, flow);
  await sb.from('spartan_data_quarantine').insert({ capture_id: flow.capture_id, source: flow.source, source_id: flow.source_id, page_kind: flow.page_kind, url: capture?.url || null, province_id: flow.province_id, kingdom_id: flow.kingdom_id, steward: 'spartan-stewards', severity: stewardResult.decision === 'fail' ? 'critical' : 'high', reason: stewardResult.results.map(item => `${item.steward}: ${item.reason}`).join('; '), observed_value: stewardResult.results, raw_payload: capture?.raw_payload || {}, parsed_payload: capture?.parsed_payload || {}, validation_details: { confidence: stewardResult.confidence, results: stewardResult.results }, fingerprint: crypto.createHash('sha256').update(`${flow.flow_id}:${flow.capture_id}`).digest('hex'), status: 'quarantined' });
  await sb.from('spartan_processing_queue').update({ status: 'failed', locked_at: null, error: { steward: stewardResult.results, reason: 'quarantined by fresh Spartan Stewards' } }).eq('id', job.id);
  await sb.from('spartan_data_flow').update({ status: 'failed', stage: 'steward', current_stage: 'steward', error: { reason: 'quarantined by fresh Spartan Stewards', steward_results: stewardResult.results } }).eq('flow_id', flow.flow_id);
}
async function processOne(sb, job) {
  const { data: flow, error: flowError } = await sb.from('spartan_data_flow').select('*').eq('flow_id', job.flow_id).maybeSingle();
  if (flowError) throw new Error(`flow lookup: ${flowError.message}`);
  if (!flow) throw new Error(`flow ${job.flow_id} not found`);
  const capture = await loadCapture(sb, flow);
  if (!capture) throw new Error(`capture ${flow.capture_id || ''} not found in Spartan vault`);
  const stewardResult = await stewardSystem.run(flow, capture, job.id, flow.province_id || flow.flow_id);
  if (stewardResult.decision === 'quarantine' || stewardResult.decision === 'fail') {
    await quarantine(sb, flow, job, stewardResult);
    logger.warn(`[SPARTAN PROCESSOR] quarantined queue=${job.id} flow=${flow.flow_id} capture=${flow.capture_id}`);
    return { flowId: flow.flow_id, queueId: job.id, quarantined: true, pageKind: flow.page_kind };
  }
  const state = extractState(flow, capture);
  const projectionKey = flow.province_id || flow.flow_id;
  const { data: existing } = await sb.from('spartan_state_projection').select('version').eq('province_id', projectionKey).maybeSingle();
  const version = Number(existing?.version || 0) + 1;
  const { error: projectionError } = await sb.from('spartan_state_projection').upsert({ province_id: projectionKey, kingdom_id: flow.kingdom_id || null, state, version, source_flow_id: flow.flow_id, updated_at: new Date().toISOString() }, { onConflict: 'province_id' });
  if (projectionError) throw new Error(`spartan_state_projection: ${projectionError.message}`);
  await addEdge(sb, flow.flow_id, 'spartan_processing_queue', 'spartan_state_projection', 'projection', { queue_id: job.id, processor: WORKER_ID, version, capture_id: flow.capture_id });
  const integrity = await stewardSystem.run(flow, capture, job.id, projectionKey, { afterProjection: true });
  if (integrity.results.some(item => item.steward === 'integrity' && (item.decision === 'fail' || item.decision === 'quarantine'))) throw new Error(`Integrity Steward failed: ${integrity.results.find(item => item.steward === 'integrity')?.reason || 'unknown'}`);
  const { error: flowUpdateError } = await sb.from('spartan_data_flow').update({ status: 'processed', stage: 'projection', current_stage: 'projection', processed_at: new Date().toISOString(), error: null }).eq('flow_id', flow.flow_id);
  if (flowUpdateError) throw new Error(`flow update: ${flowUpdateError.message}`);
  const { error: queueError } = await sb.from('spartan_processing_queue').update({ status: 'completed', completed_at: new Date().toISOString(), locked_at: null, error: null }).eq('id', job.id);
  if (queueError) throw new Error(`queue complete: ${queueError.message}`);
  return { flowId: flow.flow_id, queueId: job.id, version, pageKind: flow.page_kind };
}
async function failOne(sb, job, error) {
  const attempts = Number(job.attempts || 1);
  const terminal = attempts >= 5;
  const delaySeconds = Math.min(300, Math.pow(2, Math.max(0, attempts - 1)) * 5);
  await sb.from('spartan_processing_queue').update({ status: terminal ? 'failed' : 'retry', available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(), locked_at: null, error: { message: error.message, worker: WORKER_ID, attempts } }).eq('id', job.id);
  await sb.from('spartan_data_flow').update({ status: terminal ? 'failed' : 'retry', stage: 'processor', current_stage: 'processor', error: { message: error.message, worker: WORKER_ID, attempts } }).eq('flow_id', job.flow_id);
}
async function processBatch() {
  if (running) return;
  const sb = supabaseService.getClient();
  if (!sb) return;
  running = true;
  try {
    const { data: jobs, error } = await sb.rpc('claim_spartan_queue', { p_worker: WORKER_ID, p_limit: BATCH_SIZE });
    if (error) throw new Error(`claim_spartan_queue: ${error.message}`);
    if (!jobs?.length) return;
    for (const job of jobs) {
      try {
        const result = await processOne(sb, job);
        if (!result.quarantined) logger.info(`[SPARTAN PROCESSOR] completed queue=${result.queueId} flow=${result.flowId} page=${result.pageKind || ''} version=${result.version}`);
      } catch (error) {
        logger.error(`[SPARTAN PROCESSOR] queue=${job.id} flow=${job.flow_id} failed: ${error.stack || error.message}`);
        try { await failOne(sb, job, error); } catch (failError) { logger.error(`[SPARTAN PROCESSOR] failure bookkeeping failed: ${failError.message}`); }
      }
    }
  } catch (error) { logger.error(`[SPARTAN PROCESSOR LOOP] ${error.stack || error.message}`); }
  finally { running = false; }
}
function start() {
  if (timer) return;
  if (process.env.SPARTAN_PROCESSOR_ENABLED === 'false') { logger.info('[SPARTAN PROCESSOR] disabled by SPARTAN_PROCESSOR_ENABLED=false'); return; }
  stewardSystem.start();
  logger.info(`[SPARTAN PROCESSOR] starting worker=${WORKER_ID} interval=${INTERVAL_MS}ms batch=${BATCH_SIZE}`);
  processBatch();
  timer = setInterval(processBatch, INTERVAL_MS);
}
function stop() { if (timer) clearInterval(timer); timer = null; }
module.exports = { start, stop, processBatch, processOne };
