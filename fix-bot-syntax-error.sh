#!/data/data/com.termux/files/usr/bin/bash
# Run from the BOT repo root: cd ~/utopia-nexus && bash fix-bot-syntax-error.sh
# Fixes a literal "\n" (backslash + letter n) that got typed into bot.js instead
# of an actual newline, breaking the self-ping interval line. This has been
# crash-looping the bot on every deploy since Sept 18.
set -e

cat > ./_fix-bot-syntax.js << 'EOF'
const fs = require('fs');
const path = 'bot/bot.js';
let src = fs.readFileSync(path, 'utf8');

const broken = "const SELF_HEALTH_URL = `${SELF_URL.replace(/\\/$/, '')}/health`;\\nsetInterval(() => { require('https').get(SELF_HEALTH_URL, res => { res.resume(); logger.info(`[SELF-PING] ${res.statusCode} ${SELF_HEALTH_URL}`); }).on('error', err => logger.warn(`[SELF-PING ERROR] ${err.message}`)); }, 10 * 60 * 1000);";

const fixed = "const SELF_HEALTH_URL = `${SELF_URL.replace(/\\/$/, '')}/health`;\nsetInterval(() => { require('https').get(SELF_HEALTH_URL, res => { res.resume(); logger.info(`[SELF-PING] ${res.statusCode} ${SELF_HEALTH_URL}`); }).on('error', err => logger.warn(`[SELF-PING ERROR] ${err.message}`)); }, 10 * 60 * 1000);";

if (!src.includes(broken)) {
  console.error('EXACT BROKEN LINE NOT FOUND — aborting, no changes made. Paste `sed -n \"85,95p\" bot/bot.js` again so I can re-check the exact text.');
  process.exit(1);
}
fs.writeFileSync(path, src.replace(broken, fixed));
console.log('patched OK — literal \\\\n replaced with a real newline.');
EOF

node ./_fix-bot-syntax.js
rm ./_fix-bot-syntax.js

echo ""
echo "Verifying syntax..."
node --check bot/bot.js && echo "bot/bot.js: syntax OK"

echo ""
echo "Next: git add -A && git commit -m 'Fix syntax error in bot.js self-ping (literal backslash-n)' "
echo "      git push"
