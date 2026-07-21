const { cleanNumber } = require("./utils");

function parseScience(line, date) {

  const match = line.match(/([\d,]+)\s+books allocated to\s+([A-Z]+)/i);

  if (!match) return null;

  return {
    type: "science",
    date,
    raw_text: line,
    books: cleanNumber(match[1]),
    category: match[2].toLowerCase()
  };
}


function parseScienceEvents(lines) {

  const results = [];

  for (const item of lines) {

    const parsed = parseScience(item.text, item.date);

    if (parsed) {
      results.push(parsed);
    }

  }

  return results;
}


module.exports = {
  parseScienceEvents
};
