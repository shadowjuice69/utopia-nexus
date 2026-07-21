const {
  cleanNumber,
  extractTarget,
  extractProvince
} = require("./utils");


function parseOutgoingAttack(line, date) {
  const result = {
    type: "attack",
    direction: "outgoing",
    raw_text: line,
    date,
    target_province: extractProvince(line),
    target_coordinates: extractTarget(line),
    result: line.includes("victory") ? "victory" : "unknown"
  };

  const acres = line.match(/taken ([\d,]+) acres/i);
  if (acres) result.acres_taken = cleanNumber(acres[1]);

  const buildings = line.match(/([\d,]+) acres of buildings survived/i);
  if (buildings) result.buildings_survived = cleanNumber(buildings[1]);

  const credits = line.match(/gained ([\d,]+) specialist training credits/i);
  if (credits) result.specialist_training_credits = cleanNumber(credits[1]);

  const peasants = line.match(/([\d,]+) peasants settled/i);
  if (peasants) result.peasants_gained = cleanNumber(peasants[1]);

  const honor = line.match(/gained ([\d,]+) honor/i);
  if (honor) result.honor_gained = cleanNumber(honor[1]);

  const qbs = line.match(/lost ([\d,]+) Quickblades/i);
  if (qbs) result.quickblades_lost = cleanNumber(qbs[1]);

  const horses = line.match(/and ([\d,]+) horses/i);
  if (horses) result.horses_lost = cleanNumber(horses[1]);

  const elites = line.match(/([\d,]+) of your specialists have been promoted to elites/i);
  if (elites) result.elites_promoted = cleanNumber(elites[1]);

  const kills = line.match(/killed about ([\d,]+) enemy troops/i);
  if (kills) result.enemy_kills = cleanNumber(kills[1]);

  const imprisoned = line.match(/imprisoned ([\d,]+) additional troops/i);
  if (imprisoned) result.enemy_imprisoned = cleanNumber(imprisoned[1]);

  const offense = line.match(/sent ([\d,]+)/i);
  if (offense) result.offense_sent = cleanNumber(offense[1]);

  const returnTime = line.match(/available again in ([\d.]+) days/i);
  if (returnTime) result.return_days = Number(returnTime[1]);

  return result;
}


function parseIncomingAttack(line, date) {
  const attacker = line.match(/Forces from (.+?) \(([^)]+)\)/i);

  const result = {
    type: "attack",
    direction: "incoming",
    raw_text: line,
    date,
    attacker_province: attacker ? attacker[1] : null,
    attacker_coordinates: attacker ? attacker[2] : null
  };

  const acres = line.match(/captured ([\d,]+) acres/i);
  if (acres) result.acres_lost = cleanNumber(acres[1]);

  const honor = line.match(/reduced our honor by ([\d,]+)/i);
  if (honor) result.honor_lost = cleanNumber(honor[1]);

  const soldiers = line.match(/lost ([\d,]+) soldiers/i);
  if (soldiers) result.soldiers_lost = cleanNumber(soldiers[1]);

  const pikemen = line.match(/([\d,]+) Pikemen/i);
  if (pikemen) result.pikemen_lost = cleanNumber(pikemen[1]);

  const golems = line.match(/([\d,]+) Golems/i);
  if (golems) result.golems_lost = cleanNumber(golems[1]);

  return result;
}


function parseAttacks(lines) {
  const attacks = [];

  for (const line of lines) {
    const text = line.text;

    if (text.includes("Your forces arrive at")) {
      attacks.push(parseOutgoingAttack(text, line.date));
    }

    if (text.includes("Forces from") && text.includes("captured")) {
      attacks.push(parseIncomingAttack(text, line.date));
    }
  }

  return attacks;
}


module.exports = {
  parseAttacks
};
