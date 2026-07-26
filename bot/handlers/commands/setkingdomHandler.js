const { setKingdomInfo } = require("../../services/kingdomService");
const permissionService = require("../../services/permissionService");

module.exports = async function setkingdomHandler(interaction) {
  if (!permissionService.isAdmin(interaction.user.id)) {
    return interaction.reply({ content: "❌ Admin access required.", ephemeral: true });
  }

  const name = interaction.options.getString("name");
  const code = interaction.options.getString("code");

  const ok = await setKingdomInfo(name, code);
  if (!ok) {
    return interaction.reply({ content: "❌ Failed to update kingdom info.", ephemeral: true });
  }

  return interaction.reply({
    content: `✅ Kingdom updated to **${name}** (${code}). All commands will use the new name on next use.`,
    ephemeral: true,
  });
};
