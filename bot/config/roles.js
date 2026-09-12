module.exports = {
  // Spartan root authority. This identity cannot be suspended, revoked, or IP-banned.
  owner: "653534906277822494",

  // Trusted administrators have full operational access, but only the Owner
  // may disable, revoke, suspend, or otherwise remove their protected status.
  trustedAdmins: ["262745631829786624"],

  // Legacy/local admin list remains supported for ordinary administrators.
  admins: [],
  moderators: [],
};
