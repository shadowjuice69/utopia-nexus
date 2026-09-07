const crypto = require("crypto");
const supabaseService = require("./supabase");
const { askOpenRouter } = require("./openrouterService");
const logger = require("./logger");

const ALERT_USER_ID = process.env.DATA_STEWARD_DISCORD_USER_ID || "653534906277822494";
const ENABLED = String(process.env.DATA_STEWARD_ENABLED || "true").toLowerCase() !== "false";
const AUTO_REMEDIATE = String(process.env.DATA_STEWARD_AUTO_REMEDIATE || "true").toLowerCase() !== "false";
const AUTO_REMEDIATE_MIN_CONFIDENCE = Number(process.env.DATA_STEWARD_AUTO_REMEDIATE_MIN_CONFIDENCE || 95);
const AUTO_REMEDIATE_KEY = "data_steward_auto_mappings";
let discordClient = null;
let polling = false;
let lastPageId = 0;
let lastIngestId = 0;
let autoMappings = {};
let mappingsLoadedAt = 0;

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

async function loadAutoMappings(force = false) {
  if (!force && Date.now() - mappingsLoadedAt < 60000) return autoMappings;
  const sb = supabaseService.getClient();
  if (!sb) return autoMappings;
  try {
    const { data, error } = await sb.from("bot_settings").select("value").eq("key", AUTO_REMEDIATE_KEY).maybeSingle();
    if (error) throw error;
    autoMappings = data?.value ? JSON.parse(data.value) : {};
    if (!autoMappings || typeof autoMappings !== "object") autoMappings = {};
    mappingsLoadedAt = Date.now();
  } catch (error) {
    logger.warn(`[DATA STEWARD MAPPINGS LOAD] ${error.message}`);
  }
  return autoMappings;
}

async function saveAutoMappings(nextMappings) {
  const sb = supabaseService.getClient();
  if (!sb) return false;
  const { error } = await sb.from("bot_settings").upsert({
    key: AUTO_REMEDIATE_KEY,
    value: JSON.stringify(nextMappings),
    updated_at: new Date().toISOString()
  }, { onConflict: "key" });
  if (error) throw error;
  autoMappings = nextMappings;
  mappingsLoadedAt = Date.now();
  return true;
}

function effectiveFields(type, route) {
  const configured = Array.isArray(autoMappings[type]) ? autoMappings[type] : [];
  return new Set([...route.fields, ...configured]);
}

async function captureSafely(issue, parsed) {
  const sb = supabaseService.getClient();
  if (!sb || !parsed?.data || !issue?.field_name) return null;
  const sourceId = String(parsed.source_id || parsed.source || "unknown");
  const hash = crypto.createHash("sha256").update(JSON.stringify([
    sourceId, parsed.type, issue.field_name, parsed.kd, parsed.prov, parsed.data
  ])).digest("hex");
  const { data: existing, error: lookupError } = await sb.from("intel_complete_vault")
    .select("id").eq("payload_hash", hash).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing;

  const { data, error } = await sb.from("intel_complete_vault").insert({
    kd_code: parsed.kd || null,
    province: parsed.prov || null,
    source: parsed.source || parsed.type || "data-steward",
    tab: parsed.type || "steward-remediation",
    url: parsed.url || null,
    data_type: parsed.type || "unknown",
    raw_text: excerpt(parsed.data.raw || parsed.data.text || JSON.stringify(parsed.data), 5000),
    payload: {
      ...parsed.data,
      __steward_remediation: {
        field: issue.field_name,
        source_id: parsed.source_id || null,
        remediated_at: new Date().toISOString()
      }
    },
    field_names: Object.keys(parsed.data),
    payload_hash: hash,
    is_current: true
  }).select().single();
  if (error) throw error;
  return data;
}

