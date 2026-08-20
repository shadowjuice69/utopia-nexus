const { EmbedBuilder } = require("discord.js");
const { getKingdomInfo } = require("../../services/kingdomService");
const commandRegistry = require("../../services/commandRegistry");

function buildCommandFields() {
  const groups = new Map();

  for (const entry of commandRegistry.list()) {
    if (!groups.has(entry.command)) {
      groups.set(entry.command, []);
    }

    groups.get(entry.command).push(entry);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([command, entries]) => ({
      name: `/${command}`,
      value: entries
        .slice()
        .sort((a, b) => a.subcommand.localeCompare(b.subcommand))
        .map(entry => {
          const description = entry.description ? ` — ${entry.description}` : "";
          return `• \`/${command} ${entry.subcommand}\`${description}`;
        })
        .join("\n"),
      inline: false
    }));
}

module.exports = async function helpHandler(interaction) {
  const kd = await getKingdomInfo();
  const fields = buildCommandFields();

  const embed = new EmbedBuilder()
    .setTitle("⚔️ Utopia Nexus — Command Guide")
    .setColor(0x38bdf8)
    .setDescription(`All available commands for ${kd.name} kingdom members. Age ${kd.age}.`)
    .addFields(...fields)
    .addFields({
      name: "🌐 War Room Dashboard & Intel Sync",
      value: "Use the registered Nexus dashboard and intel sync endpoints configured for your deployment.",
      inline: false
    })
    .setFooter({ text: kd.footer })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
};
