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
