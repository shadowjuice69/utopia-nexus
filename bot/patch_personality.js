const fs = require("fs");

const file = "services/kingdomService.js";
let s = fs.readFileSync(file, "utf8");

s = s.replace(
  '.in("key", ["kingdom_name", "kingdom_code", "current_age"]);',
  `.in("key", [
      "kingdom_name",
      "kingdom_code",
      "current_age",
      "kingdom_personality"
    ]);`
);

s = s.replace(
  'age:  settings.current_age  || "116",',
  'age: settings.current_age || "116",\n    personality: settings.kingdom_personality || "The Cleric",'
);

fs.writeFileSync(file, s);

console.log("kingdomService personality added");
