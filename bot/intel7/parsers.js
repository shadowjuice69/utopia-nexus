function clean(value) {
  return String(value || "").replace(/[\u0000-\u001F\uFFFD]/g, " ").replace(/\s+/g, " ").trim();
}

function num(value) {
  if (value == null) return null;
  const m = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// ─── THIEVES ─────────────────────────────────────────────────────────────────

function parseThieves(raw) {
  const t = clean(raw), out = [];
  for (const line of t.split(/\n+/)) {
    const s = clean(line);
    let m = s.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+(?:performed|used|attempted)\s+(.+?)\s+(?:on|against|at)\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\).*$/i);
    if (m) {
      out.push({
        type: "thieves", eventType: "operation",
        attackerProvince: m[1].trim(), attackerKingdom: m[2],
        operation: m[3].trim(),
        targetProvince: m[4].trim(), targetKingdom: m[5],
        success: !/fail|failed/i.test(s),
      });
      continue;
    }
    // Bot-relay format: Province <<__OP__ **| Target (kd)**>>
    m = s.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*<<__(.+?)__\s+\*\*\|\s*(.+?)\s+\((\d+:\d+)\)\*\*>>\s*(.*)$/i);
    if (m) {
      out.push({
        type: "thieves", eventType: "operation",
        attackerProvince: m[1].trim(), operation: m[2].trim(),
        targetProvince: m[3].trim(), targetKingdom: m[4],
        success: !/FAIL/i.test(m[5]),
      });
    }
  }
  return out;
}

// ─── ATTACKS ─────────────────────────────────────────────────────────────────

