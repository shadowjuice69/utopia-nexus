const fs = require("fs");

const file = "bot/services/wikiService.js";

let data = fs.readFileSync(file, "utf8");

const oldBlock = `// 1. Exact title match - return ONLY this if found
  const { data: exactMatch } = await supabase
    .from("wiki_entries")
    .select("*")
    .ilike("title", searchTerm)
    .limit(1);

  if (exactMatch && exactMatch.length > 0) return exactMatch;`;

const newBlock = `// 1. Exact title match
  const { data: exactMatch } = await supabase
    .from("wiki_entries")
    .select("*")
    .ilike("title", searchTerm)
    .limit(5);

  if (exactMatch && exactMatch.length > 0) return exactMatch;

  // 2. Title priority match
  const { data: titleMatch } = await supabase
    .from("wiki_entries")
    .select("*")
    .ilike("title", \`%${searchTerm}%\`)
    .limit(5);

  if (titleMatch && titleMatch.length > 0) return titleMatch;`;

if (!data.includes(oldBlock)) {
  console.log("❌ Target block not found");
  process.exit(1);
}

data = data.replace(oldBlock, newBlock);

fs.writeFileSync(file, data);

console.log("✅ wikiService.js patched");
