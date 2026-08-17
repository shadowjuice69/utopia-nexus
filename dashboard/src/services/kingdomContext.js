import { supabase } from "./supabase";

const DEFAULT_CONTEXT = {
  kingdomCode: null,
  kingdomName: null,
  provinceName: null,
};

/**
 * Load the current player's kingdom identity from Nexus settings.
 * Age-specific values belong in bot_settings, never in dashboard components.
 */
export async function getKingdomContext() {
  const { data, error } = await supabase
    .from("bot_settings")
    .select("key, value")
    .in("key", ["kingdom_code", "kingdom_name", "my_province", "my_province_name"]);

  if (error) {
    console.error("Failed to load kingdom context:", error);
    return DEFAULT_CONTEXT;
  }

  const settings = Object.fromEntries((data || []).map(row => [row.key, row.value]));

  return {
    kingdomCode: settings.kingdom_code || null,
    kingdomName: settings.kingdom_name || null,
    provinceName: settings.my_province || settings.my_province_name || null,
  };
}

export function isOutgoingAttack(attack, kingdomCode) {
  if (attack?.attack_type === "incoming") return false;
  if (attack?.attack_type === "traditional" || attack?.attack_type === "ambush") return true;
  return Boolean(kingdomCode && attack?.kd_code === kingdomCode);
}
