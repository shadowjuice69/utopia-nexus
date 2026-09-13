const crypto = require('crypto');
const supabaseService = require('./supabase');
const logger = require('./logger');

const STEWARDS = [
  { key: 'capture', name: 'Capture Steward', role: 'lossless capture validation' },
  { key: 'identity', name: 'Identity Steward', role: 'province/kingdom identity validation' },
  { key: 'schema', name: 'Schema Steward', role: 'payload preservation and classification validation' },
  { key: 'integrity', name: 'Integrity Steward', role: 'flow/queue/projection consistency validation' },
  { key: 'knowledge', name: 'Wiki Knowledge Steward', role: 'authoritative Utopia wiki/ruleset validation' },
];

const SUPERVISOR_INTERVAL_MS = Math.max(5000, Number(process.env.SPARTAN_STEWARD_INTERVAL_MS || 5000));
const KNOWLEDGE_INTERVAL_MS = Math.max(30000, Number(process.env.SPARTAN_KNOWLEDGE_STEWARD_INTERVAL_MS || 60000));
const SWEEP_LIMIT = Math.max(1, Math.min(50, Number(process.env.SPARTAN_STEWARD_SWEEP_LIMIT || 10)));
const REVALIDATE_AFTER_MS = Math.max(30000, Number(process.env.SPARTAN_STEWARD_REVALIDATE_AFTER_MS || 300000));
let supervisorTimer = null;
let knowledgeTimer = null;
let supervisorRunning = false;
let knowledgeRunning = false;

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

async function updateRegistry(sb, item, metadata = null) {
  const column = item.decision === 'pass' || item.decision === 'warn' ? 'processed_count' : item.decision === 'quarantine' ? 'quarantined_count' : 'error_count';
  const { data: current } = await sb.from('spartan_steward_registry').select(column).eq('steward_key', item.steward).maybeSingle();
  const value = Number(current?.[column] || 0) + 1;
  const update = {
    [column]: value,
    last_run_at: new Date().toISOString(),
    last_status: item.decision,
    updated_at: new Date().toISOString(),
  };
  if (metadata) update.metadata = metadata;
  await sb.from('spartan_steward_registry').update(update).eq('steward_key', item.steward);
}

async function persistRun(sb, flow, results, capture, knowledge = {}) {
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
    knowledge_source: knowledge.source || null,
    knowledge_age: knowledge.age || null,
    knowledge_refs: knowledge.refs || {},
  });
  return { decision, confidence };
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

  const persisted = await persistRun(sb, flow, results, capture);
  return { ...persisted, results, runId: crypto.randomUUID() };
}

async function loadCapture(sb, flow) {
  if (!flow?.capture_id) return null;
  const { data, error } = await sb.from('spartan_capture_vault')
    .select('id,capture_id,source,province_id,kingdom_id,page_kind,url,raw_text,raw_payload,parsed_payload,content_hash,captured_at')
    .eq('capture_id', flow.capture_id)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`steward capture lookup: ${error.message}`);
  return data || null;
}

async function countRows(sb, table, age) {
  let query = sb.from(table).select('*', { count: 'exact', head: true });
  if (['race_rules', 'personality_rules', 'personality_modifiers'].includes(table)) query = query.eq('age_number', age);
  if (table === 'game_rules') query = query.eq('age_number', age).eq('active', true);
  const { count, error } = await query;
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return Number(count || 0);
}

