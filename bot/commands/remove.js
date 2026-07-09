const userService = require("../services/userService");
const permissionService = require("../services/permissionService");
const auditService = require("../services/auditService");

module.exports = {
  name: "remove",

  async execute(message) {
    if (!permissionService.isAdmin(message.author.id)) {
      return message.reply("❌ Admin access required.");
    }

    const user = message.mentions.users.first();

    if (!user) {
      return message.reply("❌ Mention a user to remove.");
    }

    const reason = message.content
      .split(" ")
      .slice(2)
      .join(" ") || "No reason provided";

    const removedUser = await userService.removeUser(
      user.id,
      reason
    );

    if (!removedUser) {
      return message.reply("❌ User profile not found.");
    }

    await auditService.log({
      action: "REMOVE_MEMBER",
      actor: {
        id: message.author.id,
        username: message.author.username,
      },
      target: {
        id: user.id,
        username: user.username,
      },
      reason,
    });

    await message.reply(
      `✅ ${user.username} is now a former member.\nReason: ${reason}`
    );
  },
};
