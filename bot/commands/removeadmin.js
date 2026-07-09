const permissionService = require("../services/permissionService");
const auditService = require("../services/auditService");

module.exports = {
  name: "removeadmin",

  async execute(message) {
    if (!permissionService.isOwner(message.author.id)) {
      return message.reply("❌ Only the owner can remove admins.");
    }

    const user = message.mentions.users.first();

if (!user) {
  return message.reply("❌ Mention a user to remove.");
}

const roles = require("../config/roles");

if (user.id === roles.owner) {
  return message.reply("❌ The owner cannot be removed.");
}

await permissionService.removeAdmin(user.id);

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
  `✅ ${user.username} is no longer an admin.`
);

},
};
