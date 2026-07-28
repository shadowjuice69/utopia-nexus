const fs = require("fs");

const file = "handlers/commands/ambushHandler.js";
let s = fs.readFileSync(file, "utf8");

s = s.replace(
'${(elites * units.eliteDef).toLocaleString()}',
'${(elites * eliteDef).toLocaleString()}'
);

s = s.replace(
'${(offspecs * units.defSpecDef).toLocaleString()}',
'${(offspecs * defSpecDef).toLocaleString()}'
);

fs.writeFileSync(file, s);

console.log("Cleric display calculation fixed");
