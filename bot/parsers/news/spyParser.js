const { cleanNumber, extractTarget } = require("./utils");

function parseMilitaryIntel(line, date) {
  const result = {
    type: "intel",
    category: "military",
    raw_text: line,
    date,
    coordinates: extractTarget(line)
  };

  const ruler = line.match(/Military Elders of (.+?):/i);
  if (ruler) result.ruler = ruler[1].trim();

  const generals = line.match(/(\d+) generals? are available/i);
  if (generals) result.generals = cleanNumber(generals[1]);

  const off = line.match(/Offense: ([\d.]+)% effectiveness with ([\d,]+) net Offensive Points/i);
  if (off) {
    result.offense_effectiveness = Number(off[1]);
    result.offense_points = cleanNumber(off[2]);
  }

  const def = line.match(/Defense: ([\d.]+)% effectiveness with ([\d,]+) net Defensive Points/i);
  if (def) {
    result.defense_effectiveness = Number(def[1]);
    result.defense_points = cleanNumber(def[2]);
  }

  return result;
}


function parseThievery(line, date) {
  const result = {
    type: "intel",
    category: "thievery",
    raw_text: line,
    date,
    coordinates: extractTarget(line)
  };

  const lost = line.match(/lost ([\d,]+) thieves/i);
  if (lost) {
    result.success = false;
    result.thieves_lost = cleanNumber(lost[1]);
  }

  const resource = line.match(/thieves (?:stole|returned with) ([\d,]+) (runes|bushels)/i);

  if (resource) {
    result.success = true;
    result.resource = resource[2];
    result.amount = cleanNumber(resource[1]);
  }

  const sent = line.match(/sent ([\d,]+)/i);
  if (sent) result.thieves_sent = cleanNumber(sent[1]);

  const bonus = line.match(/dealt ([\d]+)% additional damage/i);
  if (bonus) {
    result.modifier = Number(bonus[1]);
    result.modifier_type = "infiltration";
  }

  const penalty = line.match(/dealing ([\d]+)% less damage/i);
  if (penalty) {
    result.modifier = Number(penalty[1]);
    result.modifier_type = "cover_blown";
  }

  return result;
}


function parseSpy(lines) {
  const results = [];

  for (const line of lines) {
    const text = line.text;

    if (text.includes("Military Elders")) {
      results.push(parseMilitaryIntel(text, line.date));
    }

    if (
      text.includes("lost") && text.includes("thieves") ||
      text.includes("thieves stole") ||
      text.includes("thieves returned with")
    ) {
      results.push(parseThievery(text, line.date));
    }
  }

  return results;
}


module.exports = {
  parseSpy
};
