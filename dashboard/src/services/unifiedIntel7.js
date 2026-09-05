import { supabase } from "./supabase";
import { loadNexusConfig } from "./nexusConfig";

const EVENT_LIMIT = 500;
const DATA_LIMIT = 500;

function newest(rows = [], field = "updated_at") {
  return rows.reduce((latest, row) => {
    const value = row?.[field];
    if (!value) return latest;
    if (!latest) return value;
    return new Date(value) > new Date(latest) ? value : latest;
  }, null);
}

async function rows(table, kd, orderField = "updated_at") {
  let query = supabase.from(table).select("*").eq("kd_code", kd).limit(DATA_LIMIT);
  if (orderField) query = query.order(orderField, { ascending: false });
  const { data, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data || [];
}

export async function loadUnifiedIntel7() {
  const config = await loadNexusConfig();
  const kd = config?.kd || config?.kingdom?.kd_code || config?.kingdomCode;
  if (!kd) throw new Error("No current kingdom context is configured");

  const [provinces, buildings, science, military, kdStats, events, ingest] = await Promise.all([
    rows("provinces", kd),
    rows("intel_buildings", kd),
    rows("intel_science", kd),
    rows("intel_military", kd),
    rows("intel_kd_stats", kd),
    rows("intel7_events", kd, "timestamp"),
    rows("intel7_ingest", kd, "message_created_at"),
  ]);

  const channelRows = events.length
    ? events
    : ingest.map(row => ({
        id: row.id,
        channel_type: row.channel_type,
        event_type: row.event_type,
        kd_code: row.kd_code,
        timestamp: row.message_created_at || row.received_at,
        province_name: row.parsed?.province_name,
        target_name: row.parsed?.target_name,
        target_kd: row.parsed?.target_kd,
        action: row.parsed?.action,
        operation: row.parsed?.operation,
        spell_name: row.parsed?.spell_name,
        amount: row.parsed?.amount,
        resource: row.parsed?.resource,
        data: row.parsed,
        raw: row.content,
      }));

  const channels = {
    ops: channelRows.filter(r => ["ops", "offensive", "offensive_spells", "thieves"].includes(r.channel_type) || ["op", "thievery", "offense"].includes(r.event_type)),
    offensive_spells: channelRows.filter(r => ["offensive_spells", "offensive", "spells"].includes(r.channel_type) || String(r.event_type || "").includes("spell")),
    self_spells: channelRows.filter(r => ["self_spells", "self"].includes(r.channel_type)),
    dragon: channelRows.filter(r => r.channel_type === "dragon"),
    ritual: channelRows.filter(r => r.channel_type === "ritual"),
    aid: channelRows.filter(r => r.channel_type === "aid"),
    attacks: channelRows.filter(r => r.channel_type === "attacks" || ["attack", "attack_result"].includes(r.event_type)),
  };

  const freshness = {
    provinces: newest(provinces),
    buildings: newest(buildings),
    science: newest(science),
    military: newest(military),
    kdStats: newest(kdStats),
    events: newest(channelRows, "timestamp"),
    ingest: newest(ingest, "message_created_at"),
  };

  return {
    kd,
    kingdomName: config?.kingdomName || kd,
    currentProvince: config?.province || null,
    provinces,
    buildings,
    science,
    military,
    kdStats,
    events: channelRows.slice(0, EVENT_LIMIT),
    ingest: ingest.slice(0, EVENT_LIMIT),
    channels,
    freshness,
    loadedAt: new Date().toISOString(),
  };
}