function parseAttack(raw) {
  const t = clean(raw), out = [];
  const lines = t.split(/\n+/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Discord Intel7 header: "⚔ KdName (kd) — #N ProvinceName:"
    const headerMatch = line.match(/^⚔\s+(.+?)\s*\((\d+:\d+)\)\s*[—-]+\s*#?\d+\s*(.+?)\s*:?\s*$/);
    if (headerMatch) {
      const kdAttacker = headerMatch[2];
      const provinceName = headerMatch[3].trim();
      const nextLines = lines.slice(i + 1, i + 15).join(" ");

      const arriveMatch = nextLines.match(/Your forces arrive at\s+(.+?)\s*\((\d+:\d+)\)/i);
      const acresMatch = nextLines.match(/(?:has taken|captured|took)\s+([\d,]+)\s+acres/i);
      const creditsMatch = nextLines.match(/gained\s+([\d,]+)\s+specialist training credits/i);
      const peasantsMatch = nextLines.match(/([\d,]+)\s+peasants\s+settled/i);
      const killsMatch = nextLines.match(/killed\s+about\s+([\d,]+)\s+enemy\s+troops/i);
      const imprisonedMatch = nextLines.match(/imprisoned\s+([\d,]+)/i);
      const lostMatch = nextLines.match(/We lost\s+(.+?)(?:\.|in this battle)/i);
      const returnMatch = nextLines.match(/available again in\s+([\d.]+)\s+days/i);
      const defMatch = nextLines.match(/vs\s+([\d,]+)\s+def/i);
      const buildingsMatch = nextLines.match(/([\d,]+)\s+acres? of buildings survived/i);
      const success = /managed a victory|victorious|has taken/i.test(nextLines);
      const failed = /failed|repelled|driven back/i.test(nextLines);

      // Parse per-troop losses
      const losses = {};
      for (const m of nextLines.matchAll(/lost\s+([\d,]+)\s+([A-Za-z ]+?)(?=,|\s+and\s+|\s+in this battle)/gi)) {
        losses[m[2].trim().toLowerCase()] = num(m[1]);
      }

      out.push({
        type: "attack", eventType: "attack",
        attackerProvince: provinceName, attackerKingdom: kdAttacker,
        targetProvince: arriveMatch ? arriveMatch[1].trim() : null,
        targetKingdom: arriveMatch ? arriveMatch[2] : null,
        acresCaptured: acresMatch ? num(acresMatch[1]) : null,
        credits: creditsMatch ? num(creditsMatch[1]) : null,
        peasants: peasantsMatch ? num(peasantsMatch[1]) : null,
        kills: killsMatch ? num(killsMatch[1]) : null,
        imprisoned: imprisonedMatch ? num(imprisonedMatch[1]) : null,
        troopsLost: Object.keys(losses).length ? losses : null,
        troopsLostRaw: lostMatch ? lostMatch[1].trim() : null,
        returnDays: returnMatch ? Number(returnMatch[1]) : null,
        enemyDefense: defMatch ? num(defMatch[1]) : null,
        buildingsSurvived: buildingsMatch ? num(buildingsMatch[1]) : null,
        success: success || !failed,
      });
      i++;
      continue;
    }

    // No-header format: "- ProvinceName: Your forces arrive at Target (kd)..."
    // e.g. "- Kx: Your forces arrive at Omega (1:7)."
    const noHeaderMatch = line.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*:\s*Your forces arrive at\s+(.+?)\s*\((\d+:\d+)\)/i);
    if (noHeaderMatch) {
      const provinceName = noHeaderMatch[1].trim();
      const rest = lines.slice(i, i + 15).join(" ");
      const acresMatch = rest.match(/(?:has taken|captured|took|recaptured)\s+([\d,]+)\s+acres/i);
      const creditsMatch = rest.match(/gained\s+([\d,]+)\s+specialist training credits/i);
      const peasantsMatch = rest.match(/([\d,]+)\s+peasants\s+settled/i);
      const killsMatch = rest.match(/killed\s+about\s+([\d,]+)\s+enemy\s+troops/i);
      const imprisonedMatch = rest.match(/imprisoned\s+([\d,]+)/i);
      const returnMatch = rest.match(/available again in\s+([\d.]+)\s+days/i);
      const defMatch = rest.match(/vs\s+([\d,]+)\s+def/i);
      const offMatch = rest.match(/⚔\s*~?([\d,]+(?:\s+[\w\s]+?\+)*)/i);
      const kdMatch = rest.match(/\((\d+:\d+)\)\s*$/);
      const lostMatch = rest.match(/We lost\s+(.+?)(?:\.|in this battle)/i);
      const losses = {};
      for (const m of rest.matchAll(/lost\s+([\d,]+)\s+([A-Za-z ]+?)(?=,|\s+and\s+|\s+in this battle)/gi)) {
        losses[m[2].trim().toLowerCase()] = num(m[1]);
      }
      const isRecapture = /recaptured/i.test(rest);
      out.push({
        type: "attack",
        eventType: isRecapture ? "recapture" : "attack",
        attackerProvince: provinceName,
        attackerKingdom: kdMatch?.[1] || null,
        targetProvince: noHeaderMatch[2].trim(),
        targetKingdom: noHeaderMatch[3],
        acresCaptured: acresMatch ? num(acresMatch[1]) : null,
        credits: creditsMatch ? num(creditsMatch[1]) : null,
        peasants: peasantsMatch ? num(peasantsMatch[1]) : null,
        kills: killsMatch ? num(killsMatch[1]) : null,
        imprisoned: imprisonedMatch ? num(imprisonedMatch[1]) : null,
        troopsLost: Object.keys(losses).length ? losses : null,
        troopsLostRaw: lostMatch ? lostMatch[1].trim() : null,
        returnDays: returnMatch ? Number(returnMatch[1]) : null,
        enemyDefense: defMatch ? num(defMatch[1]) : null,
        success: true,
      });
      i++;
      continue;
    }

    // Incoming failed attack: "4 - Omega (1:7) attempted to invade 23 - The First Sire (6:9)"
    let m = line.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+attempted\s+to\s+invade\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)/i);
    if (m) {
      out.push({
        type: "attack", eventType: "incoming",
        attackerProvince: m[1].trim(), attackerKingdom: m[2],
        targetProvince: m[3].trim(), targetKingdom: m[4],
        success: false,
      });
      i++;
      continue;
    }

    // Population kill: "Attacker (kd) killed N people within Target (kd)"
    m = line.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+killed\s+([\d,]+)\s+people within\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)/i);
    if (m) {
      out.push({
        type: "attack", eventType: "massacre",
        attackerProvince: m[1].trim(), attackerKingdom: m[2],
        targetProvince: m[4].trim(), targetKingdom: m[5],
        peasants: num(m[3]),
      });
      i++;
      continue;
    }

    // Single-line: "Attacker (kd) attacked/invaded/ambushed Target (kd) captured/took/looted N acres/books"
    m = line.match(/^(?:⚔\s*)?(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+(attacked|invaded|ambushed armies from)\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\).*?(captured|took|looted)\s+([\d,]+)\s+(acres?|books?)/i);
    if (m) {
      const isBooks = /books/i.test(m[8]);
      out.push({
        type: "attack",
        eventType: /ambushed/i.test(m[3]) ? "ambush" : "attack",
        attackerProvince: m[1].trim(), attackerKingdom: m[2],
        targetProvince: m[4].trim(), targetKingdom: m[5],
        acresCaptured: isBooks ? null : num(m[7]),
        loot: isBooks ? { books: num(m[7]) } : null,
      });
      i++;
      continue;
    }

    // "N - Attacker (kd) captured N acres of land from N - Target (kd)"
    m = line.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+captured\s+([\d,]+)\s+acres?\s+of\s+land\s+from\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)/i);
    if (m) {
      out.push({type:"attack",eventType:"attack",attackerProvince:m[1].trim(),attackerKingdom:m[2],targetProvince:m[4].trim(),targetKingdom:m[5],acresCaptured:num(m[3]),success:true});
      i++; continue;
    }

    // "Attacker (kd) attacked and looted N books/acres from Target (kd)"
    m = line.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+attacked\s+and\s+looted\s+([\d,]+)\s+(books?|acres?)\s+from\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)/i);
    if (m) {
      const books = /books?/i.test(m[4]);
      out.push({
        type: "attack", eventType: "attack",
        attackerProvince: m[1].trim(), attackerKingdom: m[2],
        targetProvince: m[5].trim(), targetKingdom: m[6],
        acresCaptured: books ? null : num(m[3]),
        loot: books ? { books: num(m[3]) } : null,
      });
      i++;
      continue;
    }

    i++;
  }
  return out;
}

