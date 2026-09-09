const supabaseService = require("./supabase");

/**
 * Single identity resolver for Discord -> Nexus province.
 *
 * Resolution order:
 *   1. exact Discord link on provinces
 *   2. exact Nexus user UUID on provinces
 *   3. persisted nexus_identity_profiles -> current province + kingdom
 *
 * The resolver deliberately prefers the persisted kingdom when duplicate
 * province names exist across kingdoms. It never invents a province.
 */
async function resolve(userId) {
  const sb = supabaseService.getClient();
  if (!sb || !userId) return null;

  const select = "id,name,kd_code,land,acres,nw,discord_id,user_id,r_tpa,r_wpa,ome,dme";

  const { data: linked, error: linkedError } = await sb
    .from("provinces")
    .select(select)
    .eq("discord_id", String(userId))
    .order("updated_at", { ascending: false })
    .limit(1);
  if (!linkedError && linked?.[0]) return linked[0];

  const { data: byUser, error: userError } = await sb
    .from("provinces")
    .select(select)
    .eq("user_id", String(userId))
    .order("updated_at", { ascending: false })
    .limit(1);
  if (!userError && byUser?.[0]) return byUser[0];

  // Dashboard-authenticated users can be represented by a Supabase UUID.
  // Discord users normally won't have auth.uid() available to the service
  // client, so this fallback is intentionally explicit and deterministic.
  const { data: profile, error: profileError } = await sb
    .from("nexus_identity_profiles")
    .select("user_id,display_name,current_province,current_kd_code,updated_at")
    .eq("user_id", String(userId))
    .limit(1);

  if (!profileError && profile?.[0]) {
    const p = profile[0];
    const { data: current } = await sb
      .from("provinces")
      .select(select)
      .eq("name", p.current_province)
      .eq("kd_code", p.current_kd_code)
      .order("updated_at", { ascending: false })
      .limit(1);
    if (current?.[0]) return current[0];

    return {
      id: p.user_id,
      name: p.current_province,
      kd_code: p.current_kd_code,
      land: null,
      acres: null,
      nw: null,
      discord_id: null,
      user_id: p.user_id,
      r_tpa: null,
      r_wpa: null,
      ome: null,
      dme: null
    };
  }

  return null;
}

async function isRegistered(userId) {
  return Boolean(await resolve(userId));
}

module.exports = { resolve, isRegistered };
