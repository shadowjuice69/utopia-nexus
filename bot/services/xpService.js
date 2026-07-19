const database = require("./database");

module.exports = {
  async addXP(userId, amount) {
    const db = database.getDb();
    const users = db.get("users").value() || [];
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return null;

    users[idx].xp = (users[idx].xp || 0) + amount;
    const newLevel = Math.floor(users[idx].xp / 100) + 1;
    const leveledUp = newLevel > (users[idx].level || 1);
    users[idx].level = newLevel;
    db.set("users", users).write();

    return { user: users[idx], leveledUp };
  }
};
