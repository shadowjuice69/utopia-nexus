const crypto = require('crypto');
const supabaseService = require('./supabase');
const logger = require('./logger');

const STEWARDS = [
  { key: 'capture', name: 'Capture Steward', role: 'lossless capture validation' },
  { key: 'identity', name: 'Identity Steward', role: 'province/kingdom identity validation' },
  { key: 'schema', name: 'Schema Steward', role: 'payload preservation and classification validation' },
  { key: 'integrity', name: 'Integrity Steward', role: 'flow/queue/projection consistency validation' },
];

function fieldPaths(value, prefix = '', out = []) {
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    out.push(prefix || '[]');
    value.slice(0, 50).forEach((item, index) => fieldPaths(item, `${prefix}[${index}]`, out));
    return out;
  }
  if (typeof value !== 'object') {
    out.push(prefix || 'value');
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    out.push(path);
    fieldPaths(child, path, out);
  }
  return out;
}

function result(key, decision, confidence, reason, details = {}) {
  return { steward: key, decision, confidence, reason, details };
}

function runCapture(capture) {
  const raw = capture?.raw_payload;
  const parsed = capture?.parsed_payload;
  if (!capture?.capture_id) return result('capture', 'quarantine', 100, 'capture_id missing');
  if (!capture?.source) return result('capture', 'quarantine', 100, 'source missing');
  if (!capture?.page_kind) return result('capture', 'quarantine', 100, 'page_kind missing');
  if (raw === null || raw === undefined) return result('capture', 'quarantine', 100, 'raw_payload missing');
  if (parsed === null || parsed === undefined) return result('capture', 'quarantine', 100, 'parsed_payload missing');
  return result('capture', 'pass', 100, 'lossless capture envelope present', {
    rawType: Array.isArray(raw) ? 'array' : typeof raw,
    parsedType: Array.isArray(parsed) ? 'array' : typeof parsed,
    rawTextLength: String(capture.raw_text || '').length,
  });
}

function runIdentity(flow, capture) {
  const province = flow?.province_id || capture?.province_id || null;
  const kingdom = flow?.kingdom_id || capture?.kingdom_id || null;
  if (!province && !kingdom) {
    return result('identity', 'warn', 95, 'capture has no province or kingdom identity; retained as global page', { scope: 'global' });
  }
  return result('identity', 'pass', 100, 'identity envelope accepted', { province_id: province, kingdom_id: kingdom });
}

function runSchema(flow, capture) {
  const rawPaths = fieldPaths(capture?.raw_payload || {});
  const parsedPaths = fieldPaths(capture?.parsed_payload || {});
  const kind = flow?.page_kind || capture?.page_kind || 'unknown';
  if (kind === 'unknown') return result('schema', 'warn', 90, 'page classification is unknown', { rawFields: rawPaths.length, parsedFields: parsedPaths.length });
  return result('schema', 'pass', 100, 'payload retained without destructive field filtering', {
    page_kind: kind,
    rawFields: rawPaths.length,
    parsedFields: parsedPaths.length,
  });
}

async function runIntegrity(sb, flow, queueId, projectionKey) {
  if (!flow?.flow_id) return result('integrity', 'fail', 100, 'flow_id missing');
  const { data: projection, error } = await sb
    .from('spartan_state_projection')
    .select('province_id,version,source_flow_id,updated_at')
    .eq('province_id', projectionKey)
    .maybeSingle();
  if (error) return result('integrity', 'fail', 100, `projection lookup failed: ${error.message}`);
  if (!projection) return result('integrity', 'fail', 100, 'projection missing after processing');
  if (projection.source_flow_id !== flow.flow_id) return result('integrity', 'fail', 100, 'projection points to different flow', { source_flow_id: projection.source_flow_id });
  const { data: edge, error: edgeError } = await sb
    .from('spartan_data_edges')
    .select('id,event_type,from_system,to_system')
    .eq('flow_id', flow.flow_id)
    .eq('event_type', 'projection')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (edgeError) return result('integrity', 'fail', 100, `edge lookup failed: ${edgeError.message}`);
  if (!edge) return result('integrity', 'fail', 100, 'projection edge missing');
  return result('integrity', 'pass', 100, 'flow, projection and edge are consistent', {
    queue_id: queueId,
    projection_version: projection.version,
    edge_id: edge.id,
  });
}

async function recordEvent(sb, flow, queueId, item) {
  const { error } = await sb.from('spartan_steward_events').insert({
    steward_key: item.steward,
    flow_id: flow?.flow_id || null,
    capture_id: flow?.capture_id || null,
    queue_id: queueId || null,
    decision: item.decision,
    confidence: item.confidence,
    reason: item.reason,
    details: item.details || {},
  });
  if (error) logger.warn(`[SPARTAN STEWARD] event write failed steward=${item.steward}: ${error.message}`);
}

async function updateRegistry(sb, item) {
  const column = item.decision === 'pass' || item.decision === 'warn' ? 'processed_count' : item.decision === 'quarantine' ? 'quarantined_count' : 'error_count';
  const { data: current } = await sb.from('spartan_steward_registry').select(column).eq('steward_key', item.steward).maybeSingle();
  const value = Number(current?.[column] || 0) + 1;
  await sb.from('spartan_steward_registry').update({ [column]: value, last_run_at: new Date().toISOString(), last_status: item.decision, updated_at: new Date().toISOString() }).eq('steward_key', item.steward);
}

async function run(flow, capture, queueId, projectionKey, options = {}) {
  const sb = supabaseService.getClient();
  if (!sb) throw new Error('Supabase client unavailable for Spartan Stewards');
  const results = [runCapture(capture), runIdentity(flow, capture), runSchema(flow, capture)];
  if (options.afterProjection) results.push(await runIntegrity(sb, flow, queueId, projectionKey));

  for (const item of results) {
    await recordEvent(sb, flow, queueId, item);
    await updateRegistry(sb, item);
  }

  const quarantine = results.find(item => item.decision === 'quarantine' || item.decision === 'fail');
  const decision = quarantine ? (quarantine.decision === 'fail' ? 'fail' : 'quarantine') : 'accept';
  const confidence = Math.min(...results.map(item => Number(item.confidence || 0)));

  await sb.from('spartan_steward_runs').insert({
    capture_id: flow?.capture_id || null,
    source: flow?.source || null,
    page_kind: flow?.page_kind || null,
    province_id: flow?.province_id || null,
    kingdom_id: flow?.kingdom_id || null,
    decision: decision === 'fail' ? 'quarantine' : decision,
    confidence,
    steward_results: results,
    canonical_payload: capture?.parsed_payload || capture?.raw_payload || {},
  });

  return { decision, confidence, results, runId: crypto.randomUUID() };
}

function start() {
  logger.info('[SPARTAN STEWARDS] fresh steward system enabled');
  for (const steward of STEWARDS) logger.info(`[SPARTAN STEWARD] ${steward.name} ready role=${steward.role}`);
}

module.exports = { start, run, STEWARDS };
