const test = require("node:test");
const assert = require("node:assert/strict");
const {
  detectKind,
  parseUniversalCapture,
  parseKingdomDetails,
} = require("../parsers/universalCaptureParser");

function kingdomHtml(race = "Avian") {
  const rows = Array.from({ length: 25 }, (_, index) => {
    const slot = index + 1;
    return `<tr><td>${slot}</td><td>Province ${slot}</td><td>${race}</td><td>${2000 + slot},000a</td><td>${500000 + slot},000gc</td><td>250gc</td><td>${slot === 15 ? "King" : "Count"}</td><td>${slot}</td></tr>`;
  }).join("");
  return `<h2 class="change-kingdom-heading">Kingdom of Test (6:5)</h2><table class="two-column-stats"><tr><th>Total Provinces</th><td>25</td></tr></table><table id="clone_kingdom"><tbody>${rows}</tbody></table>`;
}

test("detectKind routes all supported page families", () => {
  assert.equal(detectKind("/wol/game/kingdom_details/6/5", ""), "kingdom");
  assert.equal(detectKind("/wol/game/throne", ""), "throne");
  assert.equal(detectKind("/wol/game/council_state", ""), "state");
  assert.equal(detectKind("/wol/game/council_science", ""), "science");
  assert.equal(detectKind("/wol/game/survey", ""), "survey");
  assert.equal(detectKind("/wol/game/military", ""), "som");
  assert.equal(detectKind("/wol/game/enchantment", ""), "magic");
  assert.equal(detectKind("/wol/game/thievery", ""), "thievery");
  assert.equal(detectKind("/wol/game/province_news", ""), "news");
});

test("Kingdom Details parses all 25 rows including Avian", () => {
  const html = kingdomHtml("Avian");
  const result = parseKingdomDetails(html, html);
  assert.equal(result.province_count_parsed, 25);
  assert.equal(result.provinces.length, 25);
  assert.deepEqual(result.provinces.map(p => p.slot), Array.from({ length: 25 }, (_, i) => i + 1));
  assert.equal(result.provinces[14].race, "Avian");
  assert.equal(result.provinces[14].nobility, "King");
});

test("Universal capture preserves raw HTML for Kingdom parsing", () => {
  const html = kingdomHtml();
  const result = parseUniversalCapture("https://utopia-game.com/wol/game/kingdom_details/6/5", "", html);
  assert.equal(result.type, "kingdom");
  assert.equal(result.kind, "kingdom");
  assert.equal(result.data.province_count_parsed, 25);
  assert.equal(result.data.provinces[14].race, "Avian");
});
