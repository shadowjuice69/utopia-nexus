const supabaseService = require("./supabase");

async function calculateInvest(buildName, categoryBooks) {
  const supabase = supabaseService.getClient();

  const { data: builds, error } = await supabase
    .from("ai_builds")
    .select("id, name, race, personality, build_type, science")
    .eq("active", true)
    .ilike("name", `%${buildName}%`);

  if (error || !builds || builds.length === 0) {
    return { error: `No build found matching "${buildName}".` };
  }
  if (builds.length > 1) {
    return { error: `Multiple builds match "${buildName}": ${builds.map(b => b.name).join(", ")}. Be more specific.` };
  }

  const build = builds[0];
  if (!build.science || Object.keys(build.science).length === 0) {
    return { error: `Build "${build.name}" has no science guide defined.` };
  }

  const { data: rules } = await supabase
    .from("science_rules")
    .select("science_name, effect")
    .eq("active", true);

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
    results[cat] = {
      books,
      sumWeights,
      perUnit,
      rows: rows.map(r => ({
        name: r.name,
        weight: r.weight,
        allocated: Math.round(r.weight * perUnit),
        effect: effectMap[r.name.toLowerCase()] || ""
      }))
    };
  }

  if (Object.keys(results).length === 0) {
    return { error: "No books entered for any category." };
  }

  return { buildName: build.name, results };
}

module.exports = { calculateInvest };
