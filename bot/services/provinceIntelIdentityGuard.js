const supabaseService = require('./supabase');
const logger = require('./logger');

const IDENTITY_TYPES = new Set(['throne', 'state', 'som', 'survey', 'science']);
const CACHE_MS = Math.max(15000, Number(process.env.PROVINCE_IDENTITY_CACHE_MS || 60000));
let cache = null;
let loadedAt = 0;
let loading = null;

function norm(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function loadRoster(force = false) {
  const now = Date.now();
  if (!force && cache && now - loadedAt < CACHE_MS) return cache;
  if (loading) return loading;
  loading = (async () => {
    const sb = supabaseService.getClient();
    if (!sb) return null;
    const { data, error } = await sb.from('provinces').select('province_name,kd_code');
    if (error) throw error;
    const byProvince = new Map();
    for (const row of data || []) {
      const name = norm(row.province_name);
      const kd = String(row.kd_code || '').trim();
      if (!name || !kd) continue;
      const existing = byProvince.get(name);
      if (existing && existing !== kd) byProvince.set(name, null);
      else if (!existing) byProvince.set(name, kd);
    }
    cache = byProvince;
    loadedAt = Date.now();
    return cache;
  })().finally(() => { loading = null; });
  return loading;
}

async function validate({ type, province, kd }) {
  if (!IDENTITY_TYPES.has(String(type || '').toLowerCase())) return { checked: false, valid: true, reason: 'not-province-identity-route' };
  const name = norm(province);
  const assignedKd = String(kd || '').trim();
  if (!name || !assignedKd) return { checked: true, valid: false, reason: 'missing-province-or-kd' };
  const roster = await loadRoster();
  if (!roster) return { checked: false, valid: true, reason: 'roster-unavailable' };
  if (!roster.has(name)) return { checked: true, valid: false, reason: 'province-not-in-authoritative-roster', canonical_kd: null };
  const canonicalKd = roster.get(name);
  if (!canonicalKd) return { checked: true, valid: false, reason: 'ambiguous-province-identity', canonical_kd: null };
  return { checked: true, valid: canonicalKd === assignedKd, reason: canonicalKd === assignedKd ? 'authoritative-match' : 'province-belongs-to-different-kd', canonical_kd: canonicalKd };
}

async function preserveRejectedCapture(row, reason, validation) {
  const sb = supabaseService.getClient();
  if (!sb) return null;
  const payload = {
    ...(row.parsed && typeof row.parsed === 'object' ? row.parsed : {}),
    __identity_guard: {
      rejected_at: new Date().toISOString(),
      reason,
      validation,
      ingest_id: row.id
    }
  };
  const raw = row.raw_text || payload.raw_text || payload.raw || payload.text || '';
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(JSON.stringify([row.id, row.url, row.kd_code, row.province, payload])).digest('hex');
  const { data: existing } = await sb.from('intel_complete_vault').select('id').eq('payload_hash', hash).maybeSingle();
  if (existing) return existing;
  const { data, error } = await sb.from('intel_complete_vault').insert({
    kd_code: row.kd_code || null,
    province: row.province || null,
    source: 'universal-capture-identity-guard',
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
  return data;
}

async function guardCapture(row, type) {
  const validation = await validate({ type, province: row.province, kd: row.kd_code });
  if (!validation.checked || validation.valid) return { allowed: true, validation };
  await preserveRejectedCapture(row, validation.reason, validation);
  logger.warn(`[PROVINCE IDENTITY GUARD] rejected type=${type} kd=${row.kd_code || ''} prov=${row.province || ''} canonical_kd=${validation.canonical_kd || 'none'} reason=${validation.reason}`);
  return { allowed: false, validation };
}

function clearCache() { cache = null; loadedAt = 0; }

module.exports = { validate, guardCapture, clearCache, IDENTITY_TYPES };
