require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const fs = require("fs");
const supabaseService = require("../services/supabase");

async function run() {
  const supabase = supabaseService.getClient();

  if (!supabase) {
    console.error("❌ Supabase not connected");
    process.exit(1);
  }

  const csv = fs.readFileSync("wiki_entries.csv", "utf8");

  const lines = csv
    .split("\n")
    .slice(1)
    .filter(Boolean);

  const entries = lines.map(line => {
    const parts = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)
      .map(v => v.replace(/^"|"$/g, ""));

    return {
      title: parts[0],
      category: parts[1],
      content: parts[2],
      keywords: parts[3],
      source: parts[4]
    };
  });

  console.log(`Importing ${entries.length} wiki entries...`);

  const { error } = await supabase
    .from("wiki_entries")
    .insert(entries);

  if (error) {
    console.error("❌ Import failed:", error.message);
    process.exit(1);
  }

  console.log("✅ Wiki entries imported");
}

run();
