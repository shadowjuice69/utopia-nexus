const fs = require("fs");
const path = require("path");
const logger = require("./services/logger");

module.exports = (client) => {
  const eventFiles = fs
    .readdirSync(path.join(__dirname, "events"))
    .filter(file =>
      file.endsWith(".js") &&
      !file.includes(".legacy") &&
      !file.includes(".backup") &&
      !file.includes(".cleanbackup")
    );

  for (const file of eventFiles) {
    const event = require(`./events/${file}`);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }

    logger.info(`Loaded event: ${event.name}`);
  }
};
