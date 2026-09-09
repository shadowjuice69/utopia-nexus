const supabaseService = require("./supabase");

/**
 * Single identity resolver for Discord -> Nexus province.
 *
 * Resolution order:
 *   1. exact Discord link with a valid kingdom code
 *   2. exact Nexus user UUID with a valid kingdom code
 *   3. persisted nexus_identity_profiles -> current province + kingdom
 *   4. legacy linked/user row as a last resort
 *
 * A stale/legacy province row must never shadow a current linked identity
 * simply because it has a newer updated_at timestamp.
 */
async function resolve(userId) {
  const sb = supabaseService.getClient();
  if (!sb || !userId) return null;

  const select = "id,name,kd_code,land,acres,nw,discord_id,user_id,r_tpa,r_wpa,ome,dme";
  const uid = String(userId);

  const { data: linked, error: linkedError } = await sb
    .from("provinces")
    .select(select)
    .eq("discord_id", uid)
    .not("kd_code", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (!linkedError && linked?.[0]) return linked[0];

  const { data: byUser, error: userError } = await sb
    .from("provinces")
    .select(select)
    .eq("user_id", uid)
    .not("kd_code", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (!userError && byUser?.[0]) return byUser[0];

  // Dashboard-authenticated users can be represented by a Supabase UUID.
  // Discord users normally won't have auth.uid() available to the service
  // client, so this fallback is intentionally explicit and deterministic.
  const { data: profile, error: profileError } = await sb
    .from("nexus_identity_profiles")
    .select("user_id,display_name,current_province,current_kd_code,updated_at")
    .eq("user_id", uid)
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

  // Last-resort compatibility for old records. This cannot normally happen
  // when a current kingdom-linked row exists because the queries above win.
  const { data: legacyLinked } = await sb
    .from("provinces")
    .select(select)
    .eq("discord_id", uid)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (legacyLinked?.[0]) return legacyLinked[0];

  const { data: legacyUser } = await sb
    .from("provinces")
    .select(select)
    .eq("user_id", uid)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (legacyUser?.[0]) return legacyUser[0];

  return null;
}

async function isRegistered(userId) {
  return Boolean(await resolve(userId));
}

module.exports = { resolve, isRegistered };
