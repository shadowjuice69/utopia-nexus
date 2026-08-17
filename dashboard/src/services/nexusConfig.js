import { supabase } from "./supabase";

let cachedConfig = null;

function clean(value) {
  return String(value ?? "").trim();
}

export async function loadNexusConfig() {
  if (cachedConfig) return cachedConfig;

  const { data, error } = await supabase
    .from("user_settings")
    .select("my_kd_id, age_current")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    cachedConfig = { kingdom: "", kd: "" };
    return cachedConfig;
  }

  const current = data.age_current && typeof data.age_current === "object"
    ? data.age_current
    : {};
  const kd = clean(data.my_kd_id);
  const kingdom = clean(current.kingdom || current.kingdom_name || current.name);

  cachedConfig = { kingdom, kd };
  return cachedConfig;
}

export function getNexusConfig() {
  return cachedConfig || { kingdom: "", kd: "" };
}

export function getKingdomLabel() {
  const { kingdom, kd } = getNexusConfig();
  if (!kingdom && !kd) return "Kingdom context unavailable";
  if (!kingdom) return `Kingdom · ${kd}`;
  if (!kd) return `Kingdom ${kingdom}`;
  return `Kingdom ${kingdom} · ${kd}`;
}

export function clearNexusConfig() {
  cachedConfig = null;
}
