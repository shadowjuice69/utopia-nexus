const database = require("../../services/database");
const permissionService = require("../../services/permissionService");
const auditService = require("../../services/auditService");
const { MessageFlags } = require("discord.js");

module.exports = async function roleHandler(interaction) {
  const target = interaction.options.getUser("user");
  const role = interaction.options.getString("role");

  const db = database.getDb();
  const users = db.get("users").value() || [];
  const idx = users.findIndex(u => u.id === target.id);

  if (idx === -1) {
    return interaction.reply({ content: `❌ ${target.username} is not registered.`, flags: MessageFlags.Ephemeral });
  }

  users[idx].kingdomRole = role;
  db.set("users", users).write();

  await auditService.log({
    action: "ROLE_ASSIGNED",
    actor: interaction.user.username,
    target: `${target.username} → ${role}`
  });

  return interaction.reply({
    content: `✅ ${target.username} is now **${role}**.`,
    flags: MessageFlags.Ephemeral
  });
};
