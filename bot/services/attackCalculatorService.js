/**
 * Attack calculator service.
 *
 * Formula (dev 2026-08-19):
 *   a     = tNW/yNW − 0.05  (invert if ≥ 1)
 *   magic = max(0.67, a + 0.1 if a < 0.9 else a)
 *   war   = max(0.83, 0.7·magic + 0.33)
 *   GF    = 3·magic − 2×mods, clamped 0.01–1.35
 *   Trad  = 0.12 × acres × GF × MAPf  (cap 0.2 of yours)
 *   MAPf  = 1 − MAP/100
 *   war MAPf = (1 − MAP/100 + 3) / 4
 *   MAP  += int(275 × land fraction); decays max(1, 5%) per tick
 */

const logger = require("./logger");

function calcA(yourNW, targetNW) {
  let a = targetNW / yourNW - 0.05;
  if (a >= 1) a = 1 / a;
  return a;
}

function calcMagic(a) {
  const raw = a < 0.9 ? a + 0.1 : a;
  return Math.max(0.67, raw);
}

function calcWar(magic) {
  return Math.max(0.83, 0.7 * magic + 0.33);
}

function calcGF(magic, mods = 0) {
  const raw = 3 * magic - 2 * mods;
  return Math.min(1.35, Math.max(0.01, raw));
}

function calcMAPf(map, isWar = false) {
  if (isWar) return (1 - map / 100 + 3) / 4;
  return 1 - map / 100;
}

function calcTraditional(acres, gf, mapf, yourAcres) {
  const raw = 0.12 * acres * gf * mapf;
  const cap = 0.2 * yourAcres;
  return Math.min(raw, cap);
}

function calcMAPGain(landFraction) {
  return Math.floor(275 * landFraction);
}

function calculateAttack({ yourNW, targetNW, yourAcres, targetAcres, yourMAP = 0, isWar = false, offMods = 0 }) {
  try {
    const a = calcA(yourNW, targetNW);
    const magic = calcMagic(a);
    const war = calcWar(magic);
    const gf = calcGF(magic, offMods);
    const mapf = calcMAPf(yourMAP, isWar);
    const acresGained = calcTraditional(targetAcres, gf, mapf, yourAcres);
    const landFraction = acresGained / targetAcres;
    const mapGain = calcMAPGain(landFraction);

    return {
      a: Number(a.toFixed(4)),
      magic: Number(magic.toFixed(4)),
      war: Number(war.toFixed(4)),
      gf: Number(gf.toFixed(4)),
      mapf: Number(mapf.toFixed(4)),
      acresGained: Math.floor(acresGained),
      mapGain,
      newMAP: Math.min(100, yourMAP + mapGain),
      isWar,
      cappedAt20Percent: acresGained >= 0.2 * yourAcres
    };
  } catch (err) {
    logger.error(`[ATTACK CALC ERROR] ${err.message}`);
    return null;
  }
}

module.exports = { calculateAttack, calcA, calcMagic, calcWar, calcGF, calcMAPf, calcTraditional, calcMAPGain };
