'use strict';

function num(v) {
  if (v == null) return null;
  const m = String(v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function clean(v) {
  return String(v || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

function parseAttackReport(raw) {
  const t = clean(raw);
  if (!/Your forces arrive at/i.test(t)) return null;

  // Handles both numbered and unnumbered Discord bot headers:
  // ⚔ Daddy Long Legs (6:9) — #19 - Silent:
  // ⚔ Nothing to see here (6:9) — Brackis:
  const h = t.match(/^⚔\s+(.+?)\s*\((\d+:\d+)\)\s*[—-]\s*(?:#?\d+\s*-\s*)?(.+?):/i);
  const target = t.match(/Your forces arrive at\s+(?:#?\d+\s*-\s*)?(.+?)\s*\((\d+:\d+)\)/i);
  if (!h || !target) return null;

  const losses = {};
  const lossClause = t.match(/We lost\s+(.+?)\s+in this battle/i)?.[1];
  if (lossClause) {
    for (const part of lossClause.split(/\s+and\s+/i)) {
      const m = part.trim().match(/^([\d,]+)\s+(.+)$/);
      if (m) losses[m[2].trim().toLowerCase()] = num(m[1]);
    }
  }

  const acresCaptured = num(t.match(/(?:army has taken|captured|took)\s+([\d,]+)\s+acres/i)?.[1]);
  const acresRecaptured = num(t.match(/recaptured\s+([\d,]+)\s+acres/i)?.[1]);
  const acresDestroyed = num(t.match(/(?:razed|destroyed)\s+([\d,]+)\s+acres/i)?.[1]);
  const offenseSent = num(t.match(/(?:~|off\s+)([\d,]+)\s+(?:[A-Za-z][A-Za-z ]+?)(?=\s*\+|\s+w\/|\s+vs)/i)?.[1]);
  const generals = num(t.match(/w\/\s*([\d,]+)\s+gen(?:eral)?s?/i)?.[1]);

  return {
    type: 'attack',
    eventType: 'attack',
    attackType: acresRecaptured ? 'recapture' : /massacre/i.test(t) ? 'massacre' : /ambush/i.test(t) ? 'ambush' : /pillage/i.test(t) ? 'pillage' : 'offensive',
    direction: 'outgoing',
    attackerProvince: clean(h[1]),
    attackerKingdom: h[2],
    targetProvince: clean(target[1]),
    targetKingdom: target[2],
    success: /managed a victory|victory!/i.test(t),
    acresCaptured: acresRecaptured ? null : acresCaptured,
    acresRecaptured,
    acresDestroyed,
    buildingsSurvived: num(t.match(/([\d,]+)\s+acres of buildings survived/i)?.[1]),
    credits: num(t.match(/gained\s+([\d,]+)\s+specialist training credits/i)?.[1]),
    peasants: num(t.match(/([\d,]+)\s+peasants settled/i)?.[1]),
    kills: num(t.match(/killed about\s+([\d,]+)\s+enemy troops/i)?.[1]),
    imprisoned: num(t.match(/imprisoned\s+([\d,]+)\s+additional troops/i)?.[1]),
    returnDays: num(t.match(/available again in\s+([\d.]+)\s+days/i)?.[1]),
    enemyDefense: num(t.match(/vs\s+([\d,]+)\s+def/i)?.[1]),
    offenseSent,
    generals,
    losses: Object.keys(losses).length ? losses : null,
    rawContent: raw,
  };
}

module.exports = { parseAttackReport };
