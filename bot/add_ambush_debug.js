const fs = require("fs");

const file = "handlers/commands/ambushHandler.js";
let s = fs.readFileSync(file, "utf8");

s = s.replace(
  'const kd = await getKingdomInfo();',
  'const kd = await getKingdomInfo();\n  console.log("[AMBUSH KD]", kd);'
);

fs.writeFileSync(file, s);

console.log("Ambush debug added");
