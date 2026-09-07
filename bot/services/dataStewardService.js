const crypto = require("crypto");
const supabaseService = require("./supabase");
const { askOpenRouter } = require("./openrouterService");
const logger = require("./logger");

const ALERT_USER_ID = process.env.DATA_STEWARD_DISCORD_USER_ID || "653534906277822494";
const ENABLED = String(process.env.DATA_STEWARD_ENABLED || "true").toLowerCase() !== "false";
let discordClient = null;
let polling = false;
let lastPageId = 0;
let lastIngestId = 0;

const ROUTES = {
  throne: { table: "intel_throne", dashboard: "Province Intel", fields: ["race","ruler","land","networth","honor","offense","defense","be","peasants","troops","thieves","wizards","tpa","wpa","spells"] },
  survey: { table: "intel_buildings", dashboard: "Buildings", fields: ["buildings"] },
  science: { table: "intel_science", dashboard: "Science", fields: ["science","science_effects","raw"] },
  som: { table: "intel_military", dashboard: "KD Military / Military Intel", fields: ["offense","defense","generals","troops","armies"] },
  state: { table: "intel_state", dashboard: "Province State", fields: ["peasants","army","thieves","wizards","total_pop","max_pop","unemployed","unfilled_jobs","employment_pct","daily_income","daily_wages","networth","land","honor","land_rank","nw_rank","map","income_yesterday","wages_yesterday","draft_yesterday","net_yesterday","peasants_yesterday","food_grown_yesterday","food_needed_yesterday","food_decay_yesterday","food_net_yesterday","runes_produced_yesterday","runes_decay_yesterday","runes_net_yesterday","income_month","wages_month","draft_month","net_month","peasants_month","food_grown_month","food_needed_month","food_decay_month","food_net_month","runes_produced_month","runes_decay_month","runes_net_month"] },
  news: { table: "news_events", dashboard: "News / War", fields: ["events"] },
  "intel-site": { table: "intel_complete_vault", dashboard: "Complete Vault / Intel 7", fields: ["rows","raw"] },
  kingdom: { table: "kingdoms", dashboard: "Kingdom Overview", fields: ["kd_code","kingdom_name","kd_name","total_provinces","total_nw","total_land","nw_rank","land_rank","provinces"] },
  "kingdom-page": { table: "kingdoms", dashboard: "Kingdom Overview", fields: ["kd_code","kingdom_name","kd_name","total_provinces","total_nw","total_land","nw_rank","land_rank","provinces","data"] },
  "kd-stats-generic": { table: "intel_kd_stats", dashboard: "KD Stats", fields: ["category","rows","data"] },
  "kd-stats-buildings": { table: "intel_buildings", dashboard: "Buildings / KD Stats", fields: ["provinces","buildings"] }
};

function setClient(client) { discordClient = client; }
function fingerprint(issue) {
  return crypto.createHash("sha256").update(JSON.stringify([
    issue.issue_type, issue.source_type, issue.field_name, issue.destination_table,
    issue.kd_code, issue.province, issue.reason
  ])).digest("hex");
}
function excerpt(value, max = 1400) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? text.slice(0, max) + "…" : text;
}

