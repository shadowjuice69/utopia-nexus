const database = require("./database");

module.exports = {
  async log({ action, actor, target }) {
    const db = database.getDb();

    const logs = db.get("logs").value() || [];
    logs.push({
      action,
      actor,
      target,
      time: new Date().toISOString(),
    });

    // Keep only last 100 logs
    const trimmed = logs.slice(-100);
    db.set("logs", trimmed).write();
  },
};
