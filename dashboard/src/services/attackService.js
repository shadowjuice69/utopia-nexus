import { supabase } from "./supabase";

export async function getAttacks() {
  const { data, error } = await supabase
    .from("attacks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Attack fetch error:", error);
    return [];
  }

  return data || [];
}

export function subscribeToAttacks(callback) {
  return supabase
    .channel("attack-updates")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "attacks"
      },
      () => {
        callback();
      }
    )
    .subscribe();
}

export async function getProvinceAttackStatus(provinceName) {
  const { data, error } = await supabase
    .from("attacks")
    .select("*")
    .eq("target_province", provinceName)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Attack status error:", error);
    return null;
  }

  return data?.[0] || null;
}
