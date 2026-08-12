const supabaseService = require("./supabase");

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 60000;

async function getKingdomInfo() {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;

  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("bot_settings")
    .select("key, value")
    .in("key", [
      "kingdom_name",
      "kingdom_code",
      "current_age",
      "kingdom_personality"
    ]);

  if (!data) return null;

  const settings = {};
  for (const row of data) settings[row.key] = row.value;

  cache = {
    name: settings.kingdom_name,
    code: settings.kingdom_code,
    age: settings.current_age,
    personality: settings.kingdom_personality,
    footer: `${settings.kingdom_name} Kingdom (${settings.kingdom_code}) • WoL Age ${settings.current_age} • Utopia Nexus`,
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

  cache = null;
  return true;
}

module.exports = { getKingdomInfo, setKingdomInfo };
