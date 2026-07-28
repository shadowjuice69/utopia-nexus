const fs = require("fs");

const file = "handlers/commands/ambushHandler.js";
let s = fs.readFileSync(file, "utf8");

s = s.replace(
'const { getKingdomInfo } = require("../../services/kingdomService");',
'const { getKingdomInfo } = require("../../services/kingdomService");\nconst supabaseService = require("../../services/supabase");'
);

s = s.replace(
'  const units = RACE_UNITS[race];',
`  const units = RACE_UNITS[race];

  let eliteBonus = 0;
  let defSpecBonus = 0;

  const supabase = supabaseService.getClient();

  const { data: clericMods } = await supabase
    .from("personality_modifiers")
    .select("*")
    .eq("personality_name", "The Cleric")
    .eq("age_number", 116);

  for (const mod of clericMods || []) {
    if (mod.modifier_type === "elite_def_value") eliteBonus = Number(mod.value);
    if (mod.modifier_type === "def_spec_strength") defSpecBonus = Number(mod.value);
  }

  const eliteDef = units.eliteDef + eliteBonus;
  const defSpecDef = units.defSpecDef + defSpecBonus;`
);

s = s.replace(
'(elites * units.eliteDef) +\n    (offspecs * units.defSpecDef)',
'(elites * eliteDef) +\n    (offspecs * defSpecDef)'
);

s = s.replace('${units.eliteDef} def', '${eliteDef} def');
s = s.replace('${units.defSpecDef} (def spec value)', '${defSpecDef} (def spec value)');

fs.writeFileSync(file, s);
console.log("Cleric ambush fix applied");
