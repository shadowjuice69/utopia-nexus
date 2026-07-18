const supabaseService = require("../../services/supabase");

const UTOPIA_DAY_START_UTC = 19; // 7pm UTC = tick 1 (1pm CST)

const TIMEZONE_OFFSETS = {
  "UTC": 0, "GMT": 0,
  "EST": -5, "EDT": -4, "UTC-5": -5, "UTC-4": -4,
  "CST": -6, "CDT": -5, "UTC-6": -6,
  "MST": -7, "MDT": -6, "UTC-7": -7,
  "PST": -8, "PDT": -7, "UTC-8": -8,
  "UTC+1": 1, "UTC+2": 2, "UTC+3": 3,
  "UTC+4": 4, "UTC+5": 5, "UTC+6": 6,
  "UTC+7": 7, "UTC+8": 8, "UTC+9": 9,
  "UTC+10": 10, "UTC+11": 11, "UTC+12": 12,
  "UTC-1": -1, "UTC-2": -2, "UTC-3": -3,
  "UTC-9": -9, "UTC-10": -10,
  "CET": 1, "EET": 2, "IST": 5.5,
  "JST": 9, "AEST": 10, "NZST": 12
};

function parseTimeToHour(timeStr) {
  timeStr = timeStr.trim().toLowerCase();
  const ampm = timeStr.match(/(\d+)(?::(\d+))?\s*(am|pm)/);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const pm = ampm[3] === "pm";
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    return h;
  }
  const plain = timeStr.match(/(\d+)/);
  if (plain) return parseInt(plain[1]);
  return null;
}

function localHourToTick(localHour, tzOffset) {
  const utcHour = ((localHour - tzOffset) % 24 + 24) % 24;
  const tick = ((utcHour - UTOPIA_DAY_START_UTC) % 24 + 24) % 24 + 1;
  return tick;
}

function tickToLocalHour(tick, tzOffset) {
  const utcHour = (UTOPIA_DAY_START_UTC + tick - 1) % 24;
  const localHour = ((utcHour + tzOffset) % 24 + 24) % 24;
  return localHour;
}

function formatHour(h) {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  if (h < 12) return `${h}am`;
  return `${h - 12}pm`;
}

module.exports = async function wavesHandler(interaction) {
  const supabase = supabaseService.getClient();
  if (!supabase) {
    return interaction.reply({ content: "❌ Database not connected.", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: false });

  // Get caller's timezone from their province registration
  const { data: callerProvince } = await supabase
    .from("provinces")
    .select("timezone, name")
    .eq("discord_id", interaction.user.id)
    .limit(1);

  const callerTZ = callerProvince?.[0]?.timezone?.trim().toUpperCase() || "UTC";
  const callerOffset = TIMEZONE_OFFSETS[callerTZ] ?? 0;

  const { data: provinces, error } = await supabase
    .from("provinces")
    .select("name, race, personality, play_role, timezone, wave_times")
    .not("wave_times", "is", null)
    .not("timezone", "is", null);

  if (error || !provinces || provinces.length === 0) {
    return interaction.editReply("❌ No registered provinces with wave times found.");
  }

  // Build tick availability map
  const tickMap = {};
  for (let t = 1; t <= 24; t++) tickMap[t] = [];

  for (const p of provinces) {
    const tzKey = p.timezone.trim().toUpperCase();
    const offset = TIMEZONE_OFFSETS[tzKey];
    if (offset === undefined) continue;

    const ranges = p.wave_times.split(",");
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
        tickMap[t].push({
          name: p.name || "Unknown",
          race: p.race || "?",
          personality: p.personality || "?",
          role: p.play_role || "?"
        });
        t = (t % 24) + 1;
        iter++;
      }
    }
  }

  const nowUTC = new Date().getUTCHours();
  const currentTick = ((nowUTC - UTOPIA_DAY_START_UTC) % 24 + 24) % 24 + 1;
  const currentLocal = formatHour(tickToLocalHour(currentTick, callerOffset));

  let response = `⚔️ **Kingdom Wave Schedule**\n`;
  response += `🕐 Current Tick: **${currentTick}** (${currentLocal} ${callerTZ})\n\n`;

  for (let i = 0; i < 12; i++) {
    const tick = ((currentTick - 1 + i) % 24) + 1;
    const localH = tickToLocalHour(tick, callerOffset);
    const localTime = formatHour(localH);
    const members = tickMap[tick] || [];
    const attackers = members.filter(m => m.role.toLowerCase().includes("attack"));
    const mages = members.filter(m => m.role.toLowerCase().includes("mage") || m.role.toLowerCase().includes("hybrid"));
    const thieves = members.filter(m => m.role.toLowerCase().includes("thief"));

    const indicator = i === 0 ? " ← NOW" : "";
    response += `**Tick ${tick}** (${localTime} ${callerTZ})${indicator}\n`;

    if (members.length === 0) {
      response += `  😴 No one available\n`;
    } else {
      if (attackers.length > 0) response += `  ⚔️ ${attackers.map(m => m.name).join(", ")}\n`;
      if (mages.length > 0) response += `  🔮 ${mages.map(m => m.name).join(", ")}\n`;
      if (thieves.length > 0) response += `  🗡️ ${thieves.map(m => m.name).join(", ")}\n`;
    }
  }

  await interaction.editReply(response);
};
