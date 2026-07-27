import { supabase } from "./supabase";

export async function getProvinces() {
  const [
    { data: provinces, error: provinceError },
    { data: throne, error: throneError },
    { data: military, error: militaryError },
    { data: buildings, error: buildingsError },
    { data: science, error: scienceError }
  ] = await Promise.all([
    supabase.from("provinces").select("*").order("created_at", { ascending: false }),
    supabase.from("intel_throne").select("*"),
    supabase.from("intel_military").select("*"),
    supabase.from("intel_buildings").select("*"),
    supabase.from("intel_science").select("*")
  ]);

  if (provinceError) console.error("Province fetch error:", provinceError);
  if (throneError) console.error("Throne fetch error:", throneError);
  if (militaryError) console.error("Military fetch error:", militaryError);
  if (buildingsError) console.error("Buildings fetch error:", buildingsError);
  if (scienceError) console.error("Science fetch error:", scienceError);

  return (provinces || []).map((province) => {
    const t = (throne || []).find(
      x => x.province === province.name
    );

    const m = (military || []).find(
      x => x.province === province.name
    );

    const b = (buildings || []).find(
      x => x.province === province.name
    );

    const s = (science || []).find(
      x => x.province === province.name
    );

    return {
      ...province,
      throne: t || null,
      military: m || null,
      buildings: b || null,
      science: s || null,
      spells: t?.spells || "No intel"
    };
  });
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
