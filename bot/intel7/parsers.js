'use strict';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function clean(value) {
  return String(value || '')
    .replace(/[\u0000-\u001F\uFFFD]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function num(value) {
  if (value == null) return null;
  const m = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

// Strip Discord markdown bold/italic from a string
function stripMd(s) {
  return String(s || '').replace(/\*\*/g, '').replace(/__/g, '').trim();
}

// ---------------------------------------------------------------------------
// ATTACKS
// Outgoing format:
//   ⚔ KdName (kd) — #N ProvinceName:\n
//   Your forces arrive at Target (kd). ... taken N acres! ...
//   We lost N X and N Y in this battle.
//   We killed about N enemy troops. We also imprisoned N additional troops ...
//   Our forces will be available again in N days ...
//   ⚔ ~N X + N Y ... vs N,NNN def ...
//
// Incoming format:
//   N - Province (kd) attempted to invade N - Province (kd).\nWe lost ...
//   OR: N - Province (kd) invaded N - Province (kd) and captured N acres
// ---------------------------------------------------------------------------
function parseAttack(raw) {
  const t = clean(raw);
  const out = [];

  // ── Outgoing battle result (starts with ⚔ KdName (kd) — #N Province:) ──
  const outgoingHeader = t.match(/^⚔\s+(.+?)\s*\((\d+:\d+)\)\s*[—-]\s*#?\d+\s+(.+?):/i);
  if (outgoingHeader && /Your forces arrive at/i.test(t)) {
    const attackerKingdom = outgoingHeader[2];
    const attackerProvince = stripMd(outgoingHeader[1]); // group 1 = province name, group 3 = rank-label like "- Kx"
    const targetMatch = t.match(/Your forces arrive at\s+(.+?)\s*\((\d+:\d+)\)/i);
    const targetProvince = targetMatch ? stripMd(targetMatch[1]) : null;
    const targetKingdom = targetMatch ? targetMatch[2] : null;

    const success = /managed a victory|victory!/i.test(t);
    const acresCaptured = num(t.match(/army has taken\s+([\d,]+)\s+acres/i)?.[1]);
    const credits = num(t.match(/gained\s+([\d,]+)\s+specialist training credits/i)?.[1]);
    const peasants = num(t.match(/([\d,]+)\s+peasants settled/i)?.[1]);
    const buildings = num(t.match(/([\d,]+)\s+acres of buildings survived/i)?.[1]);
    const killed = num(t.match(/killed about\s+([\d,]+)\s+enemy troops/i)?.[1]);
    const imprisoned = num(t.match(/imprisoned\s+([\d,]+)\s+additional troops/i)?.[1]);
    const returnDays = num(t.match(/available again in\s+([\d.]+)\s+days/i)?.[1]);
    const enemyDefense = num(t.match(/vs\s+([\d,]+)\s+def/i)?.[1]);

    // Parse losses: "We lost 63 Knights and 10 horses in this battle."
    // Strategy: find the whole "We lost ... in this battle" clause, then split by " and "
    const losses = {};
    const lossClause = t.match(/We lost\s+(.+?)\s+in this battle/i)?.[1];
    if (lossClause) {
      for (const part of lossClause.split(/\s+and\s+/i)) {
        const m = part.trim().match(/^([\d,]+)\s+(.+)$/);
        if (m) losses[m[2].trim().toLowerCase()] = num(m[1]);
      }
    }

    // Acres razed/destroyed
    const acresRazed = num(t.match(/razed\s+([\d,]+)\s+acres/i)?.[1]);
    const acresDestroyed = num(t.match(/destroyed\s+([\d,]+)\s+acres/i)?.[1]);
    const acresRecaptured = num(t.match(/recaptured\s+([\d,]+)\s+acres/i)?.[1]);

    let attackType = 'offensive';
    if (acresRecaptured) attackType = 'recapture';
    else if (/massacred/i.test(t)) attackType = 'massacre';
    else if (/ambush/i.test(t)) attackType = 'ambush';
    else if (/pillage/i.test(t)) attackType = 'pillage';
    else if (/looted/i.test(t) && !acresCaptured) attackType = 'loot';

    out.push({
      type: 'attack',
      eventType: 'attack',
      attackType,
      direction: 'outgoing',
      attackerProvince,
      attackerKingdom,
      targetProvince,
      targetKingdom,
      success,
      acresCaptured: acresRecaptured ? null : acresCaptured,
      acresRecaptured: acresRecaptured || null,
      acresRazed: acresRazed || acresDestroyed || null,
      credits,
      peasants,
      buildingsSurvived: buildings,
      kills: killed,
      imprisoned,
      returnDays,
      enemyDefense,
      losses: Object.keys(losses).length ? losses : null,
    });
    return out;
  }

  // ── Incoming: "N - Province (kd) attempted to invade N - Province (kd)" ──
  const incomingAttempt = t.match(
    /^#?\d+\s*-\s*(.+?)\s*\((\d+:\d+)\)\s+attempted\s+to\s+invade\s+#?\d+\s*-\s*(.+?)\s*\((\d+:\d+)\)/i
  );
  if (incomingAttempt) {
    out.push({
      type: 'attack',
      eventType: 'attack',
      attackType: 'invasion_failed',
      direction: 'incoming',
      attackerProvince: stripMd(incomingAttempt[1]),
      attackerKingdom: incomingAttempt[2],
      targetProvince: stripMd(incomingAttempt[3]),
      targetKingdom: incomingAttempt[4],
      success: false,
    });
    return out;
  }

  // ── Incoming: "N - Province (kd) invaded N - Province (kd) and captured N acres" ──
  const incomingCapture = t.match(
    /^#?\d+\s*-\s*(.+?)\s*\((\d+:\d+)\)\s+(?:invaded|attacked|ambushed armies from)\s+#?\d+\s*-\s*(.+?)\s*\((\d+:\d+)\).*?(?:captured|took)\s+([\d,]+)\s+acres/i
  );
  if (incomingCapture) {
    out.push({
      type: 'attack',
      eventType: 'attack',
      attackType: /ambush/i.test(t) ? 'ambush' : 'invasion',
      direction: 'incoming',
      attackerProvince: stripMd(incomingCapture[1]),
      attackerKingdom: incomingCapture[2],
      targetProvince: stripMd(incomingCapture[3]),
      targetKingdom: incomingCapture[4],
      acresCaptured: num(incomingCapture[5]),
      success: true,
    });
    return out;
  }

  // ── KD news: "N - Province (kd) captured N acres of land from N - Province (kd)" ──
  const kdCapture = t.match(
    /^#?\d+\s*-\s*(.+?)\s*\((\d+:\d+)\)\s+captured\s+([\d,]+)\s+acres of land from\s+#?\d+\s*-\s*(.+?)\s*\((\d+:\d+)\)/i
  );
  if (kdCapture) {
    const enemyDef = num(t.match(/vs\s+([\d,]+)\s+def/i)?.[1]);
    out.push({
      type: 'attack',
      eventType: 'attack',
      attackType: 'invasion',
      direction: 'outgoing',
      attackerProvince: stripMd(kdCapture[1]),
      attackerKingdom: kdCapture[2],
      targetProvince: stripMd(kdCapture[4]),
      targetKingdom: kdCapture[5],
      acresCaptured: num(kdCapture[3]),
      enemyDefense: enemyDef,
      success: true,
    });
    return out;
  }

  // ── Population kill: "N - Province (kd) killed N people within N - Province (kd)" ──
  const popKill = t.match(
    /^#?\d+\s*-\s*(.+?)\s*\((\d+:\d+)\)\s+killed\s+([\d,]+)\s+people within\s+#?\d+\s*-\s*(.+?)\s*\((\d+:\d+)\)/i
  );
  if (popKill) {
    const enemyDef = num(t.match(/vs\s+([\d,]+)\s+def/i)?.[1]);
    out.push({
      type: 'attack',
      eventType: 'attack',
      attackType: 'massacre',
      direction: 'outgoing',
      attackerProvince: stripMd(popKill[1]),
      attackerKingdom: popKill[2],
      targetProvince: stripMd(popKill[4]),
      targetKingdom: popKill[5],
      peasantsKilled: num(popKill[3]),
      enemyDefense: enemyDef,
      success: true,
    });
    return out;
  }

  // ── Incoming pillage/loot (no acres) ──
  const incomingPillage = t.match(
    /^#?\d+\s*-\s*(.+?)\s*\((\d+:\d+)\)\s+(?:invaded and pillaged|attacked and pillaged)\s+(?:the lands of\s+)?#?\d+\s*-\s*(.+?)\s*\((\d+:\d+)\)/i
  );
  if (incomingPillage) {
    out.push({
      type: 'attack',
      eventType: 'attack',
      attackType: 'pillage',
      direction: 'incoming',
      attackerProvince: stripMd(incomingPillage[1]),
      attackerKingdom: incomingPillage[2],
      targetProvince: stripMd(incomingPillage[3]),
      targetKingdom: incomingPillage[4],
      success: true,
    });
    return out;
  }

  return out;
}

// ---------------------------------------------------------------------------
// OPS (thievery/spy)
// Format: ✅/❌ #N - Province / **#N Province** — OpName → **#N Target** (kd) — result · N sent
// OR:     ✅/❌ #N - Province / **#N Province** — OpName → **Target** (kd) — result · N sent
// ---------------------------------------------------------------------------
function parseOps(raw) {
  const t = clean(raw);
  const out = [];

  for (const line of t.split(/\n+/)) {
    const s = clean(line);
    if (!s) continue;

    const success = s.startsWith('✅');
    const fail = s.startsWith('❌');
    if (!success && !fail) continue;

    // Extract attacker: "#N - Province / **#N Province**"
    // The format after the emoji is: #N - KdLabel / **#N ProvinceName** — OpName → **Target** (kd) ...
    const attackerMatch = s.match(/[✅❌]\s+#?\d+\s*-\s*(.+?)\s*\/\s*\*\*#?\d+\s+(.+?)\*\*\s*[—-]/);
    const attackerProvince = attackerMatch ? stripMd(attackerMatch[2]) : null;

    // Operation name: between last "—" and "→" (with target) or end (self-spy, no target)
    const hasTarget = s.includes('→');
    const opMatch = hasTarget
      ? s.match(/[—-]\s+([^—\-→]+?)\s+→/)
      : s.match(/\*\*\s*[—-]\s+([^—\-·]+?)(?:\s+[—-]|\s+·|$)/);
    const operation = opMatch ? stripMd(opMatch[1]) : null;

    // Target: only present if → exists
    const targetMatch = hasTarget
      ? s.match(/→\s+\*\*#?\d*\s*(.+?)\*\*\s*\((\d+:\d+)\)/)
      : null;
    const targetProvince = targetMatch ? stripMd(targetMatch[1]) : null;
    const targetKingdom = targetMatch ? targetMatch[2] : null;

    // Result detail (after the kd): "— off N / def N" or "· foiled — lost N thieves"
    const thieves = num(s.match(/(\d+)\s+sent/i)?.[1]);
    const lostThieves = num(s.match(/lost\s+([\d,]+)\s+thieves?/i)?.[1]);
    const offMil = num(s.match(/off\s+([\d,]+)/i)?.[1]);
    const defMil = num(s.match(/def\s+([\d,]+)/i)?.[1]);

    out.push({
      type: 'ops',
      eventType: 'thievery',
      attackerProvince,
      operation,
      targetProvince,
      targetKingdom,
      success: success && !fail,
      thievesSent: thieves,
      thievesLost: lostThieves,
      offenseMil: offMil,
      defenseMil: defMil,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// SPELLS (self and offensive)
// Format: #N - KdLabel / **#N Province** — SpellName: Your wizards gather N runes...
// ---------------------------------------------------------------------------
function parseSpell(raw, self = true) {
  const t = clean(raw);
  const out = [];

  for (const line of t.split(/\n+/)) {
    const s = clean(line);
    if (!s) continue;
    if (!/Your wizards gather/i.test(s)) continue;

    // Caster: "#N - KdLabel / **#N Province**"
    const casterMatch = s.match(/^#?\d+\s*-\s*(.+?)\s*\/\s*\*\*#?\d+\s+(.+?)\*\*\s*[—-]/);
    const casterProvince = casterMatch ? stripMd(casterMatch[2]) : null;

    // Spell name: last "— SpellName:" before "Your wizards"
    // Format: #N - label / **#N Province** — SpellName: Your wizards...
    const spellMatch = s.match(/[—-]\s+([^—\-:]+?):\s+Your wizards/i);
    const spellName = spellMatch ? stripMd(spellMatch[1]) : null;

    const runes = num(s.match(/gather\s+([\d,]+)\s+runes/i)?.[1]);
    const success = /the spell succeeds/i.test(s) && !/spell fails/i.test(s);
    const duration = num(s.match(/for\s+(\d+)\s+days?/i)?.[1]);
    const wizardsKilled = num(s.match(/(\d+)\s+wizards?\s+(?:were\s+)?killed/i)?.[1]);

    // Target (for offensive spells): may be in the line
    const targetMatch = s.match(/Target.*?\((\d+:\d+)\).*?province:\s*\d+\s+(.+?)\s*---/i);

    out.push({
      type: self ? 'self_spell' : 'offensive_spell',
      eventType: 'spell',
      casterProvince,
      // keep attackerProvince for index.js field mapping
      attackerProvince: casterProvince,
      spellName,
      runes,
      success,
      durationDays: duration,
      wizardsKilled,
      targetProvince: targetMatch?.[2]?.trim() || null,
      targetKingdom: targetMatch?.[1] || null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// DRAGON
// ---------------------------------------------------------------------------
function parseDragon(raw) {
  const t = clean(raw);
  if (!/dragon|🐉/i.test(t)) return [];

  const development = t.match(/begun development of the\s+(.+?)(?:\s*\([^)]*\))?$/i);
  const cancelled = /has cancelled their dragon project/i.test(t);
  const completed = t.match(/completed our dragon,\s*(.+?),\s*and it sets flight to ravage\s*(.+?)\s*\((\d+:\d+)\)/i);
  const incoming = t.match(/Dragon at us\s*[—-]\s*(.+?)\s+([\d,]+)\s+points of strength left/i);

  return [{
    type: 'dragon',
    eventType: development ? 'development' : cancelled ? 'cancelled' : completed ? 'completed' : incoming ? 'incoming' : 'unknown',
    dragonName: development?.[1]?.trim() || completed?.[1]?.trim() || incoming?.[1]?.trim() || null,
    targetProvince: completed?.[2]?.trim() || null,
    targetKingdom: completed?.[3] || null,
    strength: incoming ? num(incoming[2]) : null,
  }];
}

// ---------------------------------------------------------------------------
// RITUAL
// Format: #N - KdLabel / **#N Province** — Ritual: ...cast **N/N**...
// ---------------------------------------------------------------------------
function parseRitual(raw) {
  const t = clean(raw);
  if (!/ritual/i.test(t)) return [];

  const casterMatch = t.match(/^#?\d+\s*-\s*(.+?)\s*\/\s*\*\*#?\d+\s+(.+?)\*\*\s*[—-]\s*Ritual/i);
  const casterProvince = casterMatch ? stripMd(casterMatch[2]) : null;
  const cast = t.match(/cast\s+\*?\*?(\d+)\/(\d+)\*?\*?/i);
  const success = !/spell fails|FAILED/i.test(t);

  return [{
    type: 'ritual',
    eventType: 'ritual',
    attackerProvince: casterProvince,
    casterProvince,
    success,
    castCount: cast ? Number(cast[1]) : null,
    castNeeded: cast ? Number(cast[2]) : null,
  }];
}

// ---------------------------------------------------------------------------
// AID
// Format: #N - KdLabel / **#N Province**: We have sent N X to Province (kd).
// ---------------------------------------------------------------------------
function parseAid(raw) {
  const t = clean(raw);
  // Match: "#N - label / **#N Province**: We have sent N resource to Target (kd)."
  const m = t.match(
    /^#?\d+\s*-\s*.+?\s*\/\s*\*\*#?\d+\s+(.+?)\*\*:\s*We have sent\s+([\d,]+)\s+(.+?)\s+to\s+(.+?)\s*\((\d+:\d+)\)/i
  );
  if (!m) return [];
  return [{
    type: 'aid',
    eventType: 'aid',
    attackerProvince: stripMd(m[1]),
    targetProvince: stripMd(m[4]),
    targetKingdom: m[5],
    amount: num(m[2]),
    resourceType: m[3].trim().toLowerCase(),
  }];
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------
function parseIntel7(channelType, raw) {
  switch (channelType) {
    case 'thieves': return parseOps(raw);
    case 'attacks': return parseAttack(raw);
    case 'offensive': return parseSpell(raw, false);
    case 'self': return parseSpell(raw, true);
    case 'dragon': return parseDragon(raw);
    case 'ritual': return parseRitual(raw);
    case 'aid': return parseAid(raw);
    default: return [];
  }
}

module.exports = { parseIntel7, parseAttack, parseOps, parseSpell, parseDragon, parseRitual, parseAid };
