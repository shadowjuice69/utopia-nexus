const { parseAttacks } = require("./attackParser");
const { parseSpy } = require("./spyParser");
const { parseSpells } = require("./spellParser");
const { parseScienceEvents } = require("./scienceParser");
const { parseMilitaryEvents } = require("./militaryParser");
const { parseEconomyEvents } = require("./economyParser");
const { parseEvents } = require("./eventParser");


function parseNewsLog(text) {

  const lines = text
    .split(/\r?\n/)
    .map(raw => raw.trim())
    .filter(Boolean)
    .map(line => {

      const parts = line.split(/\t+/);

      if (parts.length >= 2) {
        return {
          date: parts[0],
          text: parts.slice(1).join(" ").trim()
        };
      }

      const dateMatch = line.match(
        /^(January|February|March|April|May|June|July|August|September|October|November|December) \d+ of YR\d+/
      );

      return {
        date: dateMatch ? dateMatch[0] : null,
        text: dateMatch
          ? line.substring(dateMatch[0].length).trim()
          : line
      };
    });


  return {
    attacks: parseAttacks(lines),
    intel: parseSpy(lines),
    spells: parseSpells(lines),
    science: parseScienceEvents(lines),
    military: parseMilitaryEvents(lines),
    economy: parseEconomyEvents(lines),
    events: parseEvents(lines)
  };
}


module.exports = {
  parseNewsLog
};
