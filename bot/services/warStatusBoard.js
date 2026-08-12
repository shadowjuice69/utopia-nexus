const { EmbedBuilder } = require("discord.js");

const WAR_STATUS_CHANNEL_ID = "1536994453108301896";
const WAR_STATUS_KEY = "war_status_message_id";

async function buildWarEmbed(supabase) {
  const lines = [];

  // Active war
  const { data: wars } = await supabase.from("wars")
    .select("enemy_kd, status, started_at").eq("status", "active").limit(1);
  const war = wars?.[0];

  const embed = new EmbedBuilder()
    .setTitle("⚔️ War Status Board")
    .setColor(war ? 0xe53935 : 0x43a047)
    .setTimestamp()
    .setFooter({ text: `Judo (3:2) • WoL Age 116 • Last updated` });

  if (!war) {
    embed.setDescription("No active war. Kingdom is at peace. 🕊️");
    return embed;
  }

  embed.setDescription(`**Active War vs ${war.enemy_kd}**\nStarted: <t:${Math.floor(new Date(war.started_at).getTime()/1000)}:R>`);

  // Attack summary
  const { data: attacks } = await supabase.from("news_events")
    .select("event_type, acres, credits_gained")
    .in("event_type", ["outgoing_attack","outgoing_ambush","incoming_attack","incoming_ambush"]);

  if (attacks && attacks.length > 0) {
    const outgoing = attacks.filter(a => a.event_type.startsWith("outgoing"));
    const incoming = attacks.filter(a => a.event_type.startsWith("incoming"));
    const acresGained = outgoing.reduce((s, a) => s + (a.acres || 0), 0);
    const acresLost = incoming.reduce((s, a) => s + (a.acres || 0), 0);

    embed.addFields({
      name: "📊 Attack Summary",
      value: `🟢 Outgoing: **${outgoing.length}** attacks | **+${acresGained}** acres\n🔴 Incoming: **${incoming.length}** attacks | **-${acresLost}** acres`,
      inline: false
    });
  }

  // Wave assignments
  const { data: waves } = await supabase.from("wave_assignments")
    .select("province_name, wave_number, tick").order("wave_number").limit(10);
  if (waves && waves.length > 0) {
    const waveLines = waves.map(w => `Wave ${w.wave_number}: **${w.province_name}** (tick ${w.tick})`).join("\n");
    embed.addFields({ name: "🌊 Wave Schedule", value: waveLines, inline: false });
  }

  // Enemy intel summary
  const { data: enemies } = await supabase.from("intel_throne")
    .select("province, networth, land, offense, defense")
    .eq("kd_code", war.enemy_kd)
    .order("networth", { ascending: false }).limit(5);
  if (enemies && enemies.length > 0) {
    const enemyLines = enemies.map(e =>
      `• **${e.province}** — NW: ${e.networth?.toLocaleString() || "?"} | Land: ${e.land || "?"}`
    ).join("\n");
    embed.addFields({ name: "🕵️ Enemy Intel", value: enemyLines, inline: false });
  }

  return embed;
}

async function updateWarStatusBoard(client, supabase) {
  try {
    const channel = await client.channels.fetch(WAR_STATUS_CHANNEL_ID);
    if (!channel) return console.error("[WAR BOARD] Channel not found");

    const embed = await buildWarEmbed(supabase);

    // Check if we already have a message to edit
    const { data: setting } = await supabase.from("bot_settings")
      .select("value").eq("key", WAR_STATUS_KEY).single();

    if (setting?.value) {
      try {
        const msg = await channel.messages.fetch(setting.value);
        await msg.edit({ embeds: [embed] });
        console.log("[WAR BOARD] Updated existing message");
        return;
      } catch (e) {
        console.log("[WAR BOARD] Old message gone, posting new one");
      }
    }

    // Post new message
    const msg = await channel.send({ embeds: [embed] });
    await supabase.from("bot_settings").upsert({ key: WAR_STATUS_KEY, value: msg.id });
    console.log("[WAR BOARD] Posted new message:", msg.id);
  } catch (err) {
    console.error("[WAR BOARD ERROR]", err.message);
  }
}

module.exports = { updateWarStatusBoard };