// ─── SPELLS ──────────────────────────────────────────────────────────────────

function inferSpellName(t) {
  const patterns = [
    [/\bfireball\b/i, "fireball"],
    [/\bpitfalls\b/i, "pitfalls"],
    [/\bgluttony\b/i, "gluttony"],
    [/\bgreedy\b|turn greedy/i, "greed"],
    [/\billuminated\b.*?exposed the thieves/i, "illuminate"],
    [/\bruined .*?faith in the military/i, "faith in military"],
    [/\bvow of chastity/i, "love and peace"],
    [/\bblessed by nature/i, "nature's blessing"],
    [/\bfog of war\b/i, "fog of war"],
    [/\bparanoia\b/i, "paranoia"],
    [/\bblizzard\b/i, "blizzard"],
    [/\bvermin\b/i, "vermin"],
    [/\bplague\b/i, "plague"],
    [/\bhurricane\b/i, "hurricane"],
  ];
  for (const [re, name] of patterns) if (re.test(t)) return name;
  return null;
}

function parseSpell(raw, self = false) {
  const t = clean(raw), out = [];
  for (const line of t.split(/\n+/)) {
    const s = clean(line);
    const runesMatch = s.match(/gather\s+([\d,]+)\s+runes/i);
    if (!runesMatch) continue;

    // Explicit spell name from "— SpellName: Your wizards gather"
    const explicitMatch = s.match(/[—-]\s*([^:]+):\s*Your wizards gather/i);
    const spell = explicitMatch?.[1]?.trim() || inferSpellName(s) || s.split(/Your wizards gather/i)[0].trim();

    const success = !/but the spell fails/i.test(s);
    const targetKdMatch = s.match(/\((\d+:\d+)\)/g);
    const targetKingdom = targetKdMatch ? targetKdMatch[targetKdMatch.length - 1]?.replace(/[()]/g, "") : null;

    const targetProvinceMatch = s.match(/Select target province:\s*\d+\s+(.+?)\s*---/i) ||
      s.match(/targeted at\s+(.+?)\s*\((\d+:\d+)\)/i);

    const duration = num(s.match(/for\s+(\d+)\s+days?/i)?.[1]);
    const wizardsKilled = num(s.match(/(\d+)\s+wizards?\s+were killed/i)?.[1]);

    // Extract attacker province from "— #N ProvinceName: Your wizards"
    const attackerMatch = s.match(/[—-]\s*#?\d+\s*[-\s]\s*(.+?)\s*(?:\((\d+:\d+)\))?\s*:\s*Your wizards/i);

    out.push({
      type: self ? "self_spell" : "offensive_spell",
      eventType: "spell",
      spellName: spell,
      success,
      runes: num(runesMatch[1]),
      attackerProvince: attackerMatch?.[1]?.trim() || null,
      attackerKingdom: attackerMatch?.[2] || null,
      targetKingdom,
      targetProvince: targetProvinceMatch?.[1]?.trim() || null,
      durationDays: duration,
      wizardsKilled,
    });
  }
  return out;
}

// ─── DRAGON ──────────────────────────────────────────────────────────────────

function parseDragon(raw) {
  const t = clean(raw);
  if (!/(?:dragon|🐉)/i.test(t)) return [];

  const development = t.match(/begun development of the\s+(.+?)(?:\s+\([^)]*\))?$/i);
  const cancelled = t.match(/has cancelled their dragon project targeted at us/i);
  const completed = t.match(/completed our dragon,\s*(.+?),\s*and it sets flight to ravage\s*(.+?)\s*\((\d+:\d+)\)/i);
  const incoming = t.match(/Dragon at us\s*[—-]\s*(.+?)\s+(\d[\d,]*)\s+points of strength left/i);

  return [{
    type: "dragon",
    eventType: development ? "development" : cancelled ? "cancelled" : completed ? "completed" : incoming ? "incoming" : "unknown",
    dragonName: development?.[1]?.trim() || completed?.[1]?.trim() || incoming?.[1]?.trim() || null,
    targetProvince: completed?.[2]?.trim() || null,
    targetKingdom: completed?.[3] || null,
    strength: incoming ? num(incoming[2]) : null,
    success: !/fail|failed/i.test(t),
  }];
}

