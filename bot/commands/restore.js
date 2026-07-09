const userService = require("../services/userService");
const permissionService = require("../services/permissionService");
const auditService = require("../services/auditService");

module.exports = {
  name: "restore",

  async execute(message) {
    if (!permissionService.isAdmin(message.author.id)) {
      return message.reply("❌ Admin access required.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("❌ Mention a user to restore.");
    }

    const restoredUser = await userService.restoreUser(
      user.id
    );

    if (!restoredUser) {
      return message.reply("❌ User profile not found.");
    }

    await auditService.log({
      action: "RESTORE_MEMBER",
      actor: {
        id: message.author.id,
        username: message.author.username,
      },
      target: {
        id: user.id,
        username: user.username,
      },
    });

    await message.reply(
      `✅ ${user.username} is now an active member again.`
    );
  },
};

