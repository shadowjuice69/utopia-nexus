const logger = require("./logger");

module.exports = {
  handle(error) {
    logger.error(error.stack || error.message || error);
  },

  attach(client) {
    client.on("error", (error) => {
      this.handle(error);
    });

    process.on("unhandledRejection", (error) => {
      this.handle(error);
    });

    process.on("uncaughtException", (error) => {
      this.handle(error);
    });
  },
};
