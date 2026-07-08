const database = require("./database");
const config = require("../config/config");

const cooldowns = new Map();

module.exports = {
  async addXP(userId, amount = config.xp.amountPerMessage) {
    const now = Date.now();
    const cooldown = config.xp.cooldown;

    if (cooldowns.has(userId)) {
      const lastMessage = cooldowns.get(userId);

      if (now - lastMessage < cooldown) {
        return null;
      }
    }

    cooldowns.set(userId, now);

    const db = database.getDb();

    let user = db.data.users.find(
      (u) => u.id === userId
    );

    if (!user) return null;

    const oldLevel = user.level || 1;

    user.xp = (user.xp || 0) + amount;
    user.level = Math.floor(user.xp / config.xp.xpPerLevel) + 1;0


    await db.write();

    return {
      user,
      leveledUp: user.level > oldLevel,
    };
  },
};
