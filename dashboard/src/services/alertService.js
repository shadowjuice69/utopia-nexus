import { supabase } from "./supabase";

export async function getAlerts() {
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Alert fetch error:", error);
    return [];
  }

  return data || [];
}

export function subscribeToAlerts(callback) {
  return supabase
    .channel("alert-updates")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "alerts"
      },
      () => {
        callback();
      }
    )
    .subscribe();
}
