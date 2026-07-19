const roles = require("../config/roles");
const database = require("./database");

module.exports = {
  isOwner(userId) {
    return userId === roles.owner;
  },

  isAdmin(userId) {
    if (userId === roles.owner) return true;
    const db = database.getDb();
    const admins = db.get("admins").value() || [];
    return admins.includes(userId);
  },

  async addAdmin(userId) {
    const db = database.getDb();
    const admins = db.get("admins").value() || [];
    if (!admins.includes(userId)) {
      db.get("admins").push(userId).write();
    }
  },

  async removeAdmin(userId) {
    const db = database.getDb();
    db.set("admins", (db.get("admins").value() || []).filter(id => id !== userId)).write();
  },
};
