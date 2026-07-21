const supabaseService = require("./supabase");
const logger = require("./logger");

const supabase = supabaseService.getClient();

async function saveNewsAttack(attack) {
  if (!supabase) return;

  const { error } = await supabase.from("attacks").insert({
    timestamp: new Date().toISOString(),
    attack_type: attack.direction,
    attacker_province: attack.attacker_province,
    target_province: attack.target_province,
    acres_captured: attack.acres_taken,
    acres_lost: attack.acres_lost,
    honor_gained: attack.honor_gained,
    honor_lost: attack.honor_lost,
    raw_text: attack.raw_text
  });

  if (error) logger.error(`[NEWS ATTACK ERROR] ${error.message}`);
}

async function saveNewsSpell(spell) {
  if (!supabase) return;

  const { error } = await supabase.from("spell_events").insert({
    timestamp: new Date().toISOString(),
    spell_name: spell.effect,
    success: spell.success,
    result_value: spell.duration_days,
    category: "news",
    raw_text: spell.raw_text
  });

  if (error) logger.error(`[NEWS SPELL ERROR] ${error.message}`);
}

async function saveNewsIntel(intel) {
  if (!supabase) return;

  logger.info(`[NEWS INTEL] ${intel.category} ${intel.coordinates || ""}`);
}

async function saveNews(parsed) {
  for (const attack of parsed.attacks || []) {
    await saveNewsAttack(attack);
  }

  for (const spell of parsed.spells || []) {
    await saveNewsSpell(spell);
  }

  for (const intel of parsed.intel || []) {
    await saveNewsIntel(intel);
  }
}

module.exports = {
  saveNews
};
