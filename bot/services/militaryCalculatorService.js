const supabaseService = require("./supabase");
const logger = require("./logger");

async function getPersonalityModifiers(personality, age = 116) {
  const supabase = supabaseService.getClient();

  const { data, error } = await supabase
    .from("personality_modifiers")
    .select("*")
    .eq("personality_name", personality)
    .eq("age_number", age)
    .eq("active", true);

  if (error) {
    logger.error(`[MIL MOD ERROR] ${error.message}`);
    return [];
  }

  return data || [];
}

async function getMilitaryModifiers({
  race,
  personality,
  age = 116
}) {
  const modifiers = {
    eliteDef: 0,
    defSpecStrength: 0,
    offEliteStrength: 0,
    militaryEfficiency: 0,
    casualties: 0
  };

  const personalityMods = await getPersonalityModifiers(
    personality,
    age
  );

  for (const mod of personalityMods) {

    if (mod.modifier_type === "elite_def_value") {
      modifiers.eliteDef += Number(mod.value);
    }

    if (mod.modifier_type === "def_spec_strength") {
      modifiers.defSpecStrength += Number(mod.value);
    }

    if (mod.modifier_type === "off_elite_strength") {
      modifiers.offEliteStrength += Number(mod.value);
    }

    if (mod.modifier_type === "military_efficiency") {
      modifiers.militaryEfficiency += Number(mod.value);
    }

    if (mod.modifier_type === "casualties") {
      modifiers.casualties += Number(mod.value);
    }
  }

  return modifiers;
}

function applyDefenseModifiers(units, modifiers) {
  return {
    eliteDef:
      units.eliteDef + modifiers.eliteDef,

    defSpecDef:
      units.defSpecDef + modifiers.defSpecStrength,

    soldierOff:
      units.soldierOff
  };
}

module.exports = {
  getMilitaryModifiers,
  applyDefenseModifiers
};
