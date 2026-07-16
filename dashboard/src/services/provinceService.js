import { supabase } from "./supabase";

export async function getProvinces() {
  const { data, error } = await supabase
    .from("provinces")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Province fetch error:", error);
    return [];
  }

  return data || [];
}

export function subscribeToProvinces(callback) {
  return supabase
    .channel("province-updates")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "provinces"
      },
      () => {
        callback();
      }
    )
    .subscribe();
}
