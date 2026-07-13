function cleanEmoji(line) {
  return line
    .replace(/^:[^:]+::[^:]+:\s*/g, "")
    .replace(/^[\p{Emoji}\uFE0F\u200D]+/gu, "")
    .trim();
}


function classifyOp(op) {
  const thievery = [
    "rob the vaults",
    "rob the towers",
    "rob the granaries",
    "steal war horses",
    "arson",
    "kidnap",
    "night strike",
    "assassinate wizards",
    "sabotage wizards",
    "spy on throne",
    "spy on military",
    "spy on defense",
    "spy on troops",
    "survey",
    "bribe generals",
    "infiltrate thieves guild"
  ];

  const sorcery = [
    "fireball",
    "lightning strike",
    "nightmare",
    "tornadoes",
    "soul blight",
    "pitfalls",
    "land lust",
    "crystal ball",
    "crystal eye",
    "meteor showers",
    "vermin",
    "drought",
    "gluttony",
    "greed",
    "sloth"
  ];

  if (thievery.includes(op)) return "thievery";
  if (sorcery.includes(op)) return "sorcery";

  return "unknown";
}


function parseOpLine(line) {
  line = cleanEmoji(line.trim());

  const match = line.match(
    /^(.*?)\s+<<__(.+?)__\s+\*\*\|\s*(.*?)\s+\((\d+:\d+)\)\*\*>>\s*(.*)$/s
  );

  if (!match) return null;

  const attackerProvince = match[1]
  .replace(/\s+\[[^\]]+\]/,"")
  .replace(/\s+\S+#$/,"")
  .trim();

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
    resultValue: result ? Number(result[1].replace(/,/g,"")) : null,
    thievesSent: sent ? Number(sent[1]) : null,
    thievesLost: thiefLoss ? Number(thiefLoss[1]) : null,
    wizardsLost: wizardLoss ? Number(wizardLoss[1]) : null
  };
}


function parseAttackLine(line) {
  line = cleanEmoji(line.trim());

  if (!line.includes("attacked")) return null;

  const match = line.match(
    /^(.*?)\s+\[.*?\]\s+attacked\s+__(.*?)__\s+\((\d+:\d+)\)\|(.*)$/s
  );

  if (!match) return null;

  const attackerProvince = match[1].trim();
  const targetProvince = match[2].trim();
  const targetKingdom = match[3];

  const fields = match[4];


  let attackType = "unknown";

  if (fields.includes("recaptured")) attackType = "Ambush";
  else if (fields.includes("razed")) attackType = "Raze";
  else if (fields.includes("plundered")) attackType = "Plunder";
  else if (fields.includes("learn")) attackType = "Learn";
  else if (fields.includes("killed")) attackType = "Massacre";
  else if (fields.includes("captured")) attackType = "Conquest";


  const acres = fields.match(
    /(?:captured|recaptured|razed):\s*\*\*(\d+)\*\*/
  );


  return {
    type:"attack",
    attackType,
    attackerProvince,
    targetProvince,
    targetKingdom,
    acresCaptured: acres ? Number(acres[1]) : null
  };
}


function parseOpsMessage(msgObj) {
  const ops = [];
  const atks = [];

  if (!msgObj || !msgObj.content) {
    return {ops,atks};
  }


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
      ops.push(op);
    }
  }


  return {
    ops,
    atks
  };
}


module.exports = {
  parseOpLine,
  parseAttackLine,
  parseOpsMessage
};
