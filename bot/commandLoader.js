const fs = require("fs");
const path = require("path");
const logger = require("./services/logger");

module.exports = (client) => {
  client.commands = new Map();

  const commandFiles = fs
    .readdirSync(path.join(__dirname, "commands"))
    .filter(file => file.endsWith(".js"));

  for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
    logger.info(`Loaded command: ${command.name}`);
  }
};