// ─── RITUAL ──────────────────────────────────────────────────────────────────

function parseRitual(raw) {
  const t = clean(raw);
  if (!/ritual/i.test(t)) return [];

  const who = t.match(/^#?\d+[-\s]+([^/]+?)\s*\/\s*\*\*#?\d+\s+(.+?)\*\*\s*[—-]\s*Ritual:/i);
  const cast = t.match(/cast\s+\*\*(\d+)\/(\d+)\*\*/i);
  const simpleWho = t.match(/^#?\d+\s*-\s*(.+?)(?:\s*\/|\s*—|\s*Ritual)/i);

  return [{
    type: "ritual",
    eventType: "ritual",
    casterProvince: who?.[2]?.trim() || simpleWho?.[1]?.trim() || null,
    casterKingdom: null,
    success: !/spell fails|FAILED/i.test(t),
    castCount: cast ? Number(cast[1]) : null,
    castNeeded: cast ? Number(cast[2]) : null,
  }];
}

// ─── AID ─────────────────────────────────────────────────────────────────────

function parseAid(raw) {
  const t = clean(raw);
  const m = t.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*:\s*We have sent\s+([\d,]+)\s+(.+?)\s+to\s+(.+?)\s*\((\d+:\d+)\)/i);
  if (!m) return [];
  return [{
    type: "aid",
    eventType: "aid",
    attackerProvince: m[1].trim(),
    attackerKingdom: null,
    targetProvince: m[4].trim(),
    targetKingdom: m[5],
    resourceType: m[3].trim().toLowerCase(),
    amount: num(m[2]),
    surplusGold: num(t.match(/added\s+([\d,]+)\s+gold coins to our aid surplus/i)?.[1]),
  }];
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────

function parseIntel7(channelType, raw) {
  switch (channelType) {
    case "thieves":   return parseThieves(raw);
    case "attacks":   return parseAttack(raw);
    case "offensive": return parseSpell(raw, false);
    case "self":      return parseSpell(raw, true);
    case "dragon":    return parseDragon(raw);
    case "ritual":    return parseRitual(raw);
    case "aid":       return parseAid(raw);
    default:          return [];
  }
}

module.exports = { parseIntel7 };