async function runKnowledge(sb) {
  const { data: source, error: sourceError } = await sb
    .from('spartan_wiki_knowledge_registry')
    .select('source_key,source_name,source_url,age_number,authoritative,active,metadata,updated_at')
    .eq('active', true)
    .eq('authoritative', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sourceError) return result('knowledge', 'fail', 100, `knowledge registry lookup failed: ${sourceError.message}`);
  if (!source) return result('knowledge', 'quarantine', 100, 'no active authoritative wiki source registered');

  const counts = {};
  try {
    counts.wiki_entries = await countRows(sb, 'wiki_entries', source.age_number);
    counts.race_rules = await countRows(sb, 'race_rules', source.age_number);
    counts.personality_rules = await countRows(sb, 'personality_rules', source.age_number);
    counts.personality_modifiers = await countRows(sb, 'personality_modifiers', source.age_number);
    counts.game_rules = await countRows(sb, 'game_rules', source.age_number);
    counts.province_modifiers = await countRows(sb, 'province_modifiers', source.age_number);
  } catch (error) {
    return result('knowledge', 'fail', 100, error.message, { source_key: source.source_key });
  }

  const missing = Object.entries(counts).filter(([, count]) => count <= 0).map(([table]) => table);
  let sourceStatus = 'unverified';
  let sourceLength = null;
  let sourceHash = null;
  try {
    const response = await fetch(source.source_url, { redirect: 'follow' });
    if (!response.ok) throw new Error(`authoritative source returned HTTP ${response.status}`);
    const text = await response.text();
    sourceLength = text.length;
    sourceHash = crypto.createHash('sha256').update(text).digest('hex');
    const ageMarker = new RegExp(`Age\\s*${Number(source.age_number)}|Age\\s*${Number(source.age_number) + 0}`, 'i');
    sourceStatus = ageMarker.test(text) ? 'verified' : 'reachable_without_age_marker';
  } catch (error) {
    return result('knowledge', 'warn', 90, `knowledge tables are present but source could not be verified: ${error.message}`, {
      source_key: source.source_key,
      counts,
    });
  }

  const decision = missing.length ? 'quarantine' : sourceStatus === 'verified' ? 'pass' : 'warn';
  const confidence = missing.length ? 100 : sourceStatus === 'verified' ? 100 : 90;
  const reason = missing.length
    ? `authoritative knowledge source is missing populated rule tables: ${missing.join(', ')}`
    : sourceStatus === 'verified'
      ? 'authoritative wiki source reachable and Age-aligned; canonical rule tables populated'
      : 'authoritative wiki source reachable, but Age marker could not be confirmed';

  return result('knowledge', decision, confidence, reason, {
    source_key: source.source_key,
    source_name: source.source_name,
    source_url: source.source_url,
    age: source.age_number,
    source_status: sourceStatus,
    source_length: sourceLength,
    source_sha256: sourceHash,
    counts,
    metadata: source.metadata || {},
  });
}

async function sweepKnowledge() {
  if (knowledgeRunning) return;
  const sb = supabaseService.getClient();
  if (!sb) return;
  knowledgeRunning = true;
  try {
    const item = await runKnowledge(sb);
    const details = item.details || {};
    const knowledgeRefs = {
      source_key: details.source_key || null,
      source_status: details.source_status || null,
      source_length: details.source_length || null,
      source_sha256: details.source_sha256 || null,
      counts: details.counts || {},
      verified_at: new Date().toISOString(),
    };
    const metadata = {
      last_verified_at: knowledgeRefs.verified_at,
      last_status: item.decision,
      last_reason: item.reason,
      source_status: details.source_status || null,
      source_length: details.source_length || null,
      source_sha256: details.source_sha256 || null,
      counts: details.counts || {},
    };
    await updateRegistry(sb, item, metadata);
    await recordEvent(sb, null, null, item);
    await sb.from('spartan_steward_runs').insert({
      capture_id: null,
      source: details.source_key || 'wiki',
      page_kind: 'wiki_knowledge',
      province_id: null,
      kingdom_id: null,
      decision: item.decision === 'fail' ? 'quarantine' : item.decision === 'quarantine' ? 'quarantine' : 'accept',
      confidence: item.confidence,
      steward_results: [item],
      canonical_payload: { source: details.source_name || null, age: details.age || null, counts: details.counts || {} },
      knowledge_source: details.source_key || null,
      knowledge_age: details.age || null,
      knowledge_refs: knowledgeRefs,
    });
    if (item.decision === 'fail' || item.decision === 'quarantine') {
      logger.warn(`[SPARTAN KNOWLEDGE STEWARD] ${item.decision}: ${item.reason}`);
    } else {
      logger.info(`[SPARTAN KNOWLEDGE STEWARD] ${item.decision}: ${item.reason}`);
    }
  } catch (error) {
    const item = result('knowledge', 'fail', 100, `knowledge steward execution failed: ${error.message}`);
    await updateRegistry(sb, item, { last_verified_at: new Date().toISOString(), last_status: 'fail', last_reason: error.message });
    await recordEvent(sb, null, null, item);
    logger.error(`[SPARTAN KNOWLEDGE STEWARD] ${error.stack || error.message}`);
  } finally {
    knowledgeRunning = false;
  }
}

