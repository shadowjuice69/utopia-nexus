require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function check() {
  const tables = [
    "provinces",
    "intel_military",
    "intel_throne",
    "kingdom_members"
  ];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .limit(1);

    console.log("\nTABLE:", table);

    if (error) {
      console.log("ERROR:", error.message);
    } else {
      console.log(data);
    }
  }
}

check();
