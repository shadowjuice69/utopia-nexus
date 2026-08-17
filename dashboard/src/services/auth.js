import { supabase } from "./supabase";
import { evaluateAuthorization } from "./authorizationPolicy";

const PASSWORD = "NikkoAce";

export async function getDashboardAuthorization(provinceName, password) {
  const requestedProvince = String(provinceName ?? "").trim();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  // Owner emergency access is identity-based and still requires an authenticated
  // Supabase session. Normal registered-province access must not depend on a
  // browser carrying the same Supabase session that existed during registration.
  if (user && !userError) {
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
        .eq("name", requestedProvince)
        .maybeSingle(),
    ]);

    const decision = evaluateAuthorization({
      authenticated: true,
      provinceName: requestedProvince,
      password,
      registeredProvince: provinceError ? null : province,
      isOwner: !!admin,
      expectedPassword: PASSWORD,
    });

    if (decision.allowed || decision.reason === "owner-emergency") {
      return {
        ...decision,
        user,
        province: provinceError ? null : province,
      };
    }
  }

  // Registration is represented by the province record. Fall back to the
  // registered province lookup when there is no current Supabase session (for
  // example after opening the Vercel dashboard in a fresh browser/device).
  const { data: registeredProvince, error: registrationError } = await supabase
    .from("provinces")
    .select("id, name, user_id, kingdom_id, kd_code")
    .eq("name", requestedProvince)
    .maybeSingle();

  const decision = evaluateAuthorization({
    authenticated: true,
    provinceName: requestedProvince,
    password,
    registeredProvince: registrationError ? null : registeredProvince,
    isOwner: false,
    expectedPassword: PASSWORD,
  });

  return {
    ...decision,
    user: userError ? null : user,
    province: registrationError ? null : registeredProvince,
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