async function upsertIssue(issue) {
  const sb = supabaseService.getClient();
  if (!sb) return null;
  const fp = fingerprint(issue);
  const row = {
    fingerprint: fp, status: "open", severity: issue.severity || "medium", issue_type: issue.issue_type,
    source_type: issue.source_type || null, source: issue.source || null, source_id: issue.source_id || null,
    kd_code: issue.kd_code || null, province: issue.province || null, field_name: issue.field_name || null,
    observed_value: excerpt(issue.observed_value, 1000), raw_excerpt: excerpt(issue.raw_excerpt, 1800),
    destination_table: issue.destination_table || null, destination_dashboard: issue.destination_dashboard || null,
    reason: issue.reason, recommendation: issue.recommendation || null, confidence: issue.confidence ?? null,
    ai_analysis: issue.ai_analysis || {}, last_seen: new Date().toISOString(), updated_at: new Date().toISOString()
  };
  const { data: existing } = await sb.from("nexus_data_steward_issues").select("id,status,occurrence_count").eq("fingerprint", fp).maybeSingle();
  if (existing) {
    const { data, error } = await sb.from("nexus_data_steward_issues").update({ ...row, occurrence_count: Number(existing.occurrence_count || 1) + 1 }).eq("id", existing.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await sb.from("nexus_data_steward_issues").insert(row).select().single();
  if (error) throw error;
  return data;
}

async function audit(issueId, payload) {
  const sb = supabaseService.getClient();
  if (!sb) return;
  const { error } = await sb.from("nexus_data_steward_audit").insert({
    issue_id: issueId || null, action: payload.action || "inspect", source_type: payload.source_type || null,
    source_id: payload.source_id || null, decision: payload.decision || null, confidence: payload.confidence ?? null,
    destination_table: payload.destination_table || null, destination_dashboard: payload.destination_dashboard || null,
    details: payload.details || {}
  });
  if (error) logger.warn(`[DATA STEWARD AUDIT] ${error.message}`);
}

async function notify(issue) {
  if (!ENABLED || !discordClient || !ALERT_USER_ID) return;
  try {
    const user = await discordClient.users.fetch(ALERT_USER_ID);
    const icon = issue.severity === "critical" ? "🚨" : issue.severity === "high" ? "🔴" : "⚠️";
    const message = [
      `${icon} **Nexus Data Steward — ${issue.issue_type.replace(/_/g, " ")}**`,
      `**Source:** ${issue.source_type || issue.source || "unknown"}`,
      issue.kd_code ? `**Kingdom:** ${issue.kd_code}` : null,
      issue.province ? `**Province:** ${issue.province}` : null,
      issue.field_name ? `**Field:** \`${issue.field_name}\`` : null,
      issue.destination_table ? `**Database destination:** \`${issue.destination_table}\`` : "**Database destination:** NONE",
      issue.destination_dashboard ? `**Dashboard destination:** ${issue.destination_dashboard}` : "**Dashboard destination:** NONE",
      `**Problem:** ${issue.reason}`,
      issue.observed_value ? `**Data:** ${excerpt(issue.observed_value, 700)}` : null,
      issue.recommendation ? `**Recommended fix:** ${issue.recommendation}` : null,
      issue.confidence != null ? `**AI confidence:** ${issue.confidence}%` : null,
      `**Issue ID:** \`${issue.id || "pending"}\``
    ].filter(Boolean).join("\n");
    await user.send(message.slice(0, 1950));
  } catch (error) {
    logger.error(`[DATA STEWARD DISCORD ALERT ERROR] ${error.message}`);
  }
}

async function raise(issue) {
  try {
    const saved = await upsertIssue(issue);
    await audit(saved?.id, { ...issue, action: "issue_detected", decision: "flag", details: { observed: issue.observed_value } });
    if (!saved || saved.status === "open") await notify({ ...issue, id: saved?.id });
    return saved;
  } catch (error) {
    logger.error(`[DATA STEWARD ISSUE ERROR] ${error.message}`);
    return null;
  }
}

async function inspect(parsed, prov) {
  if (!ENABLED || !parsed) return;
  const route = ROUTES[parsed.type];
  const data = parsed.data || {};
  const context = { source_type: parsed.type, source: parsed.source, kd_code: parsed.kd, province: prov || parsed.prov };
  if (!route) {
    await raise({ ...context, issue_type: "unknown_data_type", severity: "high", observed_value: data,
      raw_excerpt: data.raw || data.text || "", reason: "The parser classified this payload as an unknown type, so Nexus has no trusted destination rule.",
      recommendation: "Add a parser classification and map the new data type to a database table and dashboard destination.", confidence: 99 });
    return;
  }
  for (const field of Object.keys(data).filter(k => !route.fields.includes(k))) {
    await raise({ ...context, issue_type: "unmapped_field", severity: "medium", field_name: field,
      destination_table: route.table, destination_dashboard: route.dashboard, observed_value: data[field], raw_excerpt: data.raw || data.text || data[field],
      reason: "This field arrived in a recognized data domain but is not mapped by the Steward's destination contract.",
      recommendation: `Decide whether ${field} belongs in ${route.table}; if it does, add schema storage and a dashboard mapping.`, confidence: 96 });
  }
  if (parsed.type === "intel-site" && data.rows?.length) {
    const raw = data.rows.map(r => r.raw || "").join("\n");
    if (raw.length > 100) {
      try {
        const ai = await askOpenRouter(`You are the Utopia Nexus Data Steward. Inspect this incoming intel payload. Determine whether it contains meaningful structured fields that Nexus is currently failing to store or expose. Do not invent fields. Return JSON only with: has_unmapped_data (boolean), fields (array of strings), destination_table (string|null), destination_dashboard (string|null), reason (string), recommendation (string), confidence (number 0-100). Payload:\n${raw.slice(0, 10000)}`);
        const cleaned = ai.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        const result = JSON.parse(cleaned);
        if (result.has_unmapped_data) {
          await raise({ ...context, issue_type: "ai_detected_unmapped_data", severity: Number(result.confidence || 0) >= 90 ? "high" : "medium",
            field_name: Array.isArray(result.fields) ? result.fields.join(", ") : null,
            destination_table: result.destination_table || route.table, destination_dashboard: result.destination_dashboard || route.dashboard,
            observed_value: result.fields || raw.slice(0, 1000), raw_excerpt: raw.slice(0, 1800),
            reason: result.reason || "AI detected data without a verified Nexus destination.", recommendation: result.recommendation,
            confidence: Number(result.confidence || 0), ai_analysis: result });
        }
      } catch (error) {
        logger.warn(`[DATA STEWARD AI INSPECTION] ${error.message}`);
      }
    }
  }
}

async function inspectIncomingRows() {
  if (polling || !ENABLED) return;
  const sb = supabaseService.getClient();
  if (!sb) return;
  polling = true;
  try {
    const { data: pages, error: pageError } = await sb.from("intel_page_ingest").select("id,kd_code,province,source,tab,url,data_type,raw_text,parsed").gt("id", lastPageId).order("id", { ascending: true }).limit(25);
    if (pageError) throw pageError;
    for (const row of pages || []) {
      lastPageId = Math.max(lastPageId, Number(row.id));
      await inspect({ type: row.data_type || "unknown", source: row.source, kd: row.kd_code, prov: row.province, url: row.url, data: row.parsed || { raw: row.raw_text || "" } }, row.province);
    }

    const { data: messages, error: ingestError } = await sb.from("intel7_ingest").select("id,discord_message_id,kd_code,channel_type,event_type,parsed,content").gt("id", lastIngestId).order("id", { ascending: true }).limit(25);
    if (ingestError) throw ingestError;
    for (const row of messages || []) {
      lastIngestId = Math.max(lastIngestId, Number(row.id));
      if (!row.event_type) {
        await audit(null, { action: "intel7_unclassified_message", source_type: "intel7", source_id: row.discord_message_id, decision: "retain_for_parser", details: { channel_type: row.channel_type, content_excerpt: excerpt(row.content, 500) } });
        continue;
      }
      const parsed = row.parsed && typeof row.parsed === "object" ? row.parsed : { raw: row.content || "" };
      await inspect({ type: row.event_type, source: "intel7", kd: row.kd_code, data: parsed }, null);
    }
  } catch (error) {
    logger.warn(`[DATA STEWARD POLLER] ${error.message}`);
  } finally {
    polling = false;
  }
}

function start() {
  if (!ENABLED) return;
  logger.info(`[DATA STEWARD] continuous inspection enabled; Discord alert user configured`);
  inspectIncomingRows().catch(() => {});
  setInterval(() => inspectIncomingRows().catch(() => {}), 10000);
}

module.exports = { setClient, start, inspect, raise, ROUTES };
