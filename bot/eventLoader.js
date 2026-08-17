const fs = require("fs");
const path = require("path");

module.exports = function loadEvents(client) {
  const eventsPath = path.join(__dirname, "events");
  if (!fs.existsSync(eventsPath)) return;
  const files = fs.readdirSync(eventsPath).filter(f => f.endsWith(".js"));
  for (const file of files) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
};
