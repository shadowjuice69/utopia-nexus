function parseKingdom(text) {
  const result = {
    kd_code: null,
    kingdom_name: null,
    provinces: []
  };

  const kd = text.match(/\((\d+:\d+)\)/);
  if (kd) result.kd_code = kd[1];

  const name = text.match(/The kingdom of (.+?) \(/i);
  if (name) result.kingdom_name = name[1].trim();

  const lines = text.split("\n").map(x => x.trim()).filter(Boolean);

  for (const line of lines) {
    if (line.includes(":") && !line.includes("The kingdom")) {
      result.provinces.push(line);
    }
  }

  return result;
}

module.exports = { parseKingdom };
