const roles = require("../config/roles");
const database = require("./database");

module.exports = {
  isOwner(userId) {
    return userId === roles.owner;
  },

  isAdmin(userId) {
    const db = database.getDb();

    return (
      userId === roles.owner ||
      db.data.admins.includes(userId)
    );
  },

  async addAdmin(userId) {
  const db = database.getDb();

  db.data.admins = db.data.admins || [];

  if (!db.data.admins.includes(userId)) {
    db.data.admins.push(userId);
    await db.write();
  }
},

  async removeAdmin(userId) {
    const db = database.getDb();

    db.data.admins = db.data.admins.filter(
      id => id !== userId
    );

    await db.write();
  },
};
