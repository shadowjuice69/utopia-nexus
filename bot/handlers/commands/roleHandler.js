const database = require("../../services/database");
const permissionService = require("../../services/permissionService");
const { MessageFlags } = require("discord.js");

module.exports = async function roleHandler(interaction) {
  if (!permissionService.isAdmin(interaction.user.id)) {
    return interaction.reply({
      content: "❌ Admin access required.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const user = interaction.options.getUser("user");
  const role = interaction.options.getString("role");

  if (!user) {
    return interaction.reply({
      content: "❌ Select a user to assign a role.",
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!role) {
    return interaction.reply({
      content: "❌ Select a kingdom role.",
      flags: MessageFlags.Ephemeral,
    });
  }

  const allowedRoles = [
    "Monarch",
    "Steward",
    "War Leader",
    "Member",
  ];

  if (!allowedRoles.includes(role)) {
    return interaction.reply({
      content:
        "❌ Invalid role.\nAvailable: Monarch, Steward, War Leader, Member",
      flags: MessageFlags.Ephemeral,
    });
  }

  const db = database.getDb();

  const member = db.data.users.find(
    (u) => u.id === user.id
  );

  if (!member) {
    return interaction.reply({
      content: "❌ User profile not found.",
      flags: MessageFlags.Ephemeral,
    });
  }

  member.kingdomRole = role;

  await db.write();

  return interaction.reply({
    content:
      `✅ ${user.username} is now:\n` +
      `👑 Kingdom Role: ${role}`,
    flags: MessageFlags.Ephemeral,
  });
};
