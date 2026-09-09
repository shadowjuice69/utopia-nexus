const supabaseService = require('./supabase');
const logger = require('./logger');

const REVIEW_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DECISION_CHANNEL_ID = process.env.DATA_STEWARD_DECISION_CHANNEL_ID || '1546379989484830730';
const MAX_ITEMS = 20;
let reviewTimer = null;
let running = false;

function severityRank(value) {
  return ({ critical: 4, high: 3, medium: 2, low: 1 }[String(value || '').toLowerCase()] || 0);
}

function excerpt(value, max = 500) {
  if (value == null) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function review(client) {
  if (running || !client || !DECISION_CHANNEL_ID) return;
  const sb = supabaseService.getClient();
  if (!sb) return;
  running = true;
  try {
    const { data, error } = await sb.from('nexus_data_steward_issues')
      .select('id,severity,issue_type,source_type,kd_code,province,field_name,destination_table,destination_dashboard,reason,recommendation,confidence,occurrence_count,last_seen')
      .eq('status', 'open')
      .order('severity', { ascending: false })
      .order('last_seen', { ascending: false })
      .limit(MAX_ITEMS);
    if (error) throw error;

    const issues = (data || []).filter(Boolean).sort((a, b) => {
      const severity = severityRank(b.severity) - severityRank(a.severity);
      if (severity) return severity;
      return new Date(b.last_seen || 0) - new Date(a.last_seen || 0);
    });

    // Always send a heartbeat every cycle, even with nothing to report --
    // silence should never be the only signal that Steward is still alive.
    if (!issues.length) {
      try {
        const channel = await client.channels.fetch(DECISION_CHANNEL_ID);
        if (channel && typeof channel.send === 'function') {
          await channel.send('\u2705 **Nexus Data Steward -- system check**\nActive and monitoring. No open decisions right now.');
        }
      } catch (error) {
        logger.warn(`[DATA STEWARD REVIEW HEARTBEAT] ${error.message}`);
      }
      logger.info('[DATA STEWARD REVIEW] no open decisions; heartbeat sent');
      return;
    }

    const lines = [
      '🧠 **Nexus Data Steward — Decisions Needed**',
      `**${issues.length} open decision${issues.length === 1 ? '' : 's'}**`,
      ''
    ];

    issues.forEach((issue, index) => {
      const icon = issue.severity === 'critical' ? '🚨' : issue.severity === 'high' ? '🔴' : '🟡';
      lines.push(`${icon} **${index + 1}. ${String(issue.issue_type || 'issue').replace(/_/g, ' ')}**`);
      if (issue.source_type) lines.push(`Source: ${issue.source_type}`);
      if (issue.kd_code) lines.push(`Kingdom: ${issue.kd_code}`);
      if (issue.province) lines.push(`Province: ${issue.province}`);
      if (issue.field_name) lines.push(`Field: \`${issue.field_name}\``);
      if (issue.destination_table) lines.push(`Database: \`${issue.destination_table}\``);
      if (issue.destination_dashboard) lines.push(`Dashboard: ${issue.destination_dashboard}`);
      lines.push(`Problem: ${excerpt(issue.reason)}`);
      if (issue.recommendation) lines.push(`Recommendation: ${excerpt(issue.recommendation)}`);
      if (issue.confidence != null) lines.push(`Confidence: ${issue.confidence}%`);
      if (Number(issue.occurrence_count || 0) > 1) lines.push(`Seen: ${issue.occurrence_count} times`);
      lines.push(`Issue ID: \`${issue.id}\``, '');
    });

    lines.push('Reply with the issue number(s) and your decision when action is required.');
    const channel = await client.channels.fetch(DECISION_CHANNEL_ID);
    if (!channel || typeof channel.send !== 'function') throw new Error(`Decision channel ${DECISION_CHANNEL_ID} is not writable`);

    // Discord messages max at 2000 characters. Split without losing issue boundaries.
    let chunk = '';
    for (const line of lines) {
      if ((chunk + line + '\n').length > 1900) {
        if (chunk) await channel.send(chunk.trim());
        chunk = '';
      }
      chunk += `${line}\n`;
    }
    if (chunk.trim()) await channel.send(chunk.trim());

    const { error: auditError } = await sb.from('nexus_data_steward_audit').insert({
      action: 'decision_review_sent',
      decision: 'human_review_required',
      details: { channel_id: DECISION_CHANNEL_ID, issue_ids: issues.map(i => i.id), issue_count: issues.length }
    });
    if (auditError) logger.warn(`[DATA STEWARD REVIEW AUDIT] ${auditError.message}`);
    logger.info(`[DATA STEWARD REVIEW] sent ${issues.length} decision(s) to channel ${DECISION_CHANNEL_ID}`);
  } catch (error) {
    logger.error(`[DATA STEWARD REVIEW ERROR] ${error.stack || error.message}`);
  } finally {
    running = false;
  }
}

function start(client) {
  if (reviewTimer) return;
  logger.info(`[DATA STEWARD REVIEW] enabled; interval=6h; channel=${DECISION_CHANNEL_ID}`);
  reviewTimer = setInterval(() => review(client).catch(() => {}), REVIEW_INTERVAL_MS);
}

module.exports = { start, review };
