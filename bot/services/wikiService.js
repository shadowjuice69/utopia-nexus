const supabaseService = require("./supabase");

async function searchWiki(question) {
  const supabase = supabaseService.getClient();

  if (!supabase) {
    return null;
  }

  const searchTerm = question.toLowerCase().trim();

  // First try exact title match
  const { data: exactMatch, error: exactError } = await supabase
    .from("wiki_entries")
    .select("*")
    .ilike("title", searchTerm)
    .limit(1);

  if (!exactError && exactMatch && exactMatch.length > 0) {
    return exactMatch;
  }

  // Try full-text search vector
  const { data: ftsData, error: ftsError } = await supabase
    .from("wiki_entries")
    .select("*")
    .textSearch("search_vector", searchTerm, {
      type: "websearch",
      config: "english"
    })
    .limit(3);

  if (!ftsError && ftsData && ftsData.length > 0) {
    return ftsData;
  }

  // Fallback to ilike on title, keywords and content
  const { data, error } = await supabase
    .from("wiki_entries")
    .select("*")
    .or(
      `title.ilike.%${searchTerm}%,keywords.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`
    )
    .limit(3);

  if (error) {
    console.error("Wiki search error:", error);
    return null;
  }

  return data;
}

function getWikiLink() {
  return "https://shadowjuice69.github.io/utopia-war-room/utopia-wiki.html";
}

module.exports = {
  searchWiki,
  getWikiLink,
};
