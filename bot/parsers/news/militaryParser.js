const { cleanNumber } = require("./utils");

function parseTraining(line, date) {
  const result = {
    type: "military_training",
    date,
    raw_text: line
  };

  const training = line.match(/ordered that ([\d,]+) ([A-Za-z]+) be trained/i);

  if (!training) return null;

  result.amount = cleanNumber(training[1]);
  result.unit = training[2];

  return result;
}

function parsePromotion(line, date) {
  const result = {
    type: "military_promotion",
    date,
    raw_text: line
  };

  const promotion = line.match(/([\d,]+) of your specialists have been promoted to elites/i);

  if (!promotion) return null;

  result.amount = cleanNumber(promotion[1]);
  result.unit = "elites";

  return result;
}

function parseMilitaryEvents(lines) {
  const results = [];

  for (const line of lines) {
    const text = line.text || line;

    if (text.includes("ordered that")) {
      const parsed = parseTraining(text, line.date);
      if (parsed) results.push(parsed);
    }

    if (text.includes("promoted to elites")) {
      const parsed = parsePromotion(text, line.date);
      if (parsed) results.push(parsed);
    }
  }

  return results;
}

module.exports = {
  parseMilitaryEvents
};
