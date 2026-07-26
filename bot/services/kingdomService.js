const supabaseService = require("./supabase");

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

async function getKingdomInfo() {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;

  const supabase = supabaseService.getClient();
  if (!supabase) return { name: "Judo", code: "4:9", age: "116" };

  const { data } = await supabase
    .from("bot_settings")
    .select("key, value")
    .in("key", ["kingdom_name", "kingdom_code", "current_age"]);

  if (!data) return { name: "Judo", code: "4:9", age: "116" };

  const settings = {};
  for (const row of data) settings[row.key] = row.value;

  cache = {
    name: settings.kingdom_name || "Judo",
    code: settings.kingdom_code || "4:9",
    age:  settings.current_age  || "116",
    footer: `${settings.kingdom_name || "Judo"} Kingdom (${settings.kingdom_code || "4:9"}) • WoL Age ${settings.current_age || "116"} • Utopia Nexus`,
  };
  cacheTime = Date.now();
  return cache;
}

async function setKingdomInfo(name, code) {
  const supabase = supabaseService.getClient();
  if (!supabase) return false;

  await supabase.from("bot_settings").upsert([
    { key: "kingdom_name", value: name },
    { key: "kingdom_code", value: code },
  ], { onConflict: "key" });

  cache = null; // invalidate cache
  return true;
}

module.exports = { getKingdomInfo, setKingdomInfo };
