#!/data/data/com.termux/files/usr/bin/bash
# Run from your BOT repo root (not Spartan): cd ~/utopia-nexus && bash repoint-invest-to-spartan-builds.sh
#
# This repoints /spartan-calc invest (and its build-picker select-menu flow) from
# the old ai_builds table to the new spartan_builds Build Library you built in
# Spartan's web UI. No new Discord command or re-registration needed — invest is
# already wired up, and investHandler.js / investInteractionHandler.js only
# consume this service's exported functions, so they don't need to change.
#
# The science-allocation math is upgraded too: spartan_builds stores science as
# category-nested weights, with support for a fixed "actual_pct" target (like
# Artisan) that comes off the top before the rest splits by weight — the old
# ai_builds format didn't have that concept.
set -e

echo "→ bot/services/scienceInvestService.js (overwrite)"
cat > bot/services/scienceInvestService.js << 'EOF'
const supabaseService = require("./supabase");

async function listInvestBuilds({ search = "", page = 0, pageSize = 25 } = {}) {
  const supabase = supabaseService.getClient();
  if (!supabase) throw new Error("Supabase is not configured on the bot.");
  const offset = Math.max(0, Number(page) || 0) * pageSize;
  let query = supabase.from("spartan_builds")
    .select("id, name, race, personality, science", { count: "exact" })
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .range(offset, offset + pageSize - 1);
  const term = String(search || "").replace(/[%_,]/g, " ").trim();
  if (term) query = query.or(`name.ilike.%${term}%,race.ilike.%${term}%,personality.ilike.%${term}%`);
  const { data, count, error } = await query;
  if (error) throw error;
  return { builds: data || [], total: count || 0 };
}

async function getBuildById(buildId) {
  const supabase = supabaseService.getClient();
  const { data, error } = await supabase.from("spartan_builds")
    .select("id, name, race, personality, science")
    .eq("id", buildId).eq("active", true).maybeSingle();
  if (error) throw error;
  return data;
}

// spartan_builds.science is category-nested: { economy: { Name: {type:'weight'|'actual_pct', value} }, military: {...}, arcane: {...} }
// Fixed "actual_pct" entries (e.g. Artisan) come off the top as a target share; the
// remainder splits by weight across everything else in that category.
function calculateCategoryAllocation(entries, totalBooks) {
  const names = Object.keys(entries || {});
  const fixed = names.filter((n) => entries[n]?.type === "actual_pct");
  const weighted = names.filter((n) => entries[n]?.type === "weight");
  const rows = [];
  let usedByFixed = 0;
  for (const name of fixed) {
    const pct = Number(entries[name].value) || 0;
    const allocated = Math.round(totalBooks * (pct / 100));
    usedByFixed += allocated;
    rows.push({ name, weight: pct, allocated, effect: `(fixed ${pct}% target)` });
  }
  const remaining = Math.max(0, totalBooks - usedByFixed);
  const sumWeights = weighted.reduce((s, n) => s + (Number(entries[n].value) || 0), 0);
  const perUnit = sumWeights > 0 ? remaining / sumWeights : 0;
  for (const name of weighted) {
    const weight = Number(entries[name].value) || 0;
    rows.push({ name, weight, allocated: Math.round(weight * perUnit), effect: "" });
  }
  return { rows, sumWeights, perUnit };
}

async function calculateForBuild(build, categoryBooks) {
  if (!build) return { error: "The selected build no longer exists or is inactive." };
  const science = build.science || {};
  const results = {};
  for (const cat of ["economy", "military", "arcane"]) {
    const entries = science[cat];
    if (!entries || !Object.keys(entries).length) continue;
    const books = Number(categoryBooks[cat]) || 0;
    if (books <= 0) continue;
    const { rows, sumWeights, perUnit } = calculateCategoryAllocation(entries, books);
    if (!rows.length) continue;
    results[cat] = { books, sumWeights, perUnit, rows };
  }
  if (Object.keys(results).length === 0) return { error: `Build "${build.name}" has no science guide defined, or no books were entered for any category.` };
  return { buildName: build.name, results };
}

async function calculateInvestById(buildId, categoryBooks) {
  return calculateForBuild(await getBuildById(buildId), categoryBooks);
}

async function calculateInvest(buildName, categoryBooks) {
  const supabase = supabaseService.getClient();
  const { data: builds, error } = await supabase.from("spartan_builds")
    .select("id, name, race, personality, science")
    .eq("active", true).ilike("name", `%${buildName}%`);
  if (error || !builds || builds.length === 0) return { error: `No build found matching "${buildName}".` };
  if (builds.length > 1) return { error: "Multiple builds matched. Choose the exact build from the Build Library." };
  return calculateForBuild(builds[0], categoryBooks);
}

module.exports = { calculateInvest, calculateInvestById, listInvestBuilds };
EOF

echo ""
echo "Done. /spartan-calc invest now pulls from your Spartan Build Library instead of"
echo "the old ai_builds table. Try it: /spartan-calc invest build:<name> economy_books:20000"
echo ""
echo "Next: git add -A && git commit -m 'Repoint invest command at Spartan Build Library' "
echo "      git fetch && git merge origin/main && git push"
