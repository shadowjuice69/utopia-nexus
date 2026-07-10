const database = require("../services/database");
const permissionService = require("../services/permissionService");

module.exports = {
  name: "resetage",

  async execute(message) {
    if (!permissionService.isOwner(message.author.id)) {
      return message.reply("❌ Owner access required.");
    }

    const db = database.getDb();

    db.data.users.forEach((user) => {
      user.province = null;
      user.coordinates = null;
    });

    await db.write();

    return message.reply(
      "✅ New age reset complete. All provinces and coordinates have been cleared."
    );
  },
};
