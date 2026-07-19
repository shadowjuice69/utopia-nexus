const database = require("./database");

module.exports = {
  async getOrCreateUser(discordUser) {
    const db = database.getDb();
    const users = db.get("users").value() || [];
    const existingUser = users.find(u => u.id === discordUser.id);
    if (existingUser) return existingUser;

    const newUser = {
      id: discordUser.id,
      username: discordUser.username,
      level: 1,
      xp: 0,
      status: "active",
      kingdomRole: "Member",
      joinedAt: new Date().toISOString()
    };

    users.push(newUser);
    db.set("users", users).write();
    return newUser;
  },

  getUser(userId) {
    const db = database.getDb();
    const users = db.get("users").value() || [];
    return users.find(u => u.id === userId);
  },

  async updateUser(userId, updates) {
    const db = database.getDb();
    const users = db.get("users").value() || [];
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates };
    db.set("users", users).write();
    return users[idx];
  }
};
