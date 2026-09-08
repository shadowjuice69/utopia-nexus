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

  // Dashboard login is keyed by province name. Use the same registration
  // lookup as auth.js instead of assuming provinces.user_id is a Supabase
  // Auth UUID (historically it may contain a Discord/user identifier).
  const { data, error } = await supabase.rpc("nexus_registration_lookup", {
    province_name: requestedProvince,
  });

  if (error || !data?.[0]) return null;

  const registered = data[0];
  const province = clean(registered.name || registered.province || requestedProvince);
  const kd = clean(registered.kd_code || registered.kingdom_code || registered.kd);
  const kingdomId = clean(registered.kingdom_id);
  let kingdom = clean(registered.kd_name || registered.kingdom_name || registered.kingdom);

  if (!kingdom && kingdomId) {
    const { data: kingdomRow } = await supabase
      .from("kingdoms")
      .select("kd_id, kd_name")
      .eq("id", kingdomId)
      .maybeSingle();
    kingdom = clean(kingdomRow?.kd_name);
  }

  return {
    kingdom,
    kd,
    province,
    kingdomId,
    owner: false,
  };
}

export async function loadNexusConfig(force = false) {
  const now = Date.now();
  if (!force && cachedConfig && now - cachedAt < CONFIG_TTL_MS) return cachedConfig;

  const savedProvince = clean(sessionStorage.getItem("nexus_province"));
  const { data: { user } } = await supabase.auth.getUser();

  // The province entered at login is the authoritative dashboard identity.
  // Resolve it first for every user, including users with an existing
  // Supabase Auth session, so each province sees its own kingdom/intel.
  if (savedProvince) {
    const registered = await loadFromRegisteredProvince(savedProvince);
    if (registered?.province && registered?.kd) {
      cachedConfig = registered;
      cachedAt = now;
      return cachedConfig;
    }
  }

  // Fallback for sessions where the login province was not persisted.
  if (user) {
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

  const { data: bs } = await supabase.from("bot_settings").select("key, value");
  const fallbackKd = bs?.find(s => s.key === "kingdom_code")?.value || "";
  const fallbackKdName = bs?.find(s => s.key === "kingdom_name")?.value || "";
  cachedConfig = { kingdom: fallbackKdName, kd: fallbackKd, province: "", kingdomId: "", owner: false };
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
