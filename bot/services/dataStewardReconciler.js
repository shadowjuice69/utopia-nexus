const supabaseService = require('./supabase');
const logger = require('./logger');

const ENABLED = String(process.env.DATA_STEWARD_ENABLED || 'true').toLowerCase() !== 'false';
const INTERVAL_MS = Math.max(15000, Number(process.env.DATA_STEWARD_RECONCILE_INTERVAL_MS || 60000));
let running = false;
let timer = null;

const THRONE_FROM_PROVINCE = {
  race: 'race', personality: 'personality', ruler: 'ruler', land: 'acres', networth: 'nw', honor: 'honor',
  offense: 'off', defense: 'def', be: 'be', peasants: 'peons', thieves: 'thieves', wizards: 'wizards',
  tpa: 'r_tpa', wpa: 'r_wpa', map: 'map', wages: 'wages', good_spells: 'good_spells', bad_spells: 'bad_spells',
  intel_age: 'intel_age', ops_status: 'ops_status', generals: 'generals', ambush: 'ambush', nwpa: 'nwpa',
  draft_target: 'draft_target', draft_rate: 'draft_rate', location: 'location', requests: 'requests'
};

// Province-specific intel is valid only when the province actually exists in
// the authoritative roster for the KD assigned to the row. Cross-KD attack/event
// tables are intentionally excluded because their participants may be external.
const PROVINCE_IDENTITY_TABLES = ['intel_throne', 'intel_state', 'intel_military', 'intel_buildings', 'intel_science'];

