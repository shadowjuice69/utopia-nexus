const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const logger = require("./logger");

const adapter = new FileSync("utopia.json");
const db = low(adapter);

module.exports = {
  async connect() {
    db.defaults({ users: [], admins: [] }).write();
    logger.info("Database initialized");
  },

  getDb() {
    return db;
  },
};
