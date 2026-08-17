import { supabase } from "./supabase";

export async function getDashboardRegistration() {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { user: null, registered: false };

  const { data: memberships, error: membershipError } = await supabase
    .from("kingdom_members")
    .select("kd_code")
    .eq("user_id", user.id)
    .limit(1);

  return {
    user,
    registered: !membershipError && Array.isArray(memberships) && memberships.length > 0,
  };
}

export async function signOutDashboard() {
  await supabase.auth.signOut();
  sessionStorage.removeItem("nexus_auth");
}
