/**
 * War legality / declare checker service.
 *
 * Rules from RHZ output (Age current):
 *   RANGE: 85–117.65% NW or Land — BOTH axes must be in range when target is smaller
 *   Declare (us→them):  our meter ≥15 AND their meter ≥30 AND above ours AND in range
 *   Declare (them→us):  their meter ≥15 AND our meter ≥30 AND above theirs AND in range
 *   FCF (Formal Ceasefire): gap ≥15, not Hostile toward them, quiet 3 ticks, lower in BOTH NW and land
 *
 *   Hostility bands:
 *     ≥180 = AUTO-WAR
 *     ≥60  = WAR IMMINENT  (mutual declare)
 *     ≥30  = HOSTILE
 *     ≥15  = UNFRIENDLY
 *     <15  = NORMAL
 */

const RANGE_MIN = 0.85;
const RANGE_MAX = 1.1765;

/**
 * Check if target is in attack range.
 * If target is smaller, BOTH NW and land must be in range.
 * If target is larger, either axis suffices.
 */
function checkRange({ ourNW, theirNW, ourLand, theirLand }) {
  const nwRatio  = theirNW  / ourNW;
  const landRatio = theirLand / ourLand;
  const nwIn    = nwRatio  >= RANGE_MIN && nwRatio  <= RANGE_MAX;
  const landIn  = landRatio >= RANGE_MIN && landRatio <= RANGE_MAX;
  const theyAreSmaller = theirNW < ourNW || theirLand < ourLand;

  let inRange;
  if (theyAreSmaller) {
    inRange = nwIn && landIn; // both axes required
  } else {
    inRange = nwIn || landIn;
  }

  return { inRange, nwRatio, landRatio, nwIn, landIn, theyAreSmaller };
}

/**
 * Get band label from meter value.
 */
function getMeterBand(meter) {
  if (meter >= 180) return { label: "AUTO-WAR",     emoji: "🔴", value: meter };
  if (meter >= 60)  return { label: "WAR IMMINENT", emoji: "🔴", value: meter };
  if (meter >= 30)  return { label: "HOSTILE",      emoji: "🟠", value: meter };
  if (meter >= 15)  return { label: "UNFRIENDLY",   emoji: "🟡", value: meter };
  return               { label: "NORMAL",        emoji: "🟢", value: meter };
}

/**
 * Check if WE can declare on THEM.
 * Requirements: our meter ≥15, their meter ≥30 AND above ours, in range.
 */
function canWeDeclare({ ourMeter, theirMeter, range }) {
  const checks = [
    { label: "Our meter ≥ 15",              pass: ourMeter  >= 15, detail: `${ourMeter.toFixed(2)} vs 15` },
    { label: "Their meter ≥ 30 AND > ours", pass: theirMeter >= 30 && theirMeter > ourMeter, detail: `${theirMeter.toFixed(2)} vs 30, above our ${ourMeter.toFixed(2)}` },
    { label: "In range",                    pass: range.inRange, detail: `NW ${(range.nwRatio*100).toFixed(1)}% · Land ${(range.landRatio*100).toFixed(1)}%` },
  ];
  const can = checks.every(c => c.pass);
  return { can, checks };
}

/**
 * Check if THEY can declare on US.
 */
function canTheyDeclare({ ourMeter, theirMeter, range }) {
  const theirRange = {
    inRange: range.inRange,
    nwRatio: 1 / range.nwRatio,
    landRatio: 1 / range.landRatio,
    nwIn: range.nwIn,
    landIn: range.landIn,
  };
  const checks = [
    { label: "Their meter ≥ 15",           pass: theirMeter >= 15, detail: `${theirMeter.toFixed(2)} vs 15` },
    { label: "Our meter ≥ 30 AND > theirs", pass: ourMeter  >= 30 && ourMeter > theirMeter, detail: `${ourMeter.toFixed(2)} vs 30, above their ${theirMeter.toFixed(2)}` },
    { label: "In range",                   pass: range.inRange, detail: `NW ${(theirRange.nwRatio*100).toFixed(1)}% · Land ${(theirRange.landRatio*100).toFixed(1)}%` },
  ];
  const can = checks.every(c => c.pass);
  return { can, checks };
}

/**
 * Check FCF availability.
 * Requirements: meter gap ≥15, not Hostile toward them (our meter <30), quiet 3 ticks, lower in BOTH.
 */
function checkFCF({ ourMeter, theirMeter, ourNW, theirNW, ourLand, theirLand, quietTicks = 0 }) {
  const gap = theirMeter - ourMeter;
  const checks = [
    { label: "Gap ≥ 15 (their − our)",  pass: gap >= 15,       detail: `Gap = ${gap.toFixed(2)}` },
    { label: "We not Hostile (< 30)",   pass: ourMeter < 30,   detail: `Our meter = ${ourMeter.toFixed(2)}` },
    { label: "Quiet ≥ 3 ticks",         pass: quietTicks >= 3, detail: `${quietTicks} quiet ticks` },
    { label: "Lower in BOTH NW & land", pass: ourNW < theirNW && ourLand < theirLand,
      detail: `NW: ${ourNW.toLocaleString()} vs ${theirNW.toLocaleString()} · Land: ${ourLand} vs ${theirLand}` },
  ];
  const available = checks.every(c => c.pass);
  return { available, checks };
}

/**
 * How much NW/land to lose or gain to enter range.
 */
function getRangeGap({ ourNW, theirNW, ourLand, theirLand }) {
  const nwLose  = ourNW  - theirNW  / RANGE_MIN;
  const nwGain  = theirNW  / RANGE_MAX - ourNW;
  const landLose = ourLand - theirLand / RANGE_MIN;
  const landGain = theirLand / RANGE_MAX - ourLand;
  return {
    nwToLose:   Math.max(0, Math.round(nwLose)),
    nwToGain:   Math.max(0, Math.round(nwGain)),
    landToLose: Math.max(0, Math.round(landLose)),
    landToGain: Math.max(0, Math.round(landGain)),
  };
}

module.exports = { checkRange, getMeterBand, canWeDeclare, canTheyDeclare, checkFCF, getRangeGap };
