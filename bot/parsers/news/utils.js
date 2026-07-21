function cleanNumber(value) {
  if (!value) return null;
  return Number(value.toString().replace(/,/g, "").trim());
}

function extractDate(line) {
  const match = line.match(/^(January|February|March|April|May|June|July|August|September|October|November|December) \d+ of YR\d+/);
  return match ? match[0] : null;
}

function extractTarget(line) {
  const match = line.match(/\((\d+:\d+)\)/);
  return match ? match[1] : null;
}

function extractProvince(line) {
  const match = line.match(/arrive at (.+?) \(\d+:\d+\)/i);
  return match ? match[1].trim() : null;
}

module.exports = {
  cleanNumber,
  extractDate,
  extractTarget,
  extractProvince
};
