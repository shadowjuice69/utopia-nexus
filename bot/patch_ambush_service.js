const fs = require("fs");

const file = "handlers/commands/ambushHandler.js";
let s = fs.readFileSync(file, "utf8");

// Add service import
s = s.replace(
'const { getKingdomInfo } = require("../../services/kingdomService");',
`const { getKingdomInfo } = require("../../services/kingdomService");
const { getMilitaryModifiers, applyDefenseModifiers } = require("../../services/militaryCalculatorService");`
);

// Remove old Supabase import if it exists
s = s.replace(
'const supabaseService = require("../../services/supabase");\n',
''
);

// Replace old modifier block
const oldBlock = /let eliteBonus = 0;[\s\S]*?const defSpecDef = units\.defSpecDef \+ defSpecBonus;/;

const newBlock = `
  const modifiers = await getMilitaryModifiers({
    race,
    personality: "The Cleric",
    age: 116
  });

  const modifiedUnits = applyDefenseModifiers(
    units,
    modifiers
  );

  const eliteDef = modifiedUnits.eliteDef;
  const defSpecDef = modifiedUnits.defSpecDef;
`;

s = s.replace(oldBlock, newBlock);

fs.writeFileSync(file, s);

console.log("Ambush now uses militaryCalculatorService");
