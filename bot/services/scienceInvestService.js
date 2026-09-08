const supabaseService = require("./supabase");

async function listInvestBuilds({ search = "", page = 0, pageSize = 25 } = {}) {
  const supabase = supabaseService.getClient();
  if (!supabase) throw new Error("Supabase is not configured on the bot.");
  const offset = Math.max(0, Number(page) || 0) * pageSize;
  let query = supabase.from("ai_builds")
    .select("id, name, race, personality, build_type, science", { count: "exact" })
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .range(offset, offset + pageSize - 1);
  const term = String(search || "").replace(/[%_,]/g, " ").trim();
  if (term) query = query.or(`name.ilike.%${term}%,race.ilike.%${term}%,personality.ilike.%${term}%,build_type.ilike.%${term}%`);
  const { data, count, error } = await query;
  if (error) throw error;
  return { builds: data || [], total: count || 0 };
}

async function getBuildById(buildId) {
  const supabase = supabaseService.getClient();
  const { data, error } = await supabase.from("ai_builds")
    .select("id, name, race, personality, build_type, science")
    .eq("id", buildId).eq("active", true).maybeSingle();
  if (error) throw error;
  return data;
}

async function calculateForBuild(build, categoryBooks) {
  if (!build) return { error: "The selected build no longer exists or is inactive." };
  if (!build.science || Object.keys(build.science).length === 0) return { error: `Build "${build.name}" has no science guide defined.` };
  const supabase = supabaseService.getClient();
  const { data: rules } = await supabase.from("science_rules").select("science_name, effect").eq("active", true);
  const effectMap = {};
  (rules || []).forEach(r => { effectMap[r.science_name.toLowerCase()] = r.effect; });
  const entries = Object.entries(build.science).filter(([, v]) => v && Number(v.books) > 0);
  const byCategory = {};
  entries.forEach(([name, v]) => {
    const cat = v.category || "other";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({ name, weight: Number(v.books) });
  });
  Object.values(byCategory).forEach(rows => rows.sort((a, b) => b.weight - a.weight));
  const results = {};
  for (const [cat, rows] of Object.entries(byCategory)) {
    const books = Number(categoryBooks[cat]) || 0;
    if (books <= 0) continue;
    const sumWeights = rows.reduce((s, r) => s + r.weight, 0);
    if (sumWeights === 0) continue;
    const perUnit = books / sumWeights;
    results[cat] = { books, sumWeights, perUnit, rows: rows.map(r => ({ name: r.name, weight: r.weight, allocated: Math.round(r.weight * perUnit), effect: effectMap[r.name.toLowerCase()] || "" })) };
  }
  if (Object.keys(results).length === 0) return { error: "No books entered for any category." };
  return { buildName: build.name, results };
}

async function calculateInvestById(buildId, categoryBooks) {
  return calculateForBuild(await getBuildById(buildId), categoryBooks);
}

async function calculateInvest(buildName, categoryBooks) {
  const supabase = supabaseService.getClient();
  const { data: builds, error } = await supabase.from("ai_builds")
    .select("id, name, race, personality, build_type, science")
    .eq("active", true).ilike("name", `%${buildName}%`);
  if (error || !builds || builds.length === 0) return { error: `No build found matching "${buildName}".` };
  if (builds.length > 1) return { error: "Multiple builds matched. Choose the exact build from the Build Library." };
  return calculateForBuild(builds[0], categoryBooks);
}

module.exports = { calculateInvest, calculateInvestById, listInvestBuilds };
