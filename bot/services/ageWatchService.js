const supabaseService = require("./supabase");
const logger = require("./logger");

let lastKnownAge = null;

async function detectAndResetAge(client) {
  const supabase = supabaseService.getClient();
  if (!supabase) return;

  try {
    const { data: setting } = await supabase
      .from("bot_settings")
      .select("value")
      .eq("key", "current_age")
      .limit(1);

    const currentAge = setting?.[0]?.value || null;
    if (!lastKnownAge) { lastKnownAge = currentAge; return; }
    if (currentAge === lastKnownAge) return;

    logger.info(`[AGE WATCH] Age changed: ${lastKnownAge} → ${currentAge}. Auto-resetting...`);
    lastKnownAge = currentAge;

    await Promise.all([
      supabase.from("attacks").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase.from("hostile_ops").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase.from("intel_throne").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase.from("intel_military").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase.from("intel_buildings").delete().neq("id", "00000000-0000-0000-0000-000000000000"),
      supabase.from("wars").update({ active: false }).eq("active", true),
    ]);

    logger.info(`[AGE WATCH] Reset complete for age ${currentAge}`);

    const { data: settings } = await supabase
      .from("bot_settings")
      .select("value")
      .eq("key", "alert_channel")
      .limit(1);

    const channelId = settings?.[0]?.value;
    if (channelId) {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (channel) await channel.send(`🔄 **New Age Detected (Age ${currentAge})** — All war data has been reset. Good luck!`);
    }
  } catch(e) {
    logger.error(`[AGE WATCH] Error: ${e.message}`);
  }
}

function startAgeWatch(client) {
  setInterval(() => detectAndResetAge(client), 5 * 60 * 1000);
  logger.info(`[AGE WATCH] Watching for age changes every 5 minutes`);
}

module.exports = { startAgeWatch };
