/**
 * Central command access policy.
 *
 * Keeps permission semantics separate from command dispatch so command metadata
 * can describe access requirements consistently as Nexus grows.
 */

function normalizeAccess(entry) {
  if (entry.requiresOwner) return "owner";
  if (entry.requiresAdmin) return "admin";
  if (entry.requiresRegistration) return "registered";
  return "public";
}

function canAccess(entry, user, permissions) {
  const access = normalizeAccess(entry);
  if (access === "public") return true;
  if (!user?.id) return false;
  if (access === "owner") return permissions.isOwner(user.id);
  if (access === "admin") return permissions.isAdmin(user.id);
  return true;
}

function denialMessage(entry) {
  const access = normalizeAccess(entry);
  if (access === "owner") return "❌ You don't have permission to use this command.";
  if (access === "admin") return "❌ You don't have permission to use admin commands.";
  return null;
}

module.exports = {
  normalizeAccess,
  canAccess,
  denialMessage
};
