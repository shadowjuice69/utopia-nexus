const supabaseService = require("../../services/supabase");

const TICK_START_UTC = 19;

function getCurrentTick() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  return ((utcHour - TICK_START_UTC) % 24 + 24) % 24 + 1;
}

module.exports = async function statusHandler(interaction) {
  const supabase = supabaseService.getClient();
  if (!supabase) return interaction.reply({ content: "❌ Database not connected.", ephemeral: true });

  await interaction.deferReply({ ephemeral: false });

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0,0,0,0);

  const [members, attacks, ops, alerts, war] = await Promise.all([
    supabase.from("provinces").select("id", { count: "exact" }),
    supabase.from("attacks").select("id", { count: "exact" }).gte("timestamp", todayStart.toISOString()),
    supabase.from("hostile_ops").select("id", { count: "exact" }).gte("timestamp", todayStart.toISOString()),
    supabase.from("alerts").select("label, ticks").eq("active", true),
    supabase.from("wars").select("*").eq("active", true).eq("guild_id", interaction.guildId).limit(1)
  ]);

  const tick = getCurrentTick();
  const minLeft = 60 - now.getMinutes();
  const activeWar = war.data?.[0];
  const activeAlerts = alerts.data || [];

  let msg = `⚔️ **Utopia Nexus — Kingdom Status**\n\n`;
  msg += `🕐 **Tick:** ${tick} (${minLeft}m left)\n`;
  msg += `👥 **Members:** ${members.count || 0}\n`;
  msg += `⚔️ **Attacks today:** ${attacks.count || 0}\n`;
  msg += `🗡️ **Ops today:** ${ops.count || 0}\n`;

  if (activeWar) {
    msg += `\n🔥 **Active War:** ${activeWar.enemy_kingdom} (${activeWar.enemy_coords})\n`;
    if (activeWar.notes) msg += `📝 ${activeWar.notes}\n`;
  } else {
    msg += `\n🕊️ **No active war declared**\n`;
  }

  if (activeAlerts.length) {
    msg += `\n🔔 **Active Alerts:**\n`;
    for (const a of activeAlerts) {
      msg += `  • ${a.label} — Ticks ${a.ticks.join(", ")}\n`;
    }
  }

  await interaction.editReply(msg);
};
