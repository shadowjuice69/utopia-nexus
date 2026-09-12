const crypto = require('crypto');
const supabaseService = require('./supabase');
const logger = require('./logger');

const INTERVAL_MS = Math.max(500, Number(process.env.SPARTAN_PROCESSOR_INTERVAL_MS || 2000));
const BATCH_SIZE = Math.max(1, Math.min(50, Number(process.env.SPARTAN_PROCESSOR_BATCH_SIZE || 10)));
const WORKER_ID = process.env.RENDER_INSTANCE_ID || `spartan-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;

let timer = null;
let running = false;

function compact(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, v]) => v !== undefined && v !== null));
}

async function loadParsedCapture(sb, flow) {
  if (!flow?.capture_id) return null;
  const { data, error } = await sb
    .from('intel_page_ingest')
    .select('parsed,raw_text,url')
    .eq('payload->>capture_id', flow.capture_id)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) logger.warn(`[SPARTAN PROCESSOR] capture lookup failed: ${error.message}`);
  return data || null;
}

function extractState(flow, capture) {
  const payload = flow?.payload || {};
  const parsed = capture?.parsed || payload?.result?.parsed || payload?.parsedPayload || {};
  const data = parsed?.data || payload?.data || {};
  return compact({
    capture_id: flow.capture_id,
    source: flow.source,
    page_kind: flow.page_kind,
    province_id: flow.province_id,
    kingdom_id: flow.kingdom_id,
    url: capture?.url || payload?.url || null,
    parsed_type: parsed?.type || null,
    parsed_kind: parsed?.kind || null,
    raw_length: parsed?.raw_length || payload?.raw_length || null,
    data,
    raw_text: capture?.raw_text || null,
    processed_at: new Date().toISOString(),
  });
}

async function addEdge(sb, flowId, fromSystem, toSystem, eventType, payload = {}) {
  const { error } = await sb.from('spartan_data_edges').insert({
    flow_id: flowId,
    from_system: fromSystem,
    to_system: toSystem,
    event_type: eventType,
    payload,
  });
  if (error) throw new Error(`spartan_data_edges: ${error.message}`);
}

async function processOne(sb, job) {
  const { data: flow, error: flowError } = await sb
    .from('spartan_data_flow')
    .select('*')
    .eq('flow_id', job.flow_id)
    .maybeSingle();
  if (flowError) throw new Error(`flow lookup: ${flowError.message}`);
  if (!flow) throw new Error(`flow ${job.flow_id} not found`);

  const capture = await loadParsedCapture(sb, flow);
  const state = extractState(flow, capture);
  const projectionKey = flow.province_id || flow.flow_id;
  const { data: existing } = await sb
    .from('spartan_state_projection')
    .select('version')
    .eq('province_id', projectionKey)
    .maybeSingle();
  const version = Number(existing?.version || 0) + 1;

  const { error: projectionError } = await sb
    .from('spartan_state_projection')
    .upsert({
      province_id: projectionKey,
      kingdom_id: flow.kingdom_id || null,
      state,
      version,
      source_flow_id: flow.flow_id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'province_id' });
  if (projectionError) throw new Error(`spartan_state_projection: ${projectionError.message}`);

  await addEdge(sb, flow.flow_id, 'spartan_processing_queue', 'spartan_state_projection', 'projection', {
    queue_id: job.id,
    processor: WORKER_ID,
    version,
    capture_id: flow.capture_id,
  });

  const { error: flowUpdateError } = await sb
    .from('spartan_data_flow')
    .update({
      status: 'processed',
      stage: 'projection',
      current_stage: 'projection',
      processed_at: new Date().toISOString(),
      error: null,
    })
    .eq('flow_id', flow.flow_id);
  if (flowUpdateError) throw new Error(`flow update: ${flowUpdateError.message}`);

  const { error: queueError } = await sb
    .from('spartan_processing_queue')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      locked_at: null,
      error: null,
    })
    .eq('id', job.id);
  if (queueError) throw new Error(`queue complete: ${queueError.message}`);

  return { flowId: flow.flow_id, queueId: job.id, version, pageKind: flow.page_kind };
}

async function failOne(sb, job, error) {
  const attempts = Number(job.attempts || 1);
  const terminal = attempts >= 5;
  const delaySeconds = Math.min(300, Math.pow(2, Math.max(0, attempts - 1)) * 5);
  await sb.from('spartan_processing_queue').update({
    status: terminal ? 'failed' : 'retry',
    available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
    locked_at: null,
    error: { message: error.message, worker: WORKER_ID, attempts },
  }).eq('id', job.id);
  await sb.from('spartan_data_flow').update({
    status: terminal ? 'failed' : 'retry',
    stage: 'processor',
    current_stage: 'processor',
    error: { message: error.message, worker: WORKER_ID, attempts },
  }).eq('flow_id', job.flow_id);
}

async function processBatch() {
  if (running) return;
  const sb = supabaseService.getClient();
  if (!sb) return;
  running = true;
  try {
    const { data: jobs, error } = await sb.rpc('claim_spartan_queue', {
      p_worker: WORKER_ID,
      p_limit: BATCH_SIZE,
    });
    if (error) throw new Error(`claim_spartan_queue: ${error.message}`);
    if (!jobs?.length) return;

    for (const job of jobs) {
      try {
        const result = await processOne(sb, job);
        logger.info(`[SPARTAN PROCESSOR] completed queue=${result.queueId} flow=${result.flowId} page=${result.pageKind || ''} version=${result.version}`);
      } catch (error) {
        logger.error(`[SPARTAN PROCESSOR] queue=${job.id} flow=${job.flow_id} failed: ${error.stack || error.message}`);
        try { await failOne(sb, job, error); } catch (failError) { logger.error(`[SPARTAN PROCESSOR] failure bookkeeping failed: ${failError.message}`); }
      }
    }
  } catch (error) {
    logger.error(`[SPARTAN PROCESSOR LOOP] ${error.stack || error.message}`);
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  if (process.env.SPARTAN_PROCESSOR_ENABLED === 'false') {
    logger.info('[SPARTAN PROCESSOR] disabled by SPARTAN_PROCESSOR_ENABLED=false');
    return;
  }
  logger.info(`[SPARTAN PROCESSOR] starting worker=${WORKER_ID} interval=${INTERVAL_MS}ms batch=${BATCH_SIZE}`);
  processBatch();
  timer = setInterval(processBatch, INTERVAL_MS);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, processBatch, processOne };
