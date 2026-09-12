const http = require('http');
const crypto = require('crypto');
const { URLSearchParams } = require('url');
const supabaseService = require('./supabase');
const logger = require('./logger');
const { parseUniversalCapture } = require('../parsers/universalCaptureParser');

const INTEL_KEY = process.env.INTEL_KEY || null;
const PORT = parseInt(process.env.PORT || '10000', 10);
const MY_KD = process.env.MY_KD || null;
const MY_PROV = process.env.MY_PROV || null;

function compact(data) { return Object.fromEntries(Object.entries(data || {}).filter(([, value]) => value !== undefined && value !== null)); }

function decodeRequest(body) {
  const form = new URLSearchParams(String(body || ''));
  const source = form.get('source') || 'universal-capture';
  const tab = form.get('tab') || 'universal';
  const url = form.get('url') || '';
  const prov = form.get('prov') || null;
  const kd = form.get('kd') || null;
  const captureId = form.get('capture_id') || null;
  const capturedAt = form.get('captured_at') || null;
  const dataSimple = form.get('data_simple') || '{}';
  let payload;
  try { payload = JSON.parse(dataSimple); } catch { payload = { visible_text: dataSimple, raw: dataSimple }; }
  const subject = payload.subject_identity || {};
  const pageUrl = payload.page?.url || url;
  const kingdomUrlMatch = pageUrl.match(/\/wol\/game\/kingdom_details\/(\d+)\/(\d+)/i);
  const urlKd = kingdomUrlMatch ? `${kingdomUrlMatch[1]}:${kingdomUrlMatch[2]}` : null;
  return { source, tab, url: pageUrl, prov: subject.province || prov || MY_PROV || null, kd: urlKd || subject.kd_code || kd || MY_KD || null, capture_id: captureId || payload.capture_id || null, captured_at: capturedAt || payload.captured_at || null, payload, visibleText: String(payload.visible_text || payload.text || ''), raw: String(payload.raw || payload.html || '') };
}

function hashPayload(request) {
  return crypto.createHash('sha256').update(JSON.stringify({ payload: request.payload, raw: request.raw, visibleText: request.visibleText })).digest('hex');
}

async function saveFreshCapture(sb, request, parsed) {
  const captureId = request.capture_id || `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const capturedAt = request.captured_at || new Date().toISOString();
  const row = { province_id: request.prov, kingdom_id: request.kd, captured_at: capturedAt, source: request.source, source_id: captureId, page_kind: parsed.kind || parsed.type || request.tab, url: request.url, capture_id: captureId, raw_text: request.raw || request.visibleText || null, raw_payload: request.payload || {}, parsed_payload: compact({ type: parsed.type, kind: parsed.kind, data: parsed.data, raw_length: parsed.raw_length }), content_hash: hashPayload(request) };
  const { error } = await sb.from('spartan_capture_vault').insert(row);
  if (error) throw new Error(`spartan_capture_vault: ${error.message}`);
  return { ...request, capture_id: captureId, captured_at: capturedAt };
}

async function enqueueSpartanFlow(sb, request, parsed) {
  const { data: flow, error: flowError } = await sb.from('spartan_data_flow').insert({ source: request.source, source_id: request.capture_id, capture_id: request.capture_id, province_id: request.prov, kingdom_id: request.kd, page_kind: parsed.kind || parsed.type || request.tab, status: 'received', stage: 'ingest', current_stage: 'ingest', payload: { capture_id: request.capture_id, source: request.source, tab: request.tab, url: request.url, province_id: request.prov, kingdom_id: request.kd, parsed_type: parsed.type, parsed_kind: parsed.kind, raw_length: parsed.raw_length } }).select('id,flow_id').maybeSingle();
  if (flowError) throw new Error(`spartan_data_flow: ${flowError.message}`);
  const { error: edgeError } = await sb.from('spartan_data_edges').insert({ flow_id: flow.flow_id, from_system: 'universal_receiver', to_system: 'spartan_processing_queue', event_type: 'ingest', payload: { capture_id: request.capture_id }, from_node: 'universal_receiver', to_node: 'spartan_processing_queue', edge_type: 'ingest', status: 'completed', metadata: { capture_id: request.capture_id } });
  if (edgeError) throw new Error(`spartan_data_edges: ${edgeError.message}`);
  const { data: queue, error: queueError } = await sb.from('spartan_processing_queue').insert({ flow_id: flow.flow_id, stage: 'spartan_capture', priority: 100, status: 'pending', payload: { capture_id: request.capture_id } }).select('id').maybeSingle();
  if (queueError) throw new Error(`spartan_processing_queue: ${queueError.message}`);
  return { flow, queue };
}

async function handleCapture(request) {
  const parsed = parseUniversalCapture(request.url, request.visibleText, request.raw);
  const sb = supabaseService.getClient();
  if (!sb) throw new Error('Supabase client unavailable');
  const captured = await saveFreshCapture(sb, request, parsed);
  const queued = await enqueueSpartanFlow(sb, captured, parsed);
  logger.info(`[SPARTAN INGEST] capture=${captured.capture_id} type=${parsed.type} kind=${parsed.kind} kd=${captured.kd || ''} prov=${captured.prov || ''} flow=${queued.flow.flow_id} queue=${queued.queue?.id || ''}`);
  return { ok: true, system: 'spartan', capture_id: captured.capture_id, kd: captured.kd, province: captured.prov, type: parsed.type, kind: parsed.kind, raw_length: parsed.raw_length, flow_id: queued.flow.flow_id, queue_id: queued.queue?.id || null };
}

function start() {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, service: 'spartan-universal-receiver', version: '2.0.0' })); }
      if (req.method !== 'POST' || !req.url.startsWith('/intel')) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: false, error: 'Not found' })); }
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const form = new URLSearchParams(body);
          if (INTEL_KEY && form.get('key') !== INTEL_KEY) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: false, error: 'Unauthorized' })); }
          const result = await handleCapture(decodeRequest(body));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (error) {
          logger.error(`[SPARTAN INGEST ERROR] ${error.stack || error.message}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: error.message }));
        }
      });
    } catch (error) {
      logger.error(`[SPARTAN HTTP ERROR] ${error.stack || error.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: error.message }));
    }
  });
  server.listen(PORT, () => logger.info(`🌐 Spartan Universal Receiver listening on ${PORT}`));
  return server;
}

module.exports = { start, decodeRequest, handleCapture };
