const supabaseService = require("./supabase");
const logger = require("./logger");

const TICK_START_UTC = 19;

const TIMEZONE_OFFSETS = {
  "UTC": 0, "GMT": 0,
  "EST": -5, "EDT": -4, "CST": -6, "CDT": -5,
  "MST": -7, "MDT": -6, "PST": -8, "PDT": -7,
  "UTC+1": 1, "UTC+2": 2, "UTC+3": 3, "UTC+4": 4,
  "UTC+5": 5, "UTC+6": 6, "UTC+7": 7, "UTC+8": 8,
  "UTC+9": 9, "UTC+10": 10, "UTC+11": 11, "UTC+12": 12,
  "UTC-1": -1, "UTC-2": -2, "UTC-3": -3, "UTC-9": -9,
  "CET": 1, "EET": 2, "IST": 5.5, "JST": 9, "AEST": 10
};

function getCurrentTick() {
  const now = new Date();
  return ((now.getUTCHours() - TICK_START_UTC) % 24 + 24) % 24 + 1;
}

function msUntilNextTick() {
  const now = new Date();
  return (60 - now.getUTCMinutes()) * 60000 - now.getUTCSeconds() * 1000 - now.getUTCMilliseconds();
}

function tickToLocalHour(tick, offset) {
  return ((TICK_START_UTC + tick - 1 + offset) % 24 + 24) % 24;
}

function formatHour(h) {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h-12}pm`;
}

function parseTimeToHour(str) {
  str = str.trim().toLowerCase();
  const ampm = str.match(/(\d+)(?::(\d+))?\s*(am|pm)/);
  if (ampm) {
    let h = parseInt(ampm[1]);
    if (ampm[3] === "pm" && h !== 12) h += 12;
    if (ampm[3] === "am" && h === 12) h = 0;
    return h;
  }
  const plain = str.match(/(\d+)/);
  return plain ? parseInt(plain[1]) : null;
}

function localHourToTick(localHour, offset) {
  const utcHour = ((localHour - offset) % 24 + 24) % 24;
  return ((utcHour - TICK_START_UTC) % 24 + 24) % 24 + 1;
}

async function getAvailableMembers(tick) {
  const supabase = supabaseService.getClient();
  if (!supabase) return [];
  const { data: provinces } = await supabase
    .from("provinces")
    .select("name, play_role, timezone, wave_times")
    .not("wave_times", "is", null)
    .not("timezone", "is", null);

  if (!provinces?.length) return [];

  const available = [];
  for (const p of provinces) {
    const offset = TIMEZONE_OFFSETS[p.timezone?.trim().toUpperCase()] ?? 0;
    const ranges = (p.wave_times || "").split(",");
    for (const range of ranges) {
      const parts = range.trim().split("-");
      if (parts.length < 2) continue;
      const startHour = parseTimeToHour(parts[0]);
      const endHour = parseTimeToHour(parts[1]);
      if (startHour === null || endHour === null) continue;
      const startTick = localHourToTick(startHour, offset);
      const endTick = localHourToTick(endHour, offset);
      let t = startTick;
      let iter = 0;
      while (t !== endTick && iter < 24) {
        if (t === tick) { available.push(p); break; }
        t = (t % 24) + 1;
        iter++;
      }
    }
  }
  return available;
}

async function checkAlerts(client) {
  const supabase = supabaseService.getClient();
  if (!supabase) return;

  const tick = getCurrentTick();
  logger.info(`[ALERT] Checking tick ${tick}`);

  const { data: alerts, error } = await supabase.from("alerts").select("*").eq("active", true);
  if (error || !alerts?.length) return;

  const available = await getAvailableMembers(tick);

  for (const alert of alerts) {
    if (!alert.ticks.includes(tick)) continue;
    try {
      const channel = await client.channels.fetch(alert.channel_id);
      if (!channel) continue;

      const ping = alert.ping_role ? `<@&${alert.ping_role}> ` : "@here ";
      let msg = `${ping}⏰ **Tick ${tick} — ${alert.label}**\n${alert.message}`;

      if (available.length) {
        const attackers = available.filter(m => m.play_role?.toLowerCase().includes("attack"));
        const mages = available.filter(m => m.play_role?.toLowerCase().includes("mage") || m.play_role?.toLowerCase().includes("hybrid"));
        const thieves = available.filter(m => m.play_role?.toLowerCase().includes("thief"));
        msg += `\n\n**Available this tick:**`;
        if (attackers.length) msg += `\n⚔️ ${attackers.map(m => m.name).join(", ")}`;
        if (mages.length) msg += `\n🔮 ${mages.map(m => m.name).join(", ")}`;
        if (thieves.length) msg += `\n🗡️ ${thieves.map(m => m.name).join(", ")}`;
        if (!attackers.length && !mages.length && !thieves.length) msg += `\n😴 No one scheduled`;
      }

      await channel.send(msg);
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