async function autoRemediate(issue, parsed) {
  if (!AUTO_REMEDIATE || !issue || !parsed) return false;
  const route = ROUTES[parsed.type];
  if (!route) return false;
  if (issue.issue_type === "unmapped_field") {
    const field = String(issue.field_name || "").trim();
    if (!field || effectiveFields(parsed.type, route).has(field)) return false;
    // Safe remediation: preserve the complete payload in the existing vault first,
    // then persist the mapping contract. No production schema or RLS is changed.
    await captureSafely(issue, parsed);
    const next = { ...autoMappings };
    next[parsed.type] = Array.from(new Set([...(Array.isArray(next[parsed.type]) ? next[parsed.type] : []), field])).slice(0, 250);
    await saveAutoMappings(next);
    return { action: "auto_remediated_mapping", destination_table: "intel_complete_vault", destination_dashboard: "Complete Vault / Data Steward" };
  }
  if (issue.issue_type === "ai_detected_unmapped_data" && Number(issue.confidence || 0) >= AUTO_REMEDIATE_MIN_CONFIDENCE) {
    if (issue.destination_table && issue.destination_table !== route.table && issue.destination_table !== "intel_complete_vault") return false;
    await captureSafely(issue, parsed);
    await audit(null, { ...issue, action: "auto_remediated_ai_data", decision: "safe_catch_all", details: { destination_table: "intel_complete_vault", confidence: issue.confidence } });
    return { action: "auto_remediated_ai_data", destination_table: "intel_complete_vault", destination_dashboard: "Complete Vault / Data Steward" };
  }
  return false;
}

async function upsertIssue(issue) {
  const sb = supabaseService.getClient();
  if (!sb) return null;
  const fp = fingerprint(issue);
  const autoResolved = Boolean(issue.auto_resolved);
  const row = {
    fingerprint: fp, status: autoResolved ? "resolved" : "open", severity: issue.severity || "medium", issue_type: issue.issue_type,
    source_type: issue.source_type || null, source: issue.source || null, source_id: issue.source_id || null,
    kd_code: issue.kd_code || null, province: issue.province || null, field_name: issue.field_name || null,
    observed_value: excerpt(issue.observed_value, 1000), raw_excerpt: excerpt(issue.raw_excerpt, 1800),
    destination_table: issue.destination_table || null, destination_dashboard: issue.destination_dashboard || null,
    reason: issue.reason, recommendation: issue.recommendation || null, confidence: issue.confidence ?? null,
    ai_analysis: issue.ai_analysis || {}, last_seen: new Date().toISOString(), updated_at: new Date().toISOString(),
    resolved_at: autoResolved ? new Date().toISOString() : null,
    resolved_by: autoResolved ? "ai-data-steward:auto" : null
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
    await audit(saved?.id, { ...issue, action: issue.auto_resolved ? "issue_auto_resolved" : "issue_detected", decision: issue.auto_resolved ? "auto_remediate" : "flag", details: { observed: issue.observed_value, remediation: issue.remediation || null } });
    if (!issue.auto_resolved && saved?.status === "open") await notify({ ...issue, id: saved?.id });
    return saved;
  } catch (error) {
    logger.error(`[DATA STEWARD ISSUE ERROR] ${error.message}`);
    return null;
  }
}

