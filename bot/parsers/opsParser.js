python3 <<'EOF'
from pathlib import Path

path = Path("bot/parsers/opsParser.js")

text = path.read_text()

old = """  return {
    type: "self_spell",
    category: "sorcery",
    spell,
    casterProvince,
    targetProvince: null,
    targetKingdom: null,
    success,
    resultValue,
  };"""

new = """  return {
    type: "spell",
    category: "sorcery",
    op: spell,
    attackerProvince: casterProvince,
    targetProvince: null,
    targetKingdom: null,
    success,
    resultValue
  };"""

if old not in text:
    raise SystemExit("Target block not found")

text = text.replace(old, new)

old2 = """  const casterProvince = match[1].replace(/\\s+\\S+#$/, "").trim();"""

new2 = """  const casterProvince = cleanEmoji(match[1])
    .replace(/\\s+\\S+#$/, "")
    .trim();"""

if old2 in text:
    text = text.replace(old2, new2)

path.write_text(text)

print("Spell parser patched")
