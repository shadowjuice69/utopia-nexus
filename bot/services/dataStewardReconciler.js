const supabaseService = require('./supabase');
const logger = require('./logger');

const ENABLED = String(process.env.DATA_STEWARD_ENABLED || 'true').toLowerCase() !== 'false';
const INTERVAL_MS = Math.max(15000, Number(process.env.DATA_STEWARD_RECONCILE_INTERVAL_MS || 60000));
let running = false;
let timer = null;

const THRONE_FROM_PROVINCE = {
  race: 'race',
  personality: 'personality',
  ruler: 'ruler',
  land: 'acres',
  networth: 'nw',
  honor: 'honor',
  offense: 'off',
  defense: 'def',
  be: 'be',
  peasants: 'peons',
  thieves: 'thieves',
  wizards: 'wizards',
  tpa: 'r_tpa',
  wpa: 'r_wpa',
  map: 'map',
  wages: 'wages',
  good_spells: 'good_spells',
  bad_spells: 'bad_spells',
  intel_age: 'intel_age',
  ops_status: 'ops_status',
  generals: 'generals',
  ambush: 'ambush',
  nwpa: 'nwpa',
  draft_target: 'draft_target',
  draft_rate: 'draft_rate',
  location: 'location',
  requests: 'requests'
};

function clean(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function present(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return clean(v) !== '' && !/^not captured$/i.test(clean(v));
  return true;
}

function same(a, b) {
  return clean(a).toLowerCase() === clean(b).toLowerCase();
}

async function audit(sb, details) {
  const { error } = await sb.from('nexus_data_steward_audit').insert({
    action: details.action || 'supabase_reconciliation',
    source_type: details.source_type || 'supabase',
    source_id: details.source_id || null,
    decision: details.decision || 'auto_reconcile',
    destination_table: details.destination_table || null,
    destination_dashboard: details.destination_dashboard || 'Dashboard / Steward',
    details
  });
  if (error) logger.warn(`[DATA STEWARD RECONCILIATION AUDIT] ${error.message}`);
}

async function latestProvinces(sb) {
  const { data, error } = await sb.from('provinces')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  const seen = new Set();
  return (data || []).filter(p => {
    const key = `${clean(p.kd_code).toLowerCase()}|${clean(p.name).toLowerCase()}`;
    if (!clean(p.name) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function reconcile() {
  if (running || !ENABLED) return { skipped: true };
  const sb = supabaseService.getClient();
  if (!sb) return { skipped: true, reason: 'supabase_disabled' };
  running = true;
  const stats = { reviewed: 0, repaired: 0, fields: 0, age: null, conflicts: 0, errors: 0 };
  try {
    const [{ data: throneRows, error: throneError }, provinces, ageResult] = await Promise.all([
      sb.from('intel_throne').select('*').order('updated_at', { ascending: false }).limit(5000),
      latestProvinces(sb),
      sb.from('age_updates').select('age_number,status,approved_at,created_at,source').eq('status', 'approved').order('approved_at', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle()
    ]);
    if (throneError) throw throneError;

    const provinceMap = new Map();
    for (const p of provinces) provinceMap.set(`${clean(p.kd_code).toLowerCase()}|${clean(p.name).toLowerCase()}`, p);

    const latestThrone = new Map();
    for (const row of throneRows || []) {
      const key = `${clean(row.kd_code).toLowerCase()}|${clean(row.province).toLowerCase()}`;
      if (!clean(row.province) || latestThrone.has(key)) continue;
      latestThrone.set(key, row);
    }

    for (const row of latestThrone.values()) {
      stats.reviewed += 1;
      const key = `${clean(row.kd_code).toLowerCase()}|${clean(row.province).toLowerCase()}`;
      const source = provinceMap.get(key);
      if (!source) continue;

      const patch = {};
      for (const [target, sourceField] of Object.entries(THRONE_FROM_PROVINCE)) {
        if (!present(row[target]) && present(source[sourceField])) patch[target] = source[sourceField];
      }
      if (!Object.keys(patch).length) continue;

      const { error } = await sb.from('intel_throne').update(patch).eq('id', row.id);
      if (error) {
        stats.errors += 1;
        logger.warn(`[DATA STEWARD RECONCILIATION] ${row.province}: ${error.message}`);
        continue;
      }
      stats.repaired += 1;
      stats.fields += Object.keys(patch).length;
      await audit(sb, {
        action: 'repaired_missing_fields',
        source_type: 'provinces',
        source_id: source.id,
        decision: 'safe_fill_only',
        destination_table: 'intel_throne',
        kd_code: row.kd_code,
        province: row.province,
        fields: Object.keys(patch),
        values: patch,
        rule: 'Fill only missing/not-captured values from a matching Supabase province record; never overwrite an existing Throne value.'
      });
    }

    if (ageResult?.data?.age_number != null) {
      stats.age = ageResult.data.age_number;
      await audit(sb, {
        action: 'verified_global_game_age',
        source_type: 'age_updates',
        source_id: ageResult.data.source || null,
        decision: 'trusted_approved_value',
        destination_table: 'age_updates',
        age_number: ageResult.data.age_number,
        approved_at: ageResult.data.approved_at,
        rule: 'Approved global Age is trusted before any dashboard reports Age as Not captured.'
      });
    }

    logger.info(`[DATA STEWARD RECONCILIATION] reviewed=${stats.reviewed} repaired=${stats.repaired} fields=${stats.fields} age=${stats.age ?? 'unknown'} conflicts=${stats.conflicts} errors=${stats.errors}`);
    return stats;
  } catch (error) {
    stats.errors += 1;
    logger.error(`[DATA STEWARD RECONCILIATION ERROR] ${error.stack || error.message}`);
    return stats;
  } finally {
    running = false;
  }
}

function start() {
  if (!ENABLED || timer) return;
  logger.info(`[DATA STEWARD RECONCILIATION] continuous Supabase cross-source review enabled; interval=${INTERVAL_MS}ms`);
  reconcile().catch(() => {});
  timer = setInterval(() => reconcile().catch(() => {}), INTERVAL_MS);
}

module.exports = { start, reconcile };
