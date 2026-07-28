const fs = require("fs");

const file = "handlers/commands/ambushHandler.js";
let s = fs.readFileSync(file, "utf8");

s = s.replace(
  'personality: "The Cleric",',
  'personality: kd.personality,'
);

fs.writeFileSync(file, s);

console.log("Ambush now uses kingdom personality");
