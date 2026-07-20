from pathlib import Path

p = Path("bot/handlers/modalHandler.js")
s = p.read_text()

block = """    console.log("[DEBUG INTEL MATCH]", {
      name: parsed.name,
      ruler: parsed.ruler,
      nw: parsed.nw,
      acres: parsed.acres
    });

"""

if block not in s:
    print("Debug block not found")
    exit(1)

p.write_text(s.replace(block, "", 1))
print("Removed debug log")
