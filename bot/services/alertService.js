const supabaseService = require("./supabase");
const logger = require("./logger");

const TICK_START_UTC = 19;

function getCurrentTick() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  return ((utcHour - TICK_START_UTC) % 24 + 24) % 24 + 1;
}

function msUntilNextTick() {
  const now = new Date();
  const ms = (60 - now.getUTCMinutes()) * 60000 - now.getUTCSeconds() * 1000 - now.getUTCMilliseconds();
  return ms;
}

async function checkAlerts(client) {
  const supabase = supabaseService.getClient();
  if (!supabase) return;

  const tick = getCurrentTick();
  logger.info(`[ALERT] Checking tick ${tick}`);

  const { data: alerts, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("active", true);

  if (error || !alerts?.length) return;

  for (const alert of alerts) {
    if (!alert.ticks.includes(tick)) continue;
    try {
      const channel = await client.channels.fetch(alert.channel_id);
      if (!channel) continue;
      const ping = alert.ping_role ? `<@&${alert.ping_role}> ` : "@here ";
      await channel.send(`${ping}⏰ **Tick ${tick} Alert — ${alert.label}**\n${alert.message}`);
      logger.info(`[ALERT] Fired: ${alert.label} at tick ${tick}`);
    } catch(e) {
      logger.error(`[ALERT] Failed to send ${alert.label}: ${e.message}`);
    }
  }
}

function startAlertLoop(client) {
  async function loop() {
    await checkAlerts(client);
    const wait = msUntilNextTick();
    logger.info(`[ALERT] Next check in ${Math.round(wait/60000)}m`);
    setTimeout(loop, wait + 2000);
  }
  const wait = msUntilNextTick();
  setTimeout(loop, wait + 2000);
  logger.info(`[ALERT] Loop started — first check in ${Math.round(wait/60000)}m`);
}

module.exports = { startAlertLoop };
