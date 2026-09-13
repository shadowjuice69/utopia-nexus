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
async function findProvince(sb, flow, state) {
  const data = state?.data || {};
  const kdCode = String(flow.kingdom_id || data.coordinates || '').trim();
  const provinceName = String(flow.province_id || data.name || '').trim();
  if (!kdCode || !provinceName || provinceName.startsWith('Slot #')) return null;
  const { data: province, error } = await sb.from('provinces').select('id,state_data,kingdom_id').eq('kd_code', kdCode).eq('name', provinceName).limit(1).maybeSingle();
  if (error) throw new Error(`canonical province lookup: ${error.message}`);
  return province || null;
}
async function syncCanonicalProvince(sb, flow, state) {
  if (flow.page_kind !== 'throne') return null;
  const data = state?.data || {};
  const province = await findProvince(sb, flow, state);
  if (!province) {
    logger.warn(`[SPARTAN PROCESSOR] canonical province not found kd=${flow.kingdom_id} province=${flow.province_id}`);
    return null;
  }
  const patch = compact({
    ruler: data.ruler, race: data.race, acres: data.acres, nw: data.nw, off: data.off, def: data.def,
    peons: data.peons, soldiers: data.soldiers, thieves: data.thieves, wizards: data.wizards,
    war_horses: data.war_horses, prisoners: data.prisoners, o_tpa: data.o_tpa, d_tpa: data.d_tpa,
    o_wpa: data.o_wpa, d_wpa: data.d_wpa, be: data.be, good_spells: data.good_spells,
    coordinates: data.coordinates, game_type: data.game_type, updated_at: new Date().toISOString(),
    state_data: { ...(province.state_data || {}), throne: data, throne_captured_at: state.captured_at || state.processed_at || new Date().toISOString() }
  });
  const { error } = await sb.from('provinces').update(patch).eq('id', province.id);
  if (error) throw new Error(`canonical province update: ${error.message}`);
  return { provinceId: province.id, fields: Object.keys(patch) };
}
async function syncSpecializedProvinceData(sb, flow, state) {
  if (!['survey', 'science', 'som', 'magic', 'thievery', 'universal'].includes(flow.page_kind)) return null;
  const province = await findProvince(sb, flow, state);
  if (!province) return null;
  const data = state?.data || {};
  const patch = { updated_at: new Date().toISOString(), state_data: { ...(province.state_data || {}), [flow.page_kind]: data, [`${flow.page_kind}_captured_at`]: state.captured_at || state.processed_at || new Date().toISOString() } };
  if (flow.page_kind === 'survey' && data.buildings && typeof data.buildings === 'object') patch.buildings = data.buildings;
  if (flow.page_kind === 'science' && data.science && typeof data.science === 'object') patch.science = data.science;
  const { error } = await sb.from('provinces').update(patch).eq('id', province.id);
  if (error) throw new Error(`specialized province sync: ${error.message}`);
  return { provinceId: province.id, fields: Object.keys(patch) };
}
async function writeProvinceHistory(sb, flow, state, canonical) {
  if (!canonical?.provinceId || !['throne', 'survey', 'science', 'som', 'magic', 'thievery', 'universal'].includes(flow.page_kind)) return null;
  const data = state?.data || {};
  const numeric = (value) => { const n = Number(value); return Number.isFinite(n) ? n : null; };
  const { data: province, error: lookupError } = await sb.from('provinces').select('kingdom_id').eq('id', canonical.provinceId).maybeSingle();
  if (lookupError) throw new Error(`history province lookup: ${lookupError.message}`);
  const row = compact({
    province_id: canonical.provinceId, kingdom_id: province?.kingdom_id || null,
    observed_at: state.captured_at || state.processed_at || new Date().toISOString(),
    source: flow.source || 'spartan_processor', source_id: flow.source_id || flow.capture_id,
    acres: numeric(data.acres), networth: numeric(data.nw), population: numeric(data.peons), peons: numeric(data.peons),
    soldiers: numeric(data.soldiers), off_specs: numeric(data.off_specs), def_specs: numeric(data.def_specs), elites: numeric(data.elites),
    thieves: numeric(data.thieves), wizards: numeric(data.wizards), prisoners: numeric(data.prisoners), war_horses: numeric(data.war_horses),
    offense: numeric(data.off), defense: numeric(data.def), o_tpa: numeric(data.o_tpa), d_tpa: numeric(data.d_tpa),
    o_wpa: numeric(data.o_wpa), d_wpa: numeric(data.d_wpa), build_efficiency: numeric(data.be), wages: numeric(data.wages),
    raw_state: data, changes: { page_kind: flow.page_kind, capture_id: flow.capture_id }
  });
  const { error } = await sb.from('spartan_province_history').insert(row);
  if (error && !String(error.message).toLowerCase().includes('duplicate')) throw new Error(`province history insert: ${error.message}`);
  return true;
}
async function syncNewsEvents(sb, flow, state) {
  if (flow.page_kind !== 'news') return null;
  const events = Array.isArray(state?.data?.events) ? state.data.events : [];
  if (!events.length) return null;
  const province = await findProvince(sb, flow, state);
  const rows = events.map(event => ({ province_id: province?.id || null, kingdom_id: province?.kingdom_id || null, occurred_at: event.created_at || new Date().toISOString(), event_type: event.event_type || 'news', source: flow.source || 'spartan_processor', source_id: `${flow.capture_id}:${event.created_at || event.raw || ''}`, acres_change: Number.isFinite(Number(event.acres)) ? Number(event.acres) : null, payload: event, raw_text: event.raw || null, created_at: new Date().toISOString() }));
  const { error } = await sb.from('spartan_event_history').upsert(rows, { onConflict: 'source_id' });
  if (error) throw new Error(`news event sync: ${error.message}`);
  return rows.length;
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
  if (flowError) throw new Error(`flow lookup: ${flowError.message}`); if (!flow) throw new Error(`flow ${job.flow_id} not found`);
  const capture = await loadCapture(sb, flow); if (!capture) throw new Error(`capture ${flow.capture_id || ''} not found in Spartan vault`);
  const stewardResult = await stewardSystem.run(flow, capture, job.id, flow.province_id || flow.flow_id);
  if (stewardResult.decision === 'quarantine' || stewardResult.decision === 'fail') { await quarantine(sb, flow, job, stewardResult); return { flowId: flow.flow_id, queueId: job.id, quarantined: true, pageKind: flow.page_kind }; }
  const state = extractState(flow, capture); const projectionKey = flow.province_id || flow.flow_id;
  const { data: existing } = await sb.from('spartan_state_projection').select('version').eq('province_id', projectionKey).maybeSingle();
  const version = Number(existing?.version || 0) + 1;
  const { error: projectionError } = await sb.from('spartan_state_projection').upsert({ province_id: projectionKey, kingdom_id: flow.kingdom_id || null, state, version, source_flow_id: flow.flow_id, updated_at: new Date().toISOString() }, { onConflict: 'province_id' });
  if (projectionError) throw new Error(`spartan_state_projection: ${projectionError.message}`);
  await addEdge(sb, flow.flow_id, 'spartan_processing_queue', 'spartan_state_projection', 'projection', { queue_id: job.id, processor: WORKER_ID, version, capture_id: flow.capture_id });
  const canonical = await syncCanonicalProvince(sb, flow, state); const specialized = await syncSpecializedProvinceData(sb, flow, state);
  await writeProvinceHistory(sb, flow, state, canonical || specialized); await syncNewsEvents(sb, flow, state);
  const integrity = await stewardSystem.run(flow, capture, job.id, projectionKey, { afterProjection: true });
  if (integrity.results.some(item => item.steward === 'integrity' && (item.decision === 'fail' || item.decision === 'quarantine'))) throw new Error(`Integrity Steward failed: ${integrity.results.find(item => item.steward === 'integrity')?.reason || 'unknown'}`);
  const { error: flowUpdateError } = await sb.from('spartan_data_flow').update({ status: 'processed', stage: 'projection', current_stage: 'projection', processed_at: new Date().toISOString(), error: null }).eq('flow_id', flow.flow_id);
  if (flowUpdateError) throw new Error(`flow update: ${flowUpdateError.message}`);
  const { error: queueError } = await sb.from('spartan_processing_queue').update({ status: 'completed', completed_at: new Date().toISOString(), locked_at: null, error: null }).eq('id', job.id);
  if (queueError) throw new Error(`queue complete: ${queueError.message}`);
  return { flowId: flow.flow_id, queueId: job.id, version, pageKind: flow.page_kind };
}
async function failOne(sb, job, error) {
  const attempts = Number(job.attempts || 1); const terminal = attempts >= 5; const delaySeconds = Math.min(300, Math.pow(2, Math.max(0, attempts - 1)) * 5);
  await sb.from('spartan_processing_queue').update({ status: terminal ? 'failed' : 'retry', available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(), locked_at: null, error: { message: error.message, worker: WORKER_ID, attempts } }).eq('id', job.id);
  await sb.from('spartan_data_flow').update({ status: terminal ? 'failed' : 'retry', stage: 'processor', current_stage: 'processor', error: { message: error.message, worker: WORKER_ID, attempts } }).eq('flow_id', job.flow_id);
}
async function processBatch() {
  if (running) return; const sb = supabaseService.getClient(); if (!sb) return; running = true;
  try {
    const { data: jobs, error } = await sb.rpc('claim_spartan_queue', { p_worker: WORKER_ID, p_limit: BATCH_SIZE });
    if (error) throw new Error(`claim_spartan_queue: ${error.message}`); if (!jobs?.length) return;
    for (const job of jobs) { try { const result = await processOne(sb, job); if (!result.quarantined) logger.info(`[SPARTAN PROCESSOR] completed queue=${result.queueId} flow=${result.flowId} page=${result.pageKind || ''} version=${result.version}`); } catch (error) { logger.error(`[SPARTAN PROCESSOR] queue=${job.id} flow=${job.flow_id} failed: ${error.stack || error.message}`); try { await failOne(sb, job, error); } catch (failError) { logger.error(`[SPARTAN PROCESSOR] failure bookkeeping failed: ${failError.message}`); } } }
  } catch (error) { logger.error(`[SPARTAN PROCESSOR LOOP] ${error.stack || error.message}`); } finally { running = false; }
}
function start() { if (timer) return; if (process.env.SPARTAN_PROCESSOR_ENABLED === 'false') { logger.info('[SPARTAN PROCESSOR] disabled by SPARTAN_PROCESSOR_ENABLED=false'); return; } stewardSystem.start(); logger.info(`[SPARTAN PROCESSOR] starting worker=${WORKER_ID} interval=${INTERVAL_MS}ms batch=${BATCH_SIZE}`); processBatch(); timer = setInterval(processBatch, INTERVAL_MS); }
function stop() { if (timer) clearInterval(timer); timer = null; }
module.exports = { start, stop, processBatch, processOne };
