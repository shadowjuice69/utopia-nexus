import { supabase } from "./supabase";

let cachedConfig = null;

function clean(value) {
  return String(value ?? "").trim();
}

export async function loadNexusConfig() {
  if (cachedConfig) return cachedConfig;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    cachedConfig = { kingdom: "", kd: "", province: "", kingdomId: "", owner: false };
    return cachedConfig;
  }

  const [{ data: settings }, { data: province }, { data: admin }] = await Promise.all([
    supabase
      .from("user_settings")
      .select("my_kd_id, age_current")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("provinces")
      .select("name, kingdom_id, kd_code")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("nexus_admins")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle(),
  ]);

  const current = settings?.age_current && typeof settings.age_current === "object"
    ? settings.age_current
    : {};

  const kd = clean(province?.kd_code || settings?.my_kd_id || current.kd_code || current.kingdom_code);
  const kingdom = clean(current.kingdom || current.kingdom_name || current.name);
  const provinceName = clean(province?.name || current.province || current.province_name);
  const kingdomId = clean(province?.kingdom_id);

  if (provinceName || kd) {
    await supabase
      .from("nexus_identity_profiles")
      .upsert({
        user_id: user.id,
        current_province: provinceName || null,
        current_kd_code: kd || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
  }

  cachedConfig = {
    kingdom,
    kd,
    province: provinceName,
    kingdomId,
    owner: !!admin,
  };
  return cachedConfig;
}

export function getNexusConfig() {
  return cachedConfig || { kingdom: "", kd: "", province: "", kingdomId: "", owner: false };
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
