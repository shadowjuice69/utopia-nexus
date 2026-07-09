const database = require("../services/database");
const permissionService = require("../services/permissionService");

module.exports = {
  name: "register",

  async execute(message) {
    const db = database.getDb();

    let user = db.data.users.find(
      (u) => u.id === message.author.id
    );

    if (!user) {
      return message.reply(
        "❌ You need a profile first."
      );
    }

    if (user.province) {
      return message.reply(
        `⚠️ You are already registered.\n` +
        `Province: ${user.province}\n` +
        `Coordinates: ${user.coordinates}`
      );
    }

    const filter = (m) =>
      m.author.id === message.author.id;

    await message.reply(
      "🏰 Let's register your province.\n\nWhat is your province name?"
    );

    const provinceReply = await message.channel.awaitMessages({
      filter,
      max: 1,
      time: 60000,
    });

    if (provinceReply.size === 0) {
      return message.reply("❌ Registration timed out.");
    }

    const province =
      provinceReply.first().content;

    await message.reply(
      "📍 What are your coordinates?"
    );

    const coordinateReply = await message.channel.awaitMessages({
      filter,
      max: 1,
      time: 60000,
    });

    if (coordinateReply.size === 0) {
      return message.reply("❌ Registration timed out.");
    }

    const coordinates =
      coordinateReply.first().content;

    user.province = province;
    user.coordinates = coordinates;

    await db.write();

    await message.reply(
      `✅ Registration complete!\n\n` +
      `🏰 Province: ${province}\n` +
      `📍 Coordinates: ${coordinates}`
    );
  },
};
