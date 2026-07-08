const userService = require("../services/userService");
const config = require("../config/config");

module.exports = {
  name: "profile",

  async execute(message) {
    const user = await userService.getOrCreateUser(message.author);

    const nextLevelXP = (user.level || 1) * config.xp.xpPerLevel;

    await message.reply(
      `Profile\n` +
      `Username: ${user.username}\n` +
      `Level: ${user.level || 1}\n` +
      `XP: ${user.xp || 0}/${nextLevelXP}\n` +
      `Joined: ${user.createdAt}`
    );
  },
};
