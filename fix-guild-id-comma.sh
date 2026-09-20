#!/data/data/com.termux/files/usr/bin/bash
# Run from the BOT repo root: cd ~/utopia-nexus && bash fix-guild-id-comma.sh
# GUILD_ID is set to two comma-joined guild IDs on Render, but bot/core/commands.js
# treated the whole string as a single guild ID, breaking command registration.
# This makes it split on commas (and still works fine if GUILD_ID only ever holds one ID).
set -e

cat > ./_fix-guild-id.js << 'EOF'
const fs = require('fs');
const path = 'bot/core/commands.js';
let src = fs.readFileSync(path, 'utf8');

const old = "const guildIds=[process.env.GUILD_ID||'1534817549374455848'];";
const fixed = "const guildIds=(process.env.GUILD_ID||'1534817549374455848').split(',').map(s=>s.trim()).filter(Boolean);";

if (!src.includes(old)) {
  console.error('EXACT LINE NOT FOUND — aborting, no changes made. bot/core/commands.js may have changed since this was written.');
  process.exit(1);
}
fs.writeFileSync(path, src.replace(old, fixed));
console.log('patched OK');
EOF

node ./_fix-guild-id.js
rm ./_fix-guild-id.js

echo ""
echo "Verifying syntax..."
node --check bot/core/commands.js && echo "bot/core/commands.js: syntax OK"

echo ""
echo "Next: git add -A && git commit -m 'Fix comma-separated GUILD_ID breaking command registration' "
echo "      git push"
