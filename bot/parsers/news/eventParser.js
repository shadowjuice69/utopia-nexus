const { cleanNumber } = require("./utils");

function parseEvent(line, date) {
  const result = {
    type: "province_event",
    date
  };

  if (line.includes("settled") && line.includes("acres")) {
    const acres = line.match(/settled ([\d,]+) acres/i);

    if (acres) {
      result.event = "exploration";
      result.acres = cleanNumber(acres[1]);
    }
  }

  if (line.includes("new scientist")) {
    const scientist = line.match(
      /scientist, (.+?) \((.+?)\), has emerged/i
    );

    if (scientist) {
      result.event = "scientist_joined";
      result.scientist = scientist[1];
      result.field = scientist[2];
    }
  }

  if (line.includes("increasing our defensive losses")) {
    result.event = "province_effect";
    result.effect = "Pitfalls";

    const days = line.match(/for (\d+) days/i);
    if (days) result.duration_days = Number(days[1]);
  }

  if (line.includes("increasing our food consumption")) {
    result.event = "province_effect";
    result.effect = "Gluttony";

    const days = line.match(/for (\d+) days/i);
    if (days) result.duration_days = Number(days[1]);
  }

  return Object.keys(result).length > 2 ? result : null;
}


function parseEvents(lines) {
  const results = [];

  for (const line of lines) {
    const text = line.text || line;

    const parsed = parseEvent(text, line.date);

    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}


module.exports = {
  parseEvents
};
