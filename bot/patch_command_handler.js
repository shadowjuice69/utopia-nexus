const fs = require("fs");

const file = "handlers/commandHandler.js";

let data = fs.readFileSync(file, "utf8");

if (!data.includes('const thieveryHandler')) {
  data = data.replace(
    'const spellcheckHandler = require("./commands/spellcheckHandler");',
    'const spellcheckHandler = require("./commands/spellcheckHandler");\nconst thieveryHandler = require("./commands/thieveryHandler");'
  );
}

if (!data.includes('thievery: thieveryHandler')) {
  data = data.replace(
    '  spellcheck: spellcheckHandler,',
    '  spellcheck: spellcheckHandler,\n  thievery: thieveryHandler,'
  );
}

fs.writeFileSync(file, data);

console.log("✅ Thievery handler connected");
