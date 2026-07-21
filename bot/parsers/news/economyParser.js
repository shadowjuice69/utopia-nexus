const { cleanNumber } = require("./utils");

function parseEconomy(line, date) {

  const stolen = line.match(/([\d,]+) runes were stolen from our Towers/i);

  if (stolen) {
    return {
      type: "economy",
      date,
      event: "resource_stolen",
      resource: "runes",
      amount: cleanNumber(stolen[1])
    };
  }


  const gold = line.match(/receives ([\d,]+) gold/i);

  if (gold) {
    return {
      type: "economy",
      date,
      event: "gold_received",
      amount: cleanNumber(gold[1])
    };
  }


  return null;
}


function parseEconomyEvents(lines) {
  const results = [];

  for (const line of lines) {
    const parsed = parseEconomy(line.text, line.date);

    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}


module.exports = {
  parseEconomyEvents
};
