const database = require("../services/database");
const permissionService = require("../services/permissionService");

module.exports = {
  name: "logs",

  async execute(message) {
    if (!permissionService.isAdmin(message.author.id)) {
      return message.reply("❌ Admin access required.");
    }

    const db = database.getDb();

    const logs = db.data.logs || [];

    if (logs.length === 0) {
      return message.reply("📋 No admin logs found.");
    }

    let reply = "📋 Recent Admin Logs:\n\n";

    logs.slice(-10).reverse().forEach(log => {
  reply += `• ${log.action}\n`;

  if (log.actor) {
    reply += `  By: ${log.actor.username}\n`;
  }

  if (log.target) {
    reply += `  Target: ${log.target.username}\n`;
  }

  if (!log.actor && typeof log.action === "string") {
    reply += `  Details: ${log.action}\n`;
  }

  reply += `  Time: ${new Date(log.time).toLocaleString()}\n\n`;
});

    await message.reply(reply);
  },
};
