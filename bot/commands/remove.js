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

    const confirm = await message.reply(
      `⚠️ Confirm removal?\n\n` +
      `User: ${user.username}\n` +
      `Reason: ${reason}\n\n` +
      `Reply with \`confirm\` to continue or \`cancel\` to stop.`
    );

    const filter = (m) =>
      m.author.id === message.author.id &&
      ["confirm", "cancel"].includes(m.content.toLowerCase());

    const collected = await message.channel.awaitMessages({
      filter,
      max: 1,
      time: 30000,
    });

    if (collected.size === 0) {
      return confirm.edit("❌ Removal timed out.");
    }

    const response = collected.first().content.toLowerCase();

    if (response === "cancel") {
      return confirm.edit("❌ Removal cancelled.");
    }

    const removedUser = await userService.removeUser(
      user.id,
      reason
    );

    if (!removedUser) {
      return confirm.edit("❌ User profile not found.");
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

    await confirm.edit(
      `✅ ${user.username} is now a former member.\nReason: ${reason}`
    );
  },
};
