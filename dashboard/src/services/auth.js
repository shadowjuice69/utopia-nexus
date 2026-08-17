import { supabase } from "./supabase";
import { evaluateAuthorization } from "./authorizationPolicy";

const PASSWORD = "NikkoAce";

export async function getDashboardAuthorization(provinceName, password) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { allowed: false, reason: "unauthenticated", user: null, owner: false };
  }

  const [{ data: admin }, { data: province, error: provinceError }] = await Promise.all([
    supabase
      .from("nexus_admins")
      .select("user_id, role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle(),
    supabase
      .from("provinces")
      .select("id, name, user_id, kingdom_id, kd_code")
      .eq("user_id", user.id)
      .eq("name", String(provinceName ?? "").trim())
      .maybeSingle(),
  ]);

  const decision = evaluateAuthorization({
    authenticated: true,
    provinceName,
    password,
    registeredProvince: provinceError ? null : province,
    isOwner: !!admin,
    expectedPassword: PASSWORD,
  });

  return {
    ...decision,
    user,
    province: provinceError ? null : province,
  };
}

export async function getDashboardRegistration() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { user: null, registered: false, owner: false, province: null };

  const [{ data: admin }, { data: province }] = await Promise.all([
    supabase
      .from("nexus_admins")
      .select("user_id, role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle(),
    supabase
      .from("provinces")
      .select("id, name, user_id, kingdom_id, kd_code")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    user,
    registered: !!province || !!admin,
    owner: !!admin,
    province: province || null,
  };
}

export async function signOutDashboard() {
  await supabase.auth.signOut();
  sessionStorage.removeItem("nexus_auth");
}
