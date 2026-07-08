const permissionService = require("../services/permissionService");

module.exports = {
  name: "addadmin",

  async execute(message) {
    if (!permissionService.isOwner(message.author.id)) {
      return message.reply("❌ Only the owner can add admins.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("❌ Mention a user to add as admin.");
    }

    await permissionService.addAdmin(user.id);

    await message.reply(
      `✅ ${user.username} is now an admin.`
    );
  },
};
