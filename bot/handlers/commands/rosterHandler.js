const { EmbedBuilder } = require("discord.js");
const supabaseService = require("../../services/supabase");
const { getKingdomInfo } = require("../../services/kingdomService");

const ROLE_EMOJI = {
  attacker: "⚔️", defender: "🛡️", thief: "🗡️", mage: "🔮",
  hybrid: "⚡", support: "💚", general: "🎖️",
};

module.exports = async function rosterHandler(interaction) {
  const supabase = supabaseService.getClient();
  const kd = await getKingdomInfo();

  const { data: provinces } = await supabase
    .from("provinces")
    .select("name, race, personality, play_role, timezone, user_id")
    .not("user_id", "is", null)
    .order("name");

  if (!provinces || provinces.length === 0) {
    return interaction.reply({ content: "No registered members yet.", ephemeral: true });
  }

  const lines = provinces.map(p => {
    const emoji = ROLE_EMOJI[p.play_role?.toLowerCase()] || "👤";
    return `${emoji} **${p.name}** — ${p.race || "?"} ${p.personality || "?"} (${p.play_role || "?"}) · ${p.timezone || "?"}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`👥 Kingdom Roster (${provinces.length} registered)`)
    .setColor(0x38bdf8)
    .setDescription(lines.join("\n"))
    .setFooter({ text: kd.footer });

  return interaction.reply({ embeds: [embed], ephemeral: true });
};
