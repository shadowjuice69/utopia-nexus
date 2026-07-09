const database = require("../services/database");

module.exports = {
  name: "province",

  async execute(message) {
    const db = database.getDb();

    const user = db.data.users.find(
      (u) => u.id === message.author.id
    );

    if (!user) {
      return message.reply(
        "❌ No profile found. Try using !register first."
      );
    }

    if (!user.province) {
      return message.reply(
        "❌ You have not registered a province yet.\nUse !register to set one up."
      );
    }

    await message.reply(
      `🏰 Province Profile\n\n` +
      `👤 <@${user.id}>\n` +
      `🏰 Province: ${user.province}\n` +
      `📍 Location: ${user.coordinates}\n` +
      `👑 Kingdom Role: ${user.kingdomRole || "Member"}\n` +
      `🟢 Status: ${user.status || "active"}\n` +
      `⭐ Level: ${user.level || 1}`
    );
  },
};