async function inspect(parsed, prov) {
  if (!ENABLED || !parsed) return;
  await loadAutoMappings();
  const route = ROUTES[parsed.type];
  const data = parsed.data || {};
  const context = { source_type: parsed.type, source: parsed.source, source_id: parsed.source_id, kd_code: parsed.kd, province: prov || parsed.prov };
  if (!route) {
    await raise({ ...context, issue_type: "unknown_data_type", severity: "high", observed_value: data,
      raw_excerpt: data.raw || data.text || "", reason: "The parser classified this payload as an unknown type, so Nexus has no trusted destination rule.",
      recommendation: "Add a parser classification and map the new data type to a database table and dashboard destination.", confidence: 99 });
    return;
  }
  const fields = effectiveFields(parsed.type, route);
  for (const field of Object.keys(data).filter(k => !fields.has(k))) {
    const issue = { ...context, issue_type: "unmapped_field", severity: "medium", field_name: field,
      destination_table: route.table, destination_dashboard: route.dashboard, observed_value: data[field], raw_excerpt: data.raw || data.text || data[field],
      reason: "This field arrived in a recognized data domain but is not mapped by the Steward's destination contract.",
      recommendation: `Decide whether ${field} belongs in ${route.table}; if it does, add schema storage and a dashboard mapping.`, confidence: 96 };
    try {
      const remediation = await autoRemediate(issue, parsed);
      if (remediation) {
        issue.auto_resolved = true;
        issue.remediation = remediation;
        issue.destination_table = remediation.destination_table;
        issue.destination_dashboard = remediation.destination_dashboard;
        issue.recommendation = "Automatically preserved the field in the Complete Vault and updated the Steward mapping contract. No production schema or RLS changes were made.";
      }
    } catch (error) {
      logger.warn(`[DATA STEWARD AUTO-REMEDIATE] ${error.message}`);
    }
    await raise(issue);
  }
  if (parsed.type === "intel-site" && data.rows?.length) {
    const raw = data.rows.map(r => r.raw || "").join("\n");
    if (raw.length > 100) {
      try {
        const ai = await askOpenRouter(`You are the Utopia Nexus Data Steward. Inspect this incoming intel payload. Determine whether it contains meaningful structured fields that Nexus is currently failing to store or expose. Do not invent fields. Return JSON only with: has_unmapped_data (boolean), fields (array of strings), destination_table (string|null), destination_dashboard (string|null), reason (string), recommendation (string), confidence (number 0-100). Payload:\n${raw.slice(0, 10000)}`);
        const cleaned = ai.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
        const result = JSON.parse(cleaned);
        if (result.has_unmapped_data) {
          const issue = { ...context, issue_type: "ai_detected_unmapped_data", severity: Number(result.confidence || 0) >= 90 ? "high" : "medium",
            field_name: Array.isArray(result.fields) ? result.fields.join(", ") : null,
            destination_table: result.destination_table || route.table, destination_dashboard: result.destination_dashboard || route.dashboard,
            observed_value: result.fields || raw.slice(0, 1000), raw_excerpt: raw.slice(0, 1800),
            reason: result.reason || "AI detected data without a verified Nexus destination.", recommendation: result.recommendation,
            confidence: Number(result.confidence || 0), ai_analysis: result };
          try {
            const remediation = await autoRemediate(issue, parsed);
            if (remediation) {
              issue.auto_resolved = true;
              issue.remediation = remediation;
              issue.destination_table = remediation.destination_table;
              issue.destination_dashboard = remediation.destination_dashboard;
              issue.recommendation = "Automatically preserved the AI-detected payload in the Complete Vault. No production schema, RLS, or core game logic changes were made.";
            }
          } catch (error) {
            logger.warn(`[DATA STEWARD AI AUTO-REMEDIATE] ${error.message}`);
          }
          await raise(issue);
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
      await inspect({ type: row.data_type || "unknown", source: row.source, source_id: row.id, kd: row.kd_code, prov: row.province, url: row.url, data: row.parsed || { raw: row.raw_text || "" } }, row.province);
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
      await inspect({ type: row.event_type, source: "intel7", source_id: row.discord_message_id, kd: row.kd_code, data: parsed }, null);
    }
  } catch (error) {
    logger.warn(`[DATA STEWARD POLLER] ${error.message}`);
  } finally {
    polling = false;
  }
}

function start() {
  if (!ENABLED) return;
  logger.info(`[DATA STEWARD] continuous inspection enabled; auto-remediation=${AUTO_REMEDIATE}; min-confidence=${AUTO_REMEDIATE_MIN_CONFIDENCE}`);
  inspectIncomingRows().catch(() => {});
  setInterval(() => inspectIncomingRows().catch(() => {}), 10000);
}

module.exports = { setClient, start, inspect, raise, ROUTES, loadAutoMappings };
