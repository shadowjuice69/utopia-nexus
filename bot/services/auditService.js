const database = require("./database");

module.exports = {
  async log({
    action,
    actor,
    target,
  }) {
    const db = database.getDb();

    db.data.logs = db.data.logs || [];

    db.data.logs.push({
      action,
      actor,
      target,
      time: new Date().toISOString(),
    });

    if (db.data.logs.length > 100) {
      db.data.logs = db.data.logs.slice(-100);
    }

    await db.write();
  },
};