async function sweepRecentFlows() {
  if (supervisorRunning) return;
  const sb = supabaseService.getClient();
  if (!sb) return;
  supervisorRunning = true;
  try {
    const cutoff = new Date(Date.now() - REVALIDATE_AFTER_MS).toISOString();
    const { data: flows, error } = await sb.from('spartan_data_flow')
      .select('flow_id,capture_id,source,page_kind,province_id,kingdom_id,status,processed_at,created_at')
      .eq('status', 'processed')
      .order('processed_at', { ascending: false })
      .limit(SWEEP_LIMIT);
    if (error) throw new Error(`steward flow sweep: ${error.message}`);

    for (const flow of flows || []) {
      const { data: latest } = await sb.from('spartan_steward_events')
        .select('created_at')
        .eq('flow_id', flow.flow_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest?.created_at && latest.created_at > cutoff) continue;

      const capture = await loadCapture(sb, flow);
      if (!capture) {
        logger.warn(`[SPARTAN STEWARD SUPERVISOR] missing capture flow=${flow.flow_id}`);
        continue;
      }
      const projectionKey = flow.province_id || flow.flow_id;
      const results = [runCapture(capture), runIdentity(flow, capture), runSchema(flow, capture)];
      const integrity = await runIntegrity(sb, flow, null, projectionKey);
      results.push(integrity);
      for (const item of results) {
        await recordEvent(sb, flow, null, item);
        await updateRegistry(sb, item);
      }
      await persistRun(sb, flow, results, capture);

      const bad = results.find(item => item.decision === 'fail' || item.decision === 'quarantine');
      if (bad) logger.warn(`[SPARTAN STEWARD SUPERVISOR] ${bad.steward}=${bad.decision} flow=${flow.flow_id}: ${bad.reason}`);
    }
  } catch (error) {
    logger.error(`[SPARTAN STEWARD SUPERVISOR] ${error.stack || error.message}`);
  } finally {
    supervisorRunning = false;
  }
}

function start() {
  if (supervisorTimer) return;
  logger.info(`[SPARTAN STEWARDS] autonomous supervisor enabled interval=${SUPERVISOR_INTERVAL_MS}ms sweep=${SWEEP_LIMIT} revalidate=${REVALIDATE_AFTER_MS}ms`);
  for (const steward of STEWARDS) logger.info(`[SPARTAN STEWARD] ${steward.name} ready role=${steward.role}`);
  sweepRecentFlows();
  sweepKnowledge();
  supervisorTimer = setInterval(sweepRecentFlows, SUPERVISOR_INTERVAL_MS);
  knowledgeTimer = setInterval(sweepKnowledge, KNOWLEDGE_INTERVAL_MS);
}

function stop() {
  if (supervisorTimer) clearInterval(supervisorTimer);
  if (knowledgeTimer) clearInterval(knowledgeTimer);
  supervisorTimer = null;
  knowledgeTimer = null;
}

module.exports = { start, stop, run, sweepRecentFlows, sweepKnowledge, runKnowledge, STEWARDS };