// Accurate hostile meter calculator based on Age 116 wiki rules

const ATTACK_POINTS = {
  "traditional march": 3,
  "conquest": 3,
  "raze": 3,
  "plunder": 3,
  "massacre": 3,
  "learn": 3,
  "ambush": 1.5,
  "bounce": 0.5 // approximate for failed attacks
};

const OP_POINTS = {
  "free prisoners": 0.03,
  "rob granaries": 0.06,
  "rob the granaries": 0.06,
  "bribe generals": 0.09,
  "rob towers": 0.09,
  "rob the towers": 0.09,
  "kidnap": 0.12,
  "rob vaults": 0.12,
  "rob the vaults": 0.12,
  "steal war horses": 0.18,
  "incite riots": 0.18,
  "night strike": 0.24,
  "sabotage wizards": 0.24,
  "arson": 0.24,
  "greater arson": 0.30,
  "assassinate wizards": 0.36
};

const SPELL_POINTS = {
  "storms": 0.06,
  "drought": 0.06,
  "gluttony": 0.09,
  "greed": 0.15,
  "sloth": 0.15,
  "lightning strike": 0.18,
  "pitfalls": 0.18,
  "fireball": 0.24,
  "tornadoes": 0.30,
  "expose thieves": 0.36,
  "fools gold": 0.42,
  "mystic vortex": 0.45,
  "nightmares": 0.45,
  "land lust": 0.60,
  "meteor showers": 0.75
};

function getMeterFromActions(attacks, ops, spells) {
  let meter = 0;

  for (const atk of (attacks || [])) {
    const type = (atk.attack_type || "traditional march").toLowerCase();
    meter += ATTACK_POINTS[type] || 3;
  }

  for (const op of (ops || [])) {
    const opName = (op.operation || "").toLowerCase();
    meter += OP_POINTS[opName] || 0.06;
  }

  for (const spell of (spells || [])) {
    const spellName = (spell.spell_name || "").toLowerCase();
    meter += SPELL_POINTS[spellName] || 0.06;
  }

  return Math.round(meter * 100) / 100;
}

function getMeterStatus(meter) {
  if (meter >= 180) return { status: "AUTO-WAR", color: "🔴", level: 4 };
  if (meter >= 60) return { status: "WAR IMMINENT", color: "🔴", level: 3 };
  if (meter >= 30) return { status: "HOSTILE", color: "🟠", level: 2 };
  if (meter >= 15) return { status: "UNFRIENDLY", color: "🟡", level: 1 };
  return { status: "NORMAL", color: "🟢", level: 0 };
}

function getActionsToNextLevel(meter) {
  if (meter >= 30) return { next: "Auto-War", actions: Math.ceil((180 - meter) / 3) };
  if (meter >= 15) return { next: "Hostile", actions: Math.ceil((30 - meter) / 3) };
  return { next: "Unfriendly", actions: Math.ceil((15 - meter) / 3) };
}

module.exports = { getMeterFromActions, getMeterStatus, getActionsToNextLevel, ATTACK_POINTS, OP_POINTS, SPELL_POINTS };
