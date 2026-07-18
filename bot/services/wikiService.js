const supabaseService = require("./supabase");

async function searchWiki(question) {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  const searchTerm = question.toLowerCase().trim();

  // 1. Exact title match - return ONLY this if found
  const { data: exactMatch } = await supabase
    .from("wiki_entries")
    .select("*")
    .ilike("title", searchTerm)
    .limit(1);

  if (exactMatch && exactMatch.length > 0) return exactMatch;

  // 2. FTS - return top 2 only
  const { data: ftsData } = await supabase
    .from("wiki_entries")
    .select("*")
    .textSearch("search_vector", searchTerm, { type: "websearch", config: "english" })
    .limit(2);

  if (ftsData && ftsData.length > 0) return ftsData;

  // 3. Fallback - title and keywords only, NOT content
  const { data, error } = await supabase
    .from("wiki_entries")
    .select("*")
    .or(`title.ilike.%${searchTerm}%,keywords.ilike.%${searchTerm}%`)
    .limit(2);

  if (error) { console.error("Wiki search error:", error); return null; }
  return data;
}

async function searchRules(question) {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  const q = question.toLowerCase().trim();
  const lines = [];

  const { data: raceData } = await supabase
    .from("race_rules")
    .select("race_name, rule_name, value, age_number")
    .ilike("race_name", `%${q}%`)
    .limit(10);

  if (raceData && raceData.length > 0) {
    lines.push(`⚔️ **${raceData[0].race_name} (Age ${raceData[0].age_number} Rules)**`);
    for (const row of raceData) lines.push(`• ${row.rule_name}: ${row.value}`);
    lines.push('');
  }

  const { data: persData } = await supabase
    .from("personality_rules")
    .select("personality_name, rule_name, value, age_number")
    .ilike("personality_name", `%${q}%`)
    .limit(10);

  if (persData && persData.length > 0) {
    lines.push(`🎭 **${persData[0].personality_name} Rules**`);
    for (const row of persData) lines.push(`• ${row.rule_name}: ${row.value}`);
    lines.push('');
  }

  const { data: gameData } = await supabase
    .from("game_rules")
    .select("category, rule_name, value")
    .ilike("value", `%${q}%`)
    .limit(3);

  if (gameData && gameData.length > 0) {
    lines.push(`📋 **Related Game Rules**`);
    for (const row of gameData) lines.push(`• [${row.category}] ${row.value}`);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

function getWikiLink() {
  return "https://shadowjuice69.github.io/utopia-war-room/utopia-wiki.html";
}

module.exports = { searchWiki, searchRules, getWikiLink };
