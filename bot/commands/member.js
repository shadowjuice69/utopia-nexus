const database = require("../services/database");
const permissionService = require("../services/permissionService");

module.exports = {
  name: "member",

  async execute(message) {
    if (!permissionService.isAdmin(message.author.id)) {
      return message.reply("❌ Admin access required.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("❌ Mention a user to view.");
    }

    const db = database.getDb();

    const member = db.data.users.find(
      (u) => u.id === user.id
    );

    if (!member) {
      return message.reply("❌ No member record found.");
    }

    await message.reply(
      `👤 Member Profile\n\n` +
      `Name: ${member.username}\n` +
      `Status: ${member.status || "active"}\n` +
      `Joined: ${member.createdAt}\n` +
      `Removed: ${member.removedAt || "N/A"}\n` +
      `Reason: ${member.removalReason || "N/A"}`
    );
  },
};

