const permissionService = require("../services/permissionService");

module.exports = {
  name: "removecheck",

  async execute(message) {
    if (!permissionService.isAdmin(message.author.id)) {
      return message.reply("❌ Admin access required.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("❌ Mention a user to check.");
    }

    const reason = message.content
      .split(" ")
      .slice(2)
      .join(" ") || "No reason provided";

    await message.reply(
      `🧪 Removal Preview\n\n` +
      `User: ${user.username}\n` +
      `New Status: former_member\n` +
      `Reason: ${reason}\n\n` +
      `No changes made.`
    );
  },
};
