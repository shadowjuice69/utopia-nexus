const supabaseService = require("./supabase");
const logger = require("./logger");

function getRating(ratio) {
  if (ratio >= 4) return "VERY STRONG";
  if (ratio >= 3) return "STRONG";
  if (ratio >= 2) return "DECENT";
  if (ratio >= 1.5) return "RISKY";
  return "POOR";
}

async function getFormula(operation) {
  const supabase = supabaseService.getClient();

  const { data, error } = await supabase
    .from("thievery_formulas")
    .select("*")
    .eq("operation", operation.toLowerCase())
    .single();

  if (error) {
    logger.error(`[FORMULA ERROR] ${error.message}`);
    return null;
  }

  return data;
}

async function getModifiers(names = []) {
  const supabase = supabaseService.getClient();

  const { data, error } = await supabase
    .from("province_modifiers")
    .select("*")
    .in("name", names.map(n => n.toLowerCase()));

  if (error) {
    logger.error(`[MODIFIER ERROR] ${error.message}`);
    return [];
  }

  return data || [];
}

async function calculateModifiedTPA(rawTPA, modifiers = []) {
  let multiplier = 1;
  const breakdown = [];

  for (const mod of modifiers) {
    if (mod.modifier_type === "tpa_bonus") {
      multiplier += (Number(mod.value) / 100);

      breakdown.push({
        name: mod.name,
        type: "TPA BONUS",
        bonus: String(mod.value) + "%"
      });
    }

    if (mod.modifier_type === "thief_defense") {
      multiplier += (Number(mod.value) / 100);

      breakdown.push({
        name: mod.name,
        type: "THIEF DEFENSE",
        bonus: String(mod.value) + "%"
      });
    }
  }

  return {
    modifiedTPA: Number((rawTPA * multiplier).toFixed(2)),
    breakdown
  };
}

async function calculateThieves({
  operation,
  yourTPA,
  targetTPA,
  thievesAvailable,
  yourModifiers = [],
  targetModifiers = []
}) {
  try {
    const formula = await getFormula(operation);

    if (!formula) {
      return {
        error: "No formula found for operation"
      };
    }

    const attackerMods = await getModifiers(yourModifiers);
    const defenderMods = await getModifiers(targetModifiers);

    const attackerTPA = await calculateModifiedTPA(
      yourTPA,
      attackerMods
    );

    const defenderTPA = await calculateModifiedTPA(
      targetTPA,
      defenderMods
    );

    const ratio =
      attackerTPA.modifiedTPA /
      defenderTPA.modifiedTPA;

    let recommendedPercent = 0.7;

    if (ratio < 2) recommendedPercent = 0.9;
    if (ratio >= 3) recommendedPercent = 0.6;
    if (ratio >= 5) recommendedPercent = 0.5;

    return {
      operation,
      rawTPA: {
        attacker: yourTPA,
        target: targetTPA
      },
      modifiedTPA: {
        attacker: attackerTPA.modifiedTPA,
        target: defenderTPA.modifiedTPA
      },
      ratio: Number(ratio.toFixed(2)),
      rating: getRating(ratio),
      recommendedThieves: Math.floor(
        thievesAvailable * recommendedPercent
      ),
      modifiers: {
        attacker: attackerTPA.breakdown.map(m =>
          `${m.name}: ${m.bonus}`
        ),
        target: defenderTPA.breakdown.map(m =>
          `${m.name}: ${m.bonus}`
        )
      },
      formulaUsed: formula.success_formula
    };

  } catch (err) {
    logger.error(`[THIEVERY CALC ERROR] ${err.message}`);
    return null;
  }
}

module.exports = {
  calculateThieves
};
