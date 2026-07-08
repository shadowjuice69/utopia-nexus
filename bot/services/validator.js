const logger = require("./logger");

module.exports = {
  checkEnv() {
    if (!process.env.DISCORD_TOKEN) {
      logger.error("Missing DISCORD_TOKEN in .env file");
      process.exit(1);
    }

    logger.info("Environment validation passed");
  },
};
