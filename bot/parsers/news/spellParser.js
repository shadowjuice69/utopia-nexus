function parseSpell(line, date) {
  const result = {
    type: "spell",
    date,
    success: line.includes("spell succeeds")
  };

  const runes = line.match(/gather ([\d,]+) runes/i);
  if (runes) {
    result.runes_used = Number(runes[1].replace(/,/g, ""));
  }

  if (line.includes("Nature blesses our lands")) {
    result.effect = "Nature's Blessing";
  }

  if (line.includes("magic shield wards our province")) {
    result.effect = "Magic Shield";
  }

  if (line.includes("mist shrouds our lands")) {
    result.effect = "Mist";
  }

  if (line.includes("Pitfalls riddle our lands")) {
    result.effect = "Pitfalls";
  }

  if (line.includes("fit of gluttony grips our people")) {
    result.effect = "Gluttony";
  }

  const duration = line.match(/for (\d+) days/i);
  if (duration) {
    result.duration_days = Number(duration[1]);
  }

  if (line.includes("ritual project")) {
    result.effect = "Ritual Progress";
  }

  return result;
}


function parseSpells(lines) {
  const results = [];

  for (const line of lines) {
    const text = line.text || line;

    if (
      text.includes("wizards gather") ||
      text.includes("Pitfalls") ||
      text.includes("gluttony") ||
      text.includes("Nature blesses") ||
      text.includes("magic shield") ||
      text.includes("mist shrouds")
    ) {
      results.push(parseSpell(text, line.date));
    }
  }

  return results;
}


module.exports = {
  parseSpells
};
