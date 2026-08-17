import { supabase } from "./supabase";
import { evaluateAuthorization } from "./authorizationPolicy";

const PASSWORD = "NikkoAce";

async function findRegisteredProvince(provinceName, userId = null) {
  const requestedProvince = String(provinceName ?? "").trim();

  // Registration is keyed by the Nexus province record. The historical
  // provinces.user_id field contains the Discord/user identifier, not
  // necessarily the Supabase Auth UUID, so do not require those IDs to match.
  const { data, error } = await supabase.rpc("nexus_registration_lookup", {
    province_name: requestedProvince,
  });

  if (error) return { data: null, error };
  return { data: data?.[0] ?? null, error: null };
}

export async function getDashboardAuthorization(provinceName, password) {
  const requestedProvince = String(provinceName ?? "").trim();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (user && !userError) {
    const { data: admin } = await supabase
      .from("nexus_admins")
      .select("user_id, role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle();

    if (admin) {
      return {
        allowed: true,
        reason: "owner-emergency",
        owner: true,
        user,
        province: null,
      };
    }
  }

  const { data: registeredProvince, error: registrationError } =
    await findRegisteredProvince(requestedProvince);

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
  const savedProvince = sessionStorage.getItem("nexus_province") || "";
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (user && !userError) {
    const { data: admin } = await supabase
      .from("nexus_admins")
      .select("user_id, role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle();

    if (admin) {
      return { user, registered: true, owner: true, province: null };
    }
  }

  if (!savedProvince) {
    return { user: user || null, registered: false, owner: false, province: null };
  }

  const { data: province } = await findRegisteredProvince(savedProvince);
  return {
    user: user || null,
    registered: !!province,
    owner: false,
    province: province || null,
  };
}

export async function signOutDashboard() {
  await supabase.auth.signOut();
  sessionStorage.removeItem("nexus_auth");
  sessionStorage.removeItem("nexus_province");
}
