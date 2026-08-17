import { supabase } from "./supabase";
import { evaluateAuthorization } from "./authorizationPolicy";

const PASSWORD = "NikkoAce";

async function findRegisteredProvince(provinceName, userId = null) {
  const requestedProvince = String(provinceName ?? "").trim();
  let query = supabase
    .from("provinces")
    .select("id, name, user_id, kingdom_id, kd_code")
    .eq("name", requestedProvince);

  if (userId) query = query.eq("user_id", userId);
  return query.maybeSingle();
}

export async function getDashboardAuthorization(provinceName, password) {
  const requestedProvince = String(provinceName ?? "").trim();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (user && !userError) {
    const [{ data: admin }, { data: province, error: provinceError }] = await Promise.all([
      supabase
        .from("nexus_admins")
        .select("user_id, role")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .maybeSingle(),
      findRegisteredProvince(requestedProvince, user.id),
    ]);

    const decision = evaluateAuthorization({
      authenticated: true,
      provinceName: requestedProvince,
      password,
      registeredProvince: provinceError ? null : province,
      isOwner: !!admin,
      expectedPassword: PASSWORD,
    });

    if (decision.allowed) {
      return { ...decision, user, province: provinceError ? null : province };
    }
  }

  // Normal registration is anchored to the registered province itself. This
  // allows the dashboard to work in a fresh browser without requiring the
  // setup site's Supabase session to be present in this Vercel origin.
  const { data: registeredProvince, error: registrationError } = await findRegisteredProvince(requestedProvince);

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

  if (user && !userError) {
    const [{ data: admin }, { data: province }] = await Promise.all([
      supabase
        .from("nexus_admins")
        .select("user_id, role")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .maybeSingle(),
      findRegisteredProvince(sessionStorage.getItem("nexus_province") || "", user.id),
    ]);

    return {
      user,
      registered: !!province || !!admin,
      owner: !!admin,
      province: province || null,
    };
  }

  const savedProvince = sessionStorage.getItem("nexus_province");
  if (!savedProvince) return { user: null, registered: false, owner: false, province: null };

  const { data: province } = await findRegisteredProvince(savedProvince);
  return {
    user: null,
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
