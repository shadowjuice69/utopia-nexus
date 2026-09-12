const roles = require("../config/roles");
const database = require("./database");

function trustedAdminIds() {
  return String(process.env.SPARTAN_TRUSTED_ADMIN_IDS || "")
    .split(",")
    .map(id => id.trim())
    .filter(Boolean);
}

module.exports = {
  isOwner(userId) {
    return String(userId) === String(roles.owner);
  },

  isAdmin(userId) {
    const id = String(userId || "");
    if (!id) return false;
    if (this.isOwner(id)) return true;
    if (trustedAdminIds().includes(id)) return true;

    const db = database.getDb();
    const admins = db.get("admins").value() || [];
    return admins.map(String).includes(id);
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
    const admins = db.get("admins").value() || [];

    db.set(
      "admins",
      admins.filter(id => id !== userId)
    ).write();
  },
};
