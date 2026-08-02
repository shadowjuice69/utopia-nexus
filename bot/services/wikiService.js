const supabaseService = require("./supabase");

async function searchWiki(question) {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;
  let searchTerm = question.toLowerCase().trim();

  const stopWords = [
    "what","does","do","is","are","the","a","an",
    "should","i","use","in","during","war","age",
    "how","why","can","my","with"
  ];

  const words = searchTerm
    .replace(/[^\\w\\s']/g, "")
    .split(/\\s+/)
    .filter(w => !stopWords.includes(w));

  searchTerm = words.join(" ");
  const { data: exactMatch } = await supabase
    .from("wiki_entries").select("*").ilike("title", searchTerm).limit(1);
  if (exactMatch && exactMatch.length > 0) return exactMatch;
  const { data: ftsData } = await supabase
    .from("wiki_entries").select("*")
    .textSearch("search_vector", searchTerm, { type: "websearch", config: "english" }).limit(2);
  if (ftsData && ftsData.length > 0) return ftsData;
  const { data, error } = await supabase
    .from("wiki_entries").select("*")
    .or(`title.ilike.%${searchTerm}%,keywords.ilike.%${searchTerm}%`).limit(2);
  if (error) { console.error("Wiki search error:", error); return null; }
  return data;
}

async function searchRules(question) {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;
  let q = question.toLowerCase().trim();

  const stopWords = [
    "what","does","do","is","are","the","a","an",
    "should","i","use","in","during","war","age",
    "how","why","can","my","with","wiki","data"
  ];

  const words = q
    .replace(/[^\\w\\s']/g, "")
    .split(/\\s+/)
    .filter(w => !stopWords.includes(w));


  q = words.join(" ");

  // Search each word individually to handle apostrophes and partial matches
  const searchWords = words.filter(w => w.length > 2);
  let exactSpells = [];
  for (const word of searchWords) {
    const { data: wordResults } = await supabase
      .from("spell_rules")
      .select("spell_name, rule_name, value, description")
      .ilike("spell_name", `%${word}%`)
      .eq("active", true);
    if (wordResults && wordResults.length > 0) {
      exactSpells = [...exactSpells, ...wordResults];
    }
  }
  // Deduplicate
  exactSpells = exactSpells.filter((v, i, a) => a.findIndex(t => t.spell_name === v.spell_name && t.rule_name === v.rule_name) === i);

  console.log("[SPELL SEARCH]", q, exactSpells);

  if (exactSpells && exactSpells.length > 0) {
    lines.push(`🔮 **Spell Rules (Age 116)**`);
    for (const row of exactSpells) {
      lines.push(`• **${row.spell_name}** — ${row.rule_name}: ${row.value}`);
      if (row.description) lines.push(`  ${row.description}`);
    }
    lines.push('');
  }

  const lines = [];

  const { data: raceData } = await supabase
    .from("race_rules").select("race_name, rule_name, value, age_number")
    .ilike("race_name", `%${q}%`).limit(10);
  if (raceData && raceData.length > 0) {
    lines.push(`⚔️ **${raceData[0].race_name} (Age ${raceData[0].age_number} Rules)**`);
    for (const row of raceData) lines.push(`• ${row.rule_name}: ${row.value}`);
    lines.push('');
  }

  const { data: persData } = await supabase
    .from("personality_rules").select("personality_name, rule_name, value, age_number")
    .ilike("personality_name", `%${q}%`).limit(10);
  if (persData && persData.length > 0) {
    lines.push(`🎭 **${persData[0].personality_name} Rules**`);
    for (const row of persData) lines.push(`• ${row.rule_name}: ${row.value}`);
    lines.push('');
  }

  const { data: gameData } = await supabase
    .from("game_rules").select("category, rule_name, value")
    .ilike("value", `%${q}%`).limit(3);
  if (gameData && gameData.length > 0) {
    lines.push(`📋 **Related Game Rules**`);
    for (const row of gameData) lines.push(`• [${row.category}] ${row.value}`);
    lines.push('');
  }

  const { data: scienceData } = await supabase
    .from("science_rules")
    .select("science_name, category, effect, multiplier, race_modifier, personality_modifier, notes")
    .or(`science_name.ilike.%${q}%,effect.ilike.%${q}%,category.ilike.%${q}%`)
    .eq("active", true).limit(5);
  if (scienceData && scienceData.length > 0) {
    lines.push(`🔬 **Science (Age 116)**`);
    for (const row of scienceData) {
      let line = `• **${row.science_name}** [${row.category}] — ${row.effect} (×${row.multiplier})`;
      if (row.race_modifier)        line += ` | Race: ${row.race_modifier}`;
      if (row.personality_modifier) line += ` | Pers: ${row.personality_modifier}`;
      if (row.notes)                line += ` ⚠️ ${row.notes}`;
      lines.push(line);
    }
    lines.push('');
  }

  const { data: spellData } = await supabase
    .from("spell_rules").select("spell_name, rule_name, value, description")
    .or(`spell_name.ilike.%${q}%,description.ilike.%${q}%`)
    .eq("active", true).limit(6);
  if (spellData && spellData.length > 0) {
    lines.push(`🔮 **Spell Rules (Age 116)**`);
    const grouped = {};
    for (const row of spellData) {
      if (!grouped[row.spell_name]) grouped[row.spell_name] = [];
      grouped[row.spell_name].push(`${row.rule_name}: ${row.value}`);
    }
    for (const [spell, rules] of Object.entries(grouped)) {
      lines.push(`• **${spell}** — ${rules.join(' | ')}`);
    }
    lines.push('');
  }

  console.log("[SEARCH RULES QUERY]", q);
  console.log("[SEARCH RULES RESULTS]", lines);

  return lines.length > 0 ? lines.join('\n') : null;
}

async function searchScience(type) {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;
  if (type === 'all') {
    const { data } = await supabase
      .from("science_rules").select("*").eq("active", true)
      .order("category").order("science_name");
    return data;
  }
  const { data } = await supabase
    .from("science_rules").select("*")
    .or(`science_name.ilike.%${type}%,category.ilike.%${type}%`)
    .eq("active", true).limit(5);
  return data;
}

function getWikiLink() {
  return "https://shadowjuice69.github.io/utopia-war-room/utopia-wiki.html";
}

module.exports = { searchWiki, searchRules, searchScience, getWikiLink };
