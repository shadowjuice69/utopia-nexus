require('dotenv').config();
require('../services/supabase');
const { approveAgeUpdate } = require('../services/ageUpdateService');

async function main() {
  const result = await approveAgeUpdate(4, 'manual_reapply');
  if (result && result.stats) {
    console.log('✅ Applied successfully!');
    console.log(result.stats.summary);
    console.log(`Race rows: ${result.stats.raceRows}`);
    console.log(`Personality rows: ${result.stats.personalityRows}`);
    console.log(`Game rows: ${result.stats.gameRows}`);
  } else {
    console.log('❌ Failed:', result);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
