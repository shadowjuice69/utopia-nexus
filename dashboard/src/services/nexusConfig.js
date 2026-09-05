import { supabase } from "./supabase";

let cachedConfig = null;
let cachedAt = 0;
const CONFIG_TTL_MS = 30000;

function clean(value) {
  return String(value ?? "").trim();
}

async function loadFromRegisteredProvince(provinceName) {
  const requestedProvince = clean(provinceName);
  if (!requestedProvince) return null;

  const { data: province } = await supabase
    .from("provinces")
    .select("name, kingdom_id, kd_code")
    .eq("name", requestedProvince)
    .maybeSingle();

  if (!province) return null;

  let kingdom = "";
  if (province.kingdom_id) {
    const { data: kingdomRow } = await supabase
      .from("kingdoms")
      .select("kd_id, kd_name")
      .eq("id", province.kingdom_id)
      .maybeSingle();
    kingdom = clean(kingdomRow?.kd_name);
  }

  return {
    kingdom,
    kd: clean(province.kd_code),
    province: clean(province.name),
    kingdomId: clean(province.kingdom_id),
    owner: false,
  };
}

export async function loadNexusConfig(force = false) {
  const now = Date.now();
  if (!force && cachedConfig && now - cachedAt < CONFIG_TTL_MS) return cachedConfig;

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const savedProvince = sessionStorage.getItem("nexus_province");
    const registered = await loadFromRegisteredProvince(savedProvince);
    if (registered) {
      cachedConfig = registered;
      cachedAt = now;
      return cachedConfig;
    }
    const { data: bs } = await supabase.from("bot_settings").select("key, value");
    const fallbackKd = bs?.find(s => s.key === "kingdom_code")?.value || "";
    const fallbackKdName = bs?.find(s => s.key === "kingdom_name")?.value || "";
    cachedConfig = { kingdom: fallbackKdName, kd: fallbackKd, province: "", kingdomId: "", owner: false };
    cachedAt = now;
    return cachedConfig;
  }

  const [{ data: settings }, { data: province }, { data: admin }, { data: botSettings }] = await Promise.all([
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
    supabase
      .from("bot_settings")
      .select("key, value"),
  ]);
  const botKd = botSettings?.find(s => s.key === "kingdom_code")?.value || "";

  const current = settings?.age_current && typeof settings.age_current === "object"
    ? settings.age_current
    : {};

  const kd = clean(province?.kd_code || settings?.my_kd_id || current.kd_code || current.kingdom_code || botKd);
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
  cachedAt = now;
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
  cachedAt = 0;
}
