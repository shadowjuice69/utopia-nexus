const supabaseService = require('./supabase');
const logger = require('./logger');

function client() {
  return supabaseService.getClient();
}

function normalizeIp(ip) {
  if (!ip) return null;
  let value = String(ip).trim();
  if (value.startsWith('::ffff:')) value = value.slice(7);
  return value || null;
}

async function recordSession({ discordUserId = null, sessionId = null, ipAddress, userAgent = null, dashboardRoute = null, success = true }) {
  const sb = client();
  const ip = normalizeIp(ipAddress);
  if (!sb || !ip) return null;

  const { data, error } = await sb.from('spartan_security_sessions').insert({
    discord_user_id: discordUserId ? String(discordUserId) : null,
    session_id: sessionId || undefined,
    ip_address: ip,
    user_agent: userAgent,
    dashboard_route: dashboardRoute,
    success: Boolean(success),
  }).select('*').single();

  if (error) {
    logger.error(`[SPARTAN SECURITY] session record failed: ${error.message}`);
    throw error;
  }
  return data;
}

async function isIpBlocked(ipAddress) {
  const sb = client();
  const ip = normalizeIp(ipAddress);
  if (!sb || !ip) return false;

  const { data, error } = await sb.from('spartan_ip_blocks')
    .select('id,ip_address,status,reason,created_at')
    .eq('ip_address', ip)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function blockIp(ipAddress, actorDiscordId, reason = '') {
  const sb = client();
  const ip = normalizeIp(ipAddress);
  if (!sb || !ip) throw new Error('A valid IP address is required.');

  const { data, error } = await sb.from('spartan_ip_blocks').upsert({
    ip_address: ip,
    status: 'active',
    reason: reason || null,
    created_by_discord_id: actorDiscordId ? String(actorDiscordId) : null,
    revoked_by_discord_id: null,
    revoked_at: null,
  }, { onConflict: 'ip_address' }).select('*').single();

  if (error) throw error;
  await recordSecurityEvent('ip_blocked', null, ip, actorDiscordId, reason);
  logger.warn(`[SPARTAN SECURITY] IP blocked ${ip} by ${actorDiscordId || 'system'}`);
  return data;
}

async function unblockIp(ipAddress, actorDiscordId, reason = '') {
  const sb = client();
  const ip = normalizeIp(ipAddress);
  if (!sb || !ip) throw new Error('A valid IP address is required.');

  const { data, error } = await sb.from('spartan_ip_blocks').update({
    status: 'revoked',
    revoked_by_discord_id: actorDiscordId ? String(actorDiscordId) : null,
    revoked_at: new Date().toISOString(),
  }).eq('ip_address', ip).select('*').single();

  if (error) throw error;
  await recordSecurityEvent('ip_unblocked', null, ip, actorDiscordId, reason);
  logger.info(`[SPARTAN SECURITY] IP unblocked ${ip} by ${actorDiscordId || 'system'}`);
  return data;
}

async function recordSecurityEvent(eventType, discordUserId, ipAddress, actorDiscordId, reason = '', metadata = {}) {
  const sb = client();
  if (!sb) return null;
  const ip = normalizeIp(ipAddress);
  const { data, error } = await sb.from('spartan_security_events').insert({
    event_type: String(eventType),
    discord_user_id: discordUserId ? String(discordUserId) : null,
    ip_address: ip,
    actor_discord_id: actorDiscordId ? String(actorDiscordId) : null,
    reason: reason || null,
    metadata,
  }).select('*').single();
  if (error) {
    logger.error(`[SPARTAN SECURITY] event record failed: ${error.message}`);
    throw error;
  }
  return data;
}

async function listIpBlocks(status = 'active') {
  const sb = client();
  if (!sb) return [];
  let query = sb.from('spartan_ip_blocks').select('*').order('created_at', { ascending: false }).limit(200);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

module.exports = {
  normalizeIp,
  recordSession,
  isIpBlocked,
  blockIp,
  unblockIp,
  recordSecurityEvent,
  listIpBlocks,
};
