const permissionService = require("../services/permissionService");
const auditService = require("../services/auditService");

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

    await auditService.log({
  action: "ADD_ADMIN",
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
      `✅ ${user.username} is now an admin.`
    );
  },
};
