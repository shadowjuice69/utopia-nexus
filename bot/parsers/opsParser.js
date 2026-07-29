function cleanEmoji(line) {
  return line
    .replace(/^(:[^:]+:\s*)+/g, "")
    .replace(/^[\p{Emoji}\uFE0F\u200D]+/gu, "")
    .trim();
}

function classifyOp(op) {
  const thievery = [
    "rob the vaults","rob the towers","rob the granaries","steal war horses",
    "arson","kidnap","night strike","assassinate wizards","sabotage wizards",
    "spy on throne","spy on military","spy on defense","spy on troops",
    "survey","bribe generals","infiltrate thieves guild"
  ];

  const sorcery = [
    "fireball","lightning strike","nightmare","tornadoes","soul blight",
    "pitfalls","land lust","crystal ball","crystal eye","meteor showers",
    "vermin","drought","gluttony","greed","sloth"
  ];

  if (thievery.includes(op)) return "thievery";
  if (sorcery.includes(op)) return "sorcery";
  return "unknown";
}

function parseOpLine(line) {
  const match = line.match(/^(.*?)\s+<<__(.+?)__\s+\*\*\|\s*(.*?)\s+\((\d+:\d+)\)\*\*>>\s*(.*)$/s);
  if (!match) return null;

  const attackerProvince = match[1]
  .replace(/:[^:\s]+:/g, "")
  .replace(/\s+\[[^\]]+\]/, "")
  .replace(/\s+\S+#$/, "")
  .trim();
  const op = match[2].toLowerCase().trim();
  const targetProvince = match[3].trim();
  const targetKingdom = match[4];
  const resultText = match[5];
  const result = resultText.match(/^(\d[\d,]*)/);
  const sent = resultText.match(/(\d+)\s+sent/);
  const thiefLoss = resultText.match(/-\s*(\d+)\s+thieves/);
  const wizardLoss = resultText.match(/-\s*(\d+)\s+wizards/);

  return {
    type: "op",
    category: classifyOp(op),
    op,
    attackerProvince,
    targetProvince,
    targetKingdom,
    success: !resultText.includes("FAIL"),
    resultValue: result ? Number(result[1].replace(/,/g, "")) : null,
    thievesSent: sent ? Number(sent[1]) : null,
    thievesLost: thiefLoss ? Number(thiefLoss[1]) : null,
    wizardsLost: wizardLoss ? Number(wizardLoss[1]) : null
  };
}

function parseAttackLine(line) {
  line = line.trim();
  if (!line.includes("attacked")) return null;
  line = cleanEmoji(line);
  const match = line.match(/^(.*?)\s+\[.*?\]\s+attacked\s+__(.*?)__\s+\((\d+:\d+)\)\|(.*)$/s);
  if (!match) return null;

  const fields = match[4];
  const getNumber = (regex) => {
    const result = fields.match(regex);
    return result ? parseInt(result[1].replace(/,/g, ""), 10) : null;
  };

  return {
    type: "attack",
    attackType: fields.toLowerCase().includes("ambush") ? "ambush" : "traditional",
    attackerProvince: match[1].trim(),
    targetProvince: match[2].trim(),
    targetKingdom: match[3],
    acresCaptured: getNumber(/captured:\s*\*\*([\d,]+)\*\*/),
    offenseSent: getNumber(/(\d+)off/),
    peasants: getNumber(/([\d,]+)\s+peasants/),
    specCredits: getNumber(/([\d,]+)\s+spec creds/),
    kills: getNumber(/kills:\s*\*\*([\d,]+)/),
    prisoners: getNumber(/\(\+([\d,]+)\s+prisoners\)/)
  };
}

function parseKdNewsLine(line) {
  // Handles:
  // NEW KDNEWS: 1 - Attacker (2:11) invaded 23 - Target (3:2) and captured 43 acres of land.
  // NEW KDNEWS: 6 - Attacker (4:2) ambushed armies from 4 - Target (3:2) and took 26 acres of land.

  const m = line.match(
    /NEW KDNEWS:.*?-\s*(.+?)\s*\((\d+:\d+)\)\s*(?:invaded\s*\d+\s*-\s*|ambushed armies from\s*\d+\s*-\s*)(.+?)\s*\((\d+:\d+)\)\s*(?:and captured|and took)\s*(\d+)\s*acres/i
  );

  if (!m) return null;

  return {
    type: "incoming_attack",
    attackerProvince: m[1].trim(),
    attackerKingdom: m[2],
    targetProvince: m[3].trim(),
    targetKingdom: m[4],
    acresCaptured: parseInt(m[5], 10),
  };
}


function parseSelfSpellLine(line) {
  line = cleanEmoji(line.trim());
  // Format: Province slug# <<spell_name>> result | % guilds (BE (m.X))
  // or:     Province slug# <<spell_name>> FAIL | % guilds (BE (m.X))
  const match = line.match(/^(.*?)\s+<<([^>]+)>>\s*(FAIL|\d+)?\s*\|?\s*(.*)$/s);
  if (!match) return null;

  const casterProvince = match[1]
    .replace(/:[^:\s]+:/g, "")
    .replace(/\s+\[[^\]]+\]/, "")
    .replace(/\s+\S+#$/, "")
    .replace(/\s+([a-z]+(?:[-\s][a-z]+)*)$/i, "")
    .trim();

  const spell = match[2].toLowerCase().trim();
  const resultRaw = match[3] || "";
  const success = resultRaw !== "FAIL";
  const resultValue = success && resultRaw ? parseInt(resultRaw) : null;

  return {
    type: "self_spell",
    category: "sorcery",
    spell,
    attackerProvince: casterProvince,
    casterProvince,
    targetProvince: null,
    targetKingdom: null,
    success,
    resultValue,
  };
}
function parseOpsMessage(msgObj) {
  const ops = [];
  const atks = [];
  const spells = [];
  const incomingAtks = [];
  const selfSpells = [];

  if (!msgObj || !msgObj.content) return { ops, atks, spells, incomingAtks };

  for (const line of msgObj.content.split("\n")) {
    const attack = parseAttackLine(line);
    if (attack) {
      attack.msgId = msgObj.id;
      attack.timestamp = msgObj.timestamp;
      atks.push(attack);
      continue;
    }

    const op = parseOpLine(line);
    if (op) {
      op.msgId = msgObj.id;
      op.timestamp = msgObj.timestamp;
      if (op.category === "sorcery") spells.push(op);
      else ops.push(op);
      continue;
    }

    const selfSpell = parseSelfSpellLine(line);
    if (selfSpell) {
      selfSpell.msgId = msgObj.id;
      selfSpell.timestamp = msgObj.timestamp;
      selfSpells.push(selfSpell);
    }
  }

  // Parse KDNEWS incoming attacks
  const lines = msgObj.content.split("\n");

  for (const line of lines) {
    const kdnews = parseKdNewsLine(line);
    if (kdnews) {
      kdnews.msgId = msgObj.id;
      kdnews.timestamp = msgObj.timestamp;
      incomingAtks.push(kdnews);
    }
  }

  return { ops, atks, spells, incomingAtks, selfSpells };
}

module.exports = { parseOpLine, parseAttackLine, parseSelfSpellLine, parseOpsMessage };
