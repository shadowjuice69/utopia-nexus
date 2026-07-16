import { supabase } from "./supabase";

export async function getWaves() {
  const { data, error } = await supabase
    .from("wave_assignments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Wave fetch error:", error);
    return [];
  }

  return data || [];
}

export function subscribeToWaves(callback) {
  return supabase
    .channel("wave-updates")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "wave_assignments"
      },
      () => {
        callback();
      }
    )
    .subscribe();
}
