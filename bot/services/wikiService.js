const supabaseService = require("./supabase");

async function searchWiki(question) {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  const searchTerm = question.toLowerCase().trim();

  const { data: exactMatch } = await supabase
    .from("wiki_entries")
    .select("*")
    .ilike("title", searchTerm)
    .limit(1);

  if (exactMatch && exactMatch.length > 0) return exactMatch;

  const { data: ftsData } = await supabase
    .from("wiki_entries")
    .select("*")
    .textSearch("search_vector", searchTerm, { type: "websearch", config: "english" })
    .limit(3);

  if (ftsData && ftsData.length > 0) return ftsData;

  const { data, error } = await supabase
    .from("wiki_entries")
    .select("*")
    .or(`title.ilike.%${searchTerm}%,keywords.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`)
    .limit(3);

  if (error) { console.error("Wiki search error:", error); return null; }
  return data;
}

async function searchRules(question) {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  const q = question.toLowerCase().trim();
  const lines = [];

  // Check race rules
  const { data: raceData } = await supabase
    .from("race_rules")
    .select("race_name, rule_name, value")
    .ilike("race_name", `%${q}%`)
    .limit(10);

  if (raceData && raceData.length > 0) {
    const raceName = raceData[0].race_name;
    lines.push(`⚔️ **${raceName} (Age ${raceData[0].age_number || ''} Rules)**`);
    for (const row of raceData) {
      lines.push(`• ${row.rule_name}: ${row.value}`);
    }
    lines.push('');
  }

  // Check personality rules
  const { data: persData } = await supabase
    .from("personality_rules")
    .select("personality_name, rule_name, value")
    .ilike("personality_name", `%${q}%`)
    .limit(10);

  if (persData && persData.length > 0) {
    const pName = persData[0].personality_name;
    lines.push(`🎭 **${pName} Rules**`);
    for (const row of persData) {
      lines.push(`• ${row.rule_name}: ${row.value}`);
    }
    lines.push('');
  }

  // Check game rules by value content
  const { data: gameData } = await supabase
    .from("game_rules")
    .select("category, rule_name, value")
    .ilike("value", `%${q}%`)
    .limit(5);

  if (gameData && gameData.length > 0) {
    lines.push(`📋 **Related Game Rules**`);
    for (const row of gameData) {
      lines.push(`• [${row.category}] ${row.value}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

function getWikiLink() {
  return "https://shadowjuice69.github.io/utopia-war-room/utopia-wiki.html";
}

module.exports = { searchWiki, searchRules, getWikiLink };
