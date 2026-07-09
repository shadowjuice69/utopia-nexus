const roles = require("../config/roles");
const database = require("../services/database");

module.exports = {
  name: "admins",

  async execute(message) {
    const db = database.getDb();

    const admins = db.data.admins || [];

    let reply = "👑 Owner:\n";

    if (roles.owner === message.author.id) {
      reply += `• ${message.author.username}\n`;
    } else {
      reply += `• Owner ID: ${roles.owner}\n`;
    }

    reply += "\n🛡️ Admins:\n";

    if (admins.length === 0) {
      reply += "• No admins added";
    } else {
      admins.forEach(id => {
        reply += `• <@${id}>\n`;
      });
    }

    await message.reply(reply);
  },
};
