const permissionService = require("../services/permissionService");

module.exports = {
  name: "admin",

  async execute(message) {
    if (!permissionService.isAdmin(message.author.id)) {
      return message.reply("❌ You do not have permission to use this command.");
    }

    await message.reply("✅ Admin access confirmed.");
  },
};
