const database = require("../services/database");
const permissionService = require("../services/permissionService");

module.exports = {
  name: "citizens",

  async execute(message) {
    if (!permissionService.isAdmin(message.author.id)) {
      return message.reply("❌ Admin access required.");
    }

    const db = database.getDb();

    const citizens = db.data.users.filter(
  (u) => u.province && (!u.status || u.status === "active")
);

    if (citizens.length === 0) {
      return message.reply(
        "🏰 No registered citizens found."
      );
    }

    let reply = "🏰 Kingdom Roster\n\n";

    citizens.forEach((user) => {
  reply += `👤 <@${user.id}>\n`;
  reply += `🏰 Province: ${user.province}\n`;
  reply += `📍 Location: ${user.coordinates}\n`;
  reply += `👑 Role: ${user.kingdomRole || "Member"}\n\n`;
});

    await message.reply(reply);
  },
};