function clean(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function present(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return clean(v) !== '' && !/^not captured$/i.test(clean(v));
  return true;
}
function same(a, b) { return clean(a).toLowerCase() === clean(b).toLowerCase(); }

async function audit(sb, details) {
  const { error } = await sb.from('nexus_data_steward_audit').insert({
    action: details.action || 'supabase_reconciliation', source_type: details.source_type || 'supabase',
    source_id: details.source_id || null, decision: details.decision || 'auto_reconcile',
    destination_table: details.destination_table || null, destination_dashboard: details.destination_dashboard || 'Dashboard / Steward', details
  });
  if (error) logger.warn(`[DATA STEWARD RECONCILIATION AUDIT] ${error.message}`);
}

async function latestProvinces(sb) {
  const { data, error } = await sb.from('provinces').select('*').order('updated_at', { ascending: false }).limit(5000);
  if (error) throw error;
  const seen = new Set();
  return (data || []).filter(p => {
    const key = `${clean(p.kd_code).toLowerCase()}|${clean(p.name).toLowerCase()}`;
    if (!clean(p.name) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function preserveBeforeRemoval(sb, table, row, canonical, reason) {
  // Preserve the evidence before removing the invalid active row. The Vault is
  // the recovery/review path; the bad row must not remain dashboard-active.
  const payload = {
    ...row,
    __steward_removal: {
      table, reason, observed_kd: clean(row.kd_code), canonical_kd: canonical?.kd_code || null,
      canonical_province_id: canonical?.province_id || null, removed_at: new Date().toISOString()
    }
  };
  const { error } = await sb.from('intel_complete_vault').insert({
    kd_code: clean(row.kd_code) || null,
    province: clean(row.province) || null,
    source: 'data-steward-identity-repair',
    tab: table,
    data_type: `removed-invalid-kd:${table}`,
    raw_text: null,
    payload,
    field_names: Object.keys(row),
    is_current: true
  });
  if (error) logger.warn(`[DATA STEWARD IDENTITY VAULT] ${table}/${row.province}: ${error.message}`);
}

async function historicalIdentityRepair(sb, provinces, stats) {
  // Build an unambiguous province-name -> canonical KD index. If a province is
  // not in the KD on the active row, remove that active row. If it belongs to
  // another canonical KD, the audit records the correct KD; we do not blindly
  // copy/move stale data across kingdoms.
  const canonicalByName = new Map();
  const ambiguousNames = new Set();
  for (const p of provinces) {
    const name = clean(p.name).toLowerCase();
    const kd = clean(p.kd_code);
    if (!name || !kd) continue;
    const existing = canonicalByName.get(name);
    if (existing && !same(existing.kd_code, kd)) ambiguousNames.add(name);
    else if (!existing) canonicalByName.set(name, { kd_code: kd, province_id: p.id });
  }

  for (const table of PROVINCE_IDENTITY_TABLES) {
    const { data: rows, error } = await sb.from(table)
      .select('id,province,kd_code,updated_at')
      .not('province', 'is', null)
      .limit(10000);
    if (error) {
      stats.errors += 1;
      logger.warn(`[DATA STEWARD HISTORICAL IDENTITY] ${table}: ${error.message}`);
      continue;
    }

    for (const row of rows || []) {
      stats.identity_reviewed += 1;
      const name = clean(row.province).toLowerCase();
      const canonical = canonicalByName.get(name);
      if (!canonical || ambiguousNames.has(name)) continue;
      if (!clean(row.kd_code) || same(row.kd_code, canonical.kd_code)) continue;

      const oldKd = clean(row.kd_code);
      await preserveBeforeRemoval(sb, table, row, canonical, 'province does not exist in the KD assigned to the active row');

      const { error: deleteError } = await sb.from(table)
        .delete()
        .eq('id', row.id)
        .eq('kd_code', oldKd);
      if (deleteError) {
        stats.errors += 1;
        logger.warn(`[DATA STEWARD HISTORICAL IDENTITY] ${table}/${row.province}: ${deleteError.message}`);
        continue;
      }

      stats.identity_repaired += 1;
      await audit(sb, {
        action: 'removed_invalid_kd_identity',
        source_type: 'provinces',
        source_id: canonical.province_id,
        decision: 'remove_active_row_not_in_assigned_kd',
        destination_table: table,
        province: row.province,
        old_kd_code: oldKd,
        canonical_kd_code: canonical.kd_code,
        rule: 'Province-specific active intel must exist in the authoritative province roster for its assigned KD. Invalid assignments are removed from the active destination and preserved in the Complete Vault; no automatic cross-KD move is performed.'
      });
      logger.info(`[DATA STEWARD HISTORICAL IDENTITY] removed ${table}: ${row.province} does not belong to ${oldKd}; canonical KD=${canonical.kd_code}`);
    }
  }
}

async function reconcile() {
  if (running || !ENABLED) return { skipped: true };
  const sb = supabaseService.getClient();
  if (!sb) return { skipped: true, reason: 'supabase_disabled' };
  running = true;
  const stats = { reviewed: 0, repaired: 0, fields: 0, age: null, conflicts: 0, errors: 0, identity_reviewed: 0, identity_repaired: 0 };
  try {
    const [{ data: throneRows, error: throneError }, provinces, ageResult] = await Promise.all([
      sb.from('intel_throne').select('*').order('updated_at', { ascending: false }).limit(5000),
      latestProvinces(sb),
      sb.from('age_updates').select('age_number,status,approved_at,created_at,source').eq('status', 'approved').order('approved_at', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle()
    ]);
    if (throneError) throw throneError;

    // Identity cleanup happens first so all later reconciliation respects KD boundaries.
    await historicalIdentityRepair(sb, provinces, stats);

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
      const source = provinceMap.get(`${clean(row.kd_code).toLowerCase()}|${clean(row.province).toLowerCase()}`);
      if (!source) continue;
      const patch = {};
      for (const [target, sourceField] of Object.entries(THRONE_FROM_PROVINCE)) {
        if (!present(row[target]) && present(source[sourceField])) patch[target] = source[sourceField];
      }
      if (!Object.keys(patch).length) continue;
      const { error } = await sb.from('intel_throne').update(patch).eq('id', row.id);
      if (error) { stats.errors += 1; logger.warn(`[DATA STEWARD RECONCILIATION] ${row.province}: ${error.message}`); continue; }
      stats.repaired += 1;
      stats.fields += Object.keys(patch).length;
      await audit(sb, {
        action: 'repaired_missing_fields', source_type: 'provinces', source_id: source.id,
        decision: 'safe_fill_only', destination_table: 'intel_throne', kd_code: row.kd_code,
        province: row.province, fields: Object.keys(patch), values: patch,
        rule: 'Fill only missing/not-captured values from a matching Supabase province record; never overwrite an existing Throne value.'
      });
    }

    if (ageResult?.data?.age_number != null) {
      stats.age = ageResult.data.age_number;
      await audit(sb, {
        action: 'verified_global_game_age', source_type: 'age_updates', source_id: ageResult.data.source || null,
        decision: 'trusted_approved_value', destination_table: 'age_updates', age_number: ageResult.data.age_number,
        approved_at: ageResult.data.approved_at,
        rule: 'Approved global Age is trusted before any dashboard reports Age as Not captured.'
      });
    }
    logger.info(`[DATA STEWARD RECONCILIATION] reviewed=${stats.reviewed} repaired=${stats.repaired} fields=${stats.fields} identity_reviewed=${stats.identity_reviewed} identity_repaired=${stats.identity_repaired} age=${stats.age ?? 'unknown'} conflicts=${stats.conflicts} errors=${stats.errors}`);
    return stats;
  } catch (error) {
    stats.errors += 1;
    logger.error(`[DATA STEWARD RECONCILIATION ERROR] ${error.stack || error.message}`);
    return stats;
  } finally { running = false; }
}

function start() {
  if (!ENABLED || timer) return;
  logger.info(`[DATA STEWARD RECONCILIATION] continuous Supabase cross-source review enabled; interval=${INTERVAL_MS}ms`);
  reconcile().catch(() => {});
  timer = setInterval(() => reconcile().catch(() => {}), INTERVAL_MS);
}

module.exports = { start, reconcile };