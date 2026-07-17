require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function check() {
  const tables = [
    "age_updates",
    "pending_changes",
    "rule_history"
  ];

  for (const table of tables) {
    console.log("\nTABLE:", table);

    const { data, error } = await supabase
      .from(table)
      .select("*")
      .limit(1);

    if (error) {
      console.log("ERROR:", error.message);
    } else {
      console.log(data);
    }
  }
}

check();
