const roles = require("../config/roles");
const database = require("./database");

function trustedAdminIds() {
  return [...new Set([
    ...(roles.trustedAdmins || []),
    ...String(process.env.SPARTAN_TRUSTED_ADMIN_IDS || "")
      .split(",")
      .map(id => id.trim())
      .filter(Boolean),
  ])];
}

function isOwner(userId) {
  return String(userId || "") === String(roles.owner);
}

function isTrustedAdmin(userId) {
  const id = String(userId || "");
  return Boolean(id) && trustedAdminIds().includes(id);
}

function isProtected(userId) {
  return isOwner(userId) || isTrustedAdmin(userId);
}

module.exports = {
  isOwner,
  isTrustedAdmin,
  isProtected,

  // Only the Owner may change the protected Trusted Admin hierarchy.
  canManageProtectedTarget(actorId, targetId) {
    if (!isProtected(targetId)) return true;
    return isOwner(actorId);
  },

  isAdmin(userId) {
    const id = String(userId || "");
    if (!id) return false;
    if (isOwner(id) || isTrustedAdmin(id)) return true;

    const db = database.getDb();
    const admins = db.get("admins").value() || [];
    return admins.map(String).includes(id);
  },

  async addAdmin(userId) {
    const db = database.getDb();
    const admins = db.get("admins").value() || [];
    if (!admins.includes(userId)) db.get("admins").push(userId).write();
  },

  async removeAdmin(userId) {
    if (isProtected(userId)) throw new Error("Protected Spartan identities can only be changed by the Owner.");
    const db = database.getDb();
    const admins = db.get("admins").value() || [];
    db.set("admins", admins.filter(id => id !== userId)).write();
  },
};
