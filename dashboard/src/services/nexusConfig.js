import { supabase } from "./supabase";

let cachedConfig = null;
let cachedAt = 0;
const CONFIG_TTL_MS = 30000;

function clean(value) {
  return String(value ?? "").trim();
}

async function resolveKingdom(kd, kingdomId = "") {
  const code = clean(kd);
  const id = clean(kingdomId);
  if (!code && !id) return "";

  let query = supabase
    .from("kingdoms")
    .select("id,kd_code,kd_name,updated_at");

  if (code) query = query.eq("kd_code", code);
  else query = query.eq("id", id);

  const { data } = await query
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return clean(data?.kd_name);
}

async function loadFromRegisteredProvince(provinceName) {
  const requestedProvince = clean(provinceName);
  if (!requestedProvince) return null;

  const { data, error } = await supabase.rpc("nexus_registration_lookup", {
    province_name: requestedProvince,
  });

  if (error || !data?.[0]) return null;

  const registered = data[0];
  const province = clean(registered.name || registered.province || requestedProvince);
  const kd = clean(registered.kd_code || registered.kingdom_code || registered.kd);
  const kingdomId = clean(registered.kingdom_id);

  // Never trust a stale kingdom name supplied by registration/session data.
  // The KD code is the identity key; resolve the current kingdom name from
  // the normalized kingdoms table every time.
  const kingdom = await resolveKingdom(kd, kingdomId);

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

  const savedProvince = clean(
    sessionStorage.getItem("nexus_province") ||
    localStorage.getItem("nexus_province")
  );
  const { data: { user } } = await supabase.auth.getUser();

  // 1. The province selected at dashboard login is the authoritative identity.
  // It is resolved through the registration RPC, which returns the province's
  // current KD code. This prevents the dashboard from inheriting another
  // kingdom from global bot settings or stale age snapshots.
  if (savedProvince) {
    const registered = await loadFromRegisteredProvince(savedProvince);
    if (registered?.province && registered?.kd) {
      cachedConfig = registered;
      cachedAt = now;
      return cachedConfig;
    }
  }

  if (user) {
    const [
      { data: province },
      { data: identity },
      { data: admin },
      { data: settings },
    ] = await Promise.all([
      // Historical provinces.user_id can contain the Discord/user identifier,
      // so this is supplemental rather than the primary identity mechanism.
      supabase
        .from("provinces")
        .select("name, kingdom_id, kd_code")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("nexus_identity_profiles")
        .select("current_province,current_kd_code,updated_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("nexus_admins")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .maybeSingle(),
      supabase
        .from("user_settings")
        .select("my_kd_id, age_current")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const identityKd = clean(identity?.current_kd_code);
    const identityProvince = clean(identity?.current_province);
    const provinceKd = clean(province?.kd_code);
    const provinceName = clean(province?.name);
    const settingsKd = clean(settings?.my_kd_id);

    // Identity profile is the persisted Nexus identity; province row is a
    // supplemental source. user_settings is only a last-resort KD fallback.
    const kd = identityKd || provinceKd || settingsKd;
    const resolvedProvince = identityProvince || provinceName;
    const kingdomId = clean(province?.kingdom_id);
    const kingdom = await resolveKingdom(kd, kingdomId);

    if (resolvedProvince || kd) {
      await supabase
        .from("nexus_identity_profiles")
        .upsert({
          user_id: user.id,
          current_province: resolvedProvince || null,
          current_kd_code: kd || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
    }

    if (resolvedProvince || kd) {
      cachedConfig = {
        kingdom,
        kd,
        province: resolvedProvince,
        kingdomId,
        owner: !!admin,
      };
      cachedAt = now;
      return cachedConfig;
    }
  }

  // Anonymous/admin fallback only. Never use a stale kingdom name to override
  // an authenticated province identity.
  const { data: bs } = await supabase.from("bot_settings").select("key, value");
  const fallbackKd = clean(bs?.find(s => s.key === "kingdom_code")?.value);
  const fallbackKingdom = await resolveKingdom(fallbackKd);
  cachedConfig = {
    kingdom: fallbackKingdom,
    kd: fallbackKd,
    province: "",
    kingdomId: "",
    owner: false,
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
