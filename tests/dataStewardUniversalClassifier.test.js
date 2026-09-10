const assert = require('assert');
const { classifyUniversalCapture } = require('../bot/services/dataStewardUniversalClassifier');

const cases = [
  ['throne', { url: 'https://intel.utopia-game.com/throne', tab: 'Throne' }],
  ['survey', { url: 'https://intel.utopia-game.com/survey', tab: 'Survey' }],
  ['science', { url: 'https://intel.utopia-game.com/science', tab: 'Science' }],
  ['som', { url: 'https://intel.utopia-game.com/military', tab: 'Military' }],
  ['state', { url: 'https://intel.utopia-game.com/state', tab: 'State' }],
  ['news', { url: 'https://intel.utopia-game.com/news', tab: 'News' }],
  ['kingdom-page', { url: 'https://intel.utopia-game.com/kingdom', tab: 'Kingdom' }],
  ['kd-stats-generic', { url: 'https://intel.utopia-game.com/stats', tab: 'KD Stats' }],
  ['attack', { url: 'https://intel.utopia-game.com/war', tab: 'Battle Report', text: 'captured acres and troops lost' }],
  ['spell', { url: 'https://intel.utopia-game.com/magic', tab: 'Magic', text: 'spell successfully cast' }],
  ['thievery', { url: 'https://intel.utopia-game.com/thievery', tab: 'Thievery', text: 'operation stole resources' }]
];

for (const [expected, capture] of cases) {
  const result = classifyUniversalCapture(capture);
  assert.strictEqual(result.type, expected, `${expected} classified as ${result.type}`);
  assert.ok(result.confidence >= 75, `${expected} confidence too low: ${result.confidence}`);
}

const unknown = classifyUniversalCapture({
  url: 'https://intel.utopia-game.com/something-new',
  tab: 'Brand New Utopia Page',
  text: 'future page with unfamiliar content'
});
assert.strictEqual(unknown.type, null);
assert.strictEqual(unknown.ambiguous, true);

console.log('Universal Steward classifier tests passed.');
