const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");
const logger = require("./logger");

const adapter = new JSONFile("utopia.json");
const db = new Low(adapter, { users: [], admins: [] });

module.exports = {
  async connect() {
    await db.read();

    db.data ||= { users: [], admins: [] };

    await db.write();

    logger.info("Database initialized");
  },

  getDb() {
    return db;
  },
};
