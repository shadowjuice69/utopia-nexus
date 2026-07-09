const database = require("../services/database");

module.exports = {
  name: "leadership",

  async execute(message) {
    const db = database.getDb();

    const leaders = db.data.users.filter(
      (u) =>
        u.kingdomRole &&
        u.kingdomRole !== "Member"
    );

    if (leaders.length === 0) {
      return message.reply(
        "🏰 No leadership roles assigned."
      );
    }

    let reply = "🏰 Kingdom Leadership\n\n";

    leaders.forEach((user) => {
      reply += `👑 ${user.kingdomRole}\n`;
      reply += `<@${user.id}>\n\n`;
    });

    await message.reply(reply);
  },
};
