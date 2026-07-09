const database = require("../services/database");
const permissionService = require("../services/permissionService");

module.exports = {
  name: "role",

  async execute(message) {
    if (!permissionService.isAdmin(message.author.id)) {
      return message.reply("❌ Admin access required.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply(
        "❌ Mention a user to assign a role."
      );
    }

    const role = message.content
      .split(" ")
      .slice(2)
      .join(" ");

    if (!role) {
      return message.reply(
        "❌ Provide a kingdom role."
      );
    }

    const allowedRoles = [
      "Monarch",
      "Steward",
      "War Leader",
      "Member",
    ];

    if (!allowedRoles.includes(role)) {
      return message.reply(
        "❌ Invalid role.\nAvailable: Monarch, Steward, War Leader, Member"
      );
    }

    const db = database.getDb();

    const member = db.data.users.find(
      (u) => u.id === user.id
    );

    if (!member) {
      return message.reply(
        "❌ User profile not found."
      );
    }

    member.kingdomRole = role;

    await db.write();

    await message.reply(
      `✅ ${user.username} is now:\n` +
      `👑 Kingdom Role: ${role}`
    );
  },
};
