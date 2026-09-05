'use strict';

function num(v) {
  if (v == null) return null;
  const m = String(v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function clean(v) {
  return String(v || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

function parseLosses(text) {
  const losses = {};
  const clause = text.match(/We lost\s+(.+?)\s+in this battle/i)?.[1];
  if (!clause) return null;
  for (const part of clause.split(/\s+and\s+/i)) {
    const m = part.trim().match(/^([\d,]+)\s+(.+)$/);
    if (m) losses[m[2].trim().toLowerCase()] = num(m[1]);
  }
  return Object.keys(losses).length ? losses : null;
}

function parseFullBattleReport(raw) {
  const t = clean(raw);
  const h = t.match(/^⚔\s+(.+?)\s*\((\d+:\d+)\)\s*[—-]\s*(?:#?\d+\s*-\s*)?(.+?):/i);
  const target = t.match(/Your forces arrive at\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)/i);
  if (!h || !target) return null;

  const acresRecaptured = num(t.match(/recaptured\s+([\d,]+)\s+acres/i)?.[1]);
  const acresDestroyed = num(t.match(/(?:razed|destroyed)\s+([\d,]+)\s+acres/i)?.[1]);
  const acresCaptured = num(t.match(/(?:army has taken|captured|took)\s+([\d,]+)\s+acres/i)?.[1]);
  const offenseSent = num(t.match(/(?:~|off\s+)([\d,]+)\s+(?:[A-Za-z][A-Za-z ]+?)(?=\s*\+|\s+w\/|\s+vs)/i)?.[1]);
  const generals = num(t.match(/w\/\s*([\d,]+)\s+gen(?:eral)?s?/i)?.[1]);

  return {
    type: 'attack', eventType: 'attack',
    attackType: acresRecaptured ? 'recapture' : /massacre/i.test(t) ? 'massacre' : /ambush/i.test(t) ? 'ambush' : /pillage/i.test(t) ? 'pillage' : 'invasion',
    direction: 'outgoing',
    attackerProvince: clean(h[1]), attackerKingdom: h[2],
    targetProvince: clean(target[1]), targetKingdom: target[2],
    success: /managed a victory|victory!/i.test(t),
    acresCaptured: acresRecaptured ? null : acresCaptured,
    acresRecaptured, acresDestroyed,
    buildingsSurvived: num(t.match(/([\d,]+)\s+acres of buildings survived/i)?.[1]),
    credits: num(t.match(/gained\s+([\d,]+)\s+specialist training credits/i)?.[1]),
    peasants: num(t.match(/([\d,]+)\s+peasants settled/i)?.[1]),
    kills: num(t.match(/killed about\s+([\d,]+)\s+enemy troops/i)?.[1]),
    imprisoned: num(t.match(/imprisoned\s+([\d,]+)\s+additional troops/i)?.[1]),
    returnDays: num(t.match(/available again in\s+([\d.]+)\s+days/i)?.[1]),
    enemyDefense: num(t.match(/vs\s+([\d,]+)\s+def/i)?.[1]),
    offenseSent, generals,
    losses: parseLosses(t),
    rawContent: raw,
  };
}

function parseCompactAttack(raw) {
  const t = clean(raw).replace(/\.$/, '');

  // "6 - F - Totemonic (6:5) invaded 10 - Assume the Position (6:9) and captured 88 acres of land."
  let m = t.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+(?:invaded|attacked|assaulted)\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+and\s+(captured|took)\s+([\d,]+)\s+acres/i);
  if (m) {
    return {
      type: 'attack', eventType: 'attack', attackType: 'invasion', direction: m[2] === (process.env.INTEL7_KD_CODE || '') ? 'outgoing' : 'incoming',
      attackerProvince: clean(m[1]), attackerKingdom: m[2], targetProvince: clean(m[3]), targetKingdom: m[4],
      success: true, acresCaptured: num(m[5]), acresRecaptured: null, acresDestroyed: null,
      buildingsSurvived: null, credits: null, peasants: null, kills: null, imprisoned: null, returnDays: null,
      enemyDefense: null, offenseSent: null, generals: null, losses: null, rawContent: raw,
    };
  }

  // "16 - Bhaal (6:9) recaptured 174 acres of land from 3 - P - Snot Jelly (6:5)."
  m = t.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+recaptured\s+([\d,]+)\s+acres?\s+of\s+land\s+from\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)/i);
  if (m) {
    return {
      type: 'attack', eventType: 'attack', attackType: 'recapture',
      direction: m[2] === (process.env.INTEL7_KD_CODE || '') ? 'outgoing' : 'incoming',
      attackerProvince: clean(m[1]), attackerKingdom: m[2], targetProvince: clean(m[4]), targetKingdom: m[5],
      success: true, acresCaptured: null, acresRecaptured: num(m[3]), acresDestroyed: null,
      buildingsSurvived: null, credits: null, peasants: null, kills: null, imprisoned: null, returnDays: null,
      enemyDefense: null, offenseSent: null, generals: null, losses: null, rawContent: raw,
    };
  }

  // "14 - Kluane National Park (6:9) captured 171 acres of land from 25 - R - Jared (6:5)."
  m = t.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+captured\s+([\d,]+)\s+acres?\s+of\s+land\s+from\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)/i);
  if (m) {
    return {
      type: 'attack', eventType: 'attack', attackType: 'invasion',
      direction: m[2] === (process.env.INTEL7_KD_CODE || '') ? 'outgoing' : 'incoming',
      attackerProvince: clean(m[1]), attackerKingdom: m[2], targetProvince: clean(m[4]), targetKingdom: m[5],
      success: true, acresCaptured: num(m[3]), acresRecaptured: null, acresDestroyed: null,
      buildingsSurvived: null, credits: null, peasants: null, kills: null, imprisoned: null, returnDays: null,
      enemyDefense: null, offenseSent: null, generals: null, losses: null, rawContent: raw,
    };
  }

  // "P - Snot Jelly (6:5) ambushed armies from 16 - Bhaal (6:9) and took 87 acres of land."
  m = t.match(/^(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+ambushed\s+armies\s+from\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)\s+and\s+took\s+([\d,]+)\s+acres?/i);
  if (m) {
    return {
      type: 'attack', eventType: 'attack', attackType: 'ambush',
      direction: m[2] === (process.env.INTEL7_KD_CODE || '') ? 'outgoing' : 'incoming',
      attackerProvince: clean(m[1]), attackerKingdom: m[2], targetProvince: clean(m[3]), targetKingdom: m[4],
      success: true, acresCaptured: num(m[5]), acresRecaptured: null, acresDestroyed: null,
      buildingsSurvived: null, credits: null, peasants: null, kills: null, imprisoned: null, returnDays: null,
      enemyDefense: null, offenseSent: null, generals: null, losses: null, rawContent: raw,
    };
  }

  return null;
}

function parseAttackReport(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  return parseFullBattleReport(text) || parseCompactAttack(text);
}

module.exports = { parseAttackReport };
