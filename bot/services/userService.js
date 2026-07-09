const database = require("./database");

module.exports = {
  async getOrCreateUser(user) {
    const db = database.getDb();

    const existingUser = db.data.users.find(
      (u) => u.id === user.id
    );

    if (existingUser) {
      return existingUser;
    }

    const newUser = {
      id: user.id,
      username: user.username,
      createdAt: new Date().toISOString(),
      status: "active",
      removedAt: null,
      removalReason: null,
      province: null,
      coordinates: null,
kingdomRole: "Member",

    };

    db.data.users.push(newUser);
    await db.write();

    return newUser;
  },

  async removeUser(userId, reason) {
    const db = database.getDb();

    const user = db.data.users.find(
      (u) => u.id === userId
    );

    if (!user) {
      return null;
    }

    user.status = "former_member";
    user.removedAt = new Date().toISOString();
    user.removalReason = reason;

    await db.write();

    return user;
  },

  async restoreUser(userId) {
    const db = database.getDb();

    const user = db.data.users.find(
      (u) => u.id === userId
    );

    if (!user) {
      return null;
    }

    user.status = "active";
    user.removedAt = null;
    user.removalReason = null;

    await db.write();

    return user;
  },
};
