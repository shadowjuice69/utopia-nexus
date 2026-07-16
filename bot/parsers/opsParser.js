function cleanEmoji(line) {
  return line
    .replace(/^:[^:]+::[^:]+:\s*/g, "")
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
  line = cleanEmoji(line.trim());
  const match = line.match(/^(.*?)\s+<<__(.+?)__\s+\*\*\|\s*(.*?)\s+\((\d+:\d+)\)\*\*>>\s*(.*)$/s);
  if (!match) return null;

  const attackerProvince = match[1].replace(/\s+\[[^\]]+\]/, "").replace(/\s+\S+#$/, "").trim();
  const op = match[2].toLowerCase().trim();
  const targetProvince = match[3].trim();
  const targetKingdom = match[4];
  const resultText = match[5];
  const result = resultText.match(/\*\*([\d,]+)\*\*/);
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

function parseOpsMessage(msgObj) {
  const ops = [];
  const atks = [];
  const spells = [];

  if (!msgObj || !msgObj.content) return { ops, atks, spells };

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
    }
  }

  return { ops, atks, spells };
}

module.exports = { parseOpLine, parseAttackLine, parseOpsMessage };
