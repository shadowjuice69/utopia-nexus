const supabaseService = require('./supabase');
const permissionService = require('./permissionService');
const logger = require('./logger');
const ACTIVE = 'active';
const BLOCKED = new Set(['suspended', 'revoked']);
function client() { return supabaseService.getClient(); }
async function recordEvent(userId, action, actorType, actorId, reason, metadata = {}) {
  const sb = client(); if (!sb) return;
  const { error } = await sb.from('spartan_access_events').insert({ discord_user_id: String(userId), action, actor_type: actorType, actor_id: actorId ? String(actorId) : null, reason: reason || null, metadata });
  if (error) logger.error(`[SPARTAN ACCESS EVENT] ${error.message}`);
}
async function get(userId) {
  const sb = client(); if (!sb || !userId) return null;
  const { data, error } = await sb.from('spartan_access').select('*').eq('discord_user_id', String(userId)).maybeSingle();
  if (error) throw error; return data || null;
}
async function hasAccess(userId) {
  if (!userId) return false;
  if (permissionService.isOwner(userId)) return true;
  const row = await get(userId); return Boolean(row && row.status === ACTIVE && !BLOCKED.has(row.status));
}
async function register({ userId, username, metadata = {} }) {
  const sb = client(); if (!sb) throw new Error('Spartan access database is unavailable.');
  const uid = String(userId); const existing = await get(uid);
  if (existing?.status === ACTIVE) return existing;
  if (existing && BLOCKED.has(existing.status)) throw new Error(`Spartan access is ${existing.status}. An admin must restore your access.`);
  const now = new Date().toISOString();
  const payload = { discord_user_id: uid, username: username || null, status: ACTIVE, role: permissionService.isOwner(uid) ? 'owner' : permissionService.isAdmin(uid) ? 'admin' : 'member', granted_by: uid, granted_at: now, disabled_by: null, disabled_at: null, reason: null, metadata: { ...(existing?.metadata || {}), ...metadata }, updated_at: now };
  const { data, error } = await sb.from('spartan_access').upsert(payload, { onConflict: 'discord_user_id' }).select('*').single();
  if (error) throw error;
  await recordEvent(uid, existing ? 'restored' : 'registered', 'user', uid, null, metadata); return data;
}
async function setStatus(userId, status, actorId, reason = '', metadata = {}) {
  const sb = client(); if (!sb) throw new Error('Spartan access database is unavailable.');
  const uid = String(userId); const actor = String(actorId || 'system'); const current = await get(uid);
  if (!current) throw new Error('That Discord user has no Spartan registration.');
  const isBot = actor === 'BOT' || actor === 'spartan-bot';
  if (current.role === 'owner' && actor !== current.discord_user_id) throw new Error('The Spartan owner account cannot be disabled.');
  const now = new Date().toISOString(); const disabled = status !== ACTIVE;
  const { data, error } = await sb.from('spartan_access').update({ status, disabled_by: disabled ? actor : null, disabled_at: disabled ? now : null, reason: reason || null, updated_at: now }).eq('discord_user_id', uid).select('*').single();
  if (error) throw error;
  const action = isBot ? 'bot_revoked' : status === ACTIVE ? 'restored' : status;
  await recordEvent(uid, action, isBot ? 'bot' : permissionService.isOwner(actor) ? 'owner' : 'admin', actor, reason, metadata);
  logger.warn(`[SPARTAN ACCESS] ${uid} -> ${status} by ${actor}`); return data;
}
async function grant(userId, actorId, reason = '', metadata = {}) { return setStatus(userId, ACTIVE, actorId, reason, metadata); }
async function suspend(userId, actorId, reason = '', metadata = {}) { return setStatus(userId, 'suspended', actorId, reason, metadata); }
async function revoke(userId, actorId, reason = '', metadata = {}) { return setStatus(userId, 'revoked', actorId, reason, metadata); }
async function list(status = null) {
  const sb = client(); if (!sb) return [];
  let q = sb.from('spartan_access').select('discord_user_id,username,status,role,granted_at,disabled_at,reason,updated_at').order('updated_at', { ascending: false }).limit(100);
  if (status) q = q.eq('status', status); const { data, error } = await q; if (error) throw error; return data || [];
}
async function botRevoke(userId, reason, metadata = {}) { return revoke(userId, 'spartan-bot', reason || 'Automated Spartan policy enforcement', metadata); }
module.exports = { get, hasAccess, register, grant, suspend, revoke, botRevoke, list, recordEvent };
