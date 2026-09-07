const UTOPIA_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
];

// Current authoritative game-clock anchor supplied by the user:
// Sep 7, 2026 at 5:00 PM America/Chicago = Feb 5, YR6, Tick 5.
// Each real-time hour advances exactly one Utopia day/tick.
const ANCHOR_REAL_MS = Date.parse("2026-09-07T17:00:00-05:00");
const ANCHOR_YEAR = 6;
const ANCHOR_MONTH = 1; // February, zero-based
const ANCHOR_DAY = 5;
const HOURS_PER_MONTH = 24;
const MONTHS_PER_YEAR = UTOPIA_MONTHS.length;
const HOURS_PER_YEAR = HOURS_PER_MONTH * MONTHS_PER_YEAR;

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export function getTickState(date = new Date()) {
  const elapsedHours = (date.getTime() - ANCHOR_REAL_MS) / 3600000;
  const wholeHours = Math.floor(elapsedHours);
  const secondsIntoTick = Math.max(0, Math.floor((elapsedHours - wholeHours) * 3600));

  // The anchor is the beginning of Feb 5 / Tick 5.
  const absoluteGameDay = (ANCHOR_YEAR * HOURS_PER_YEAR) +
    (ANCHOR_MONTH * HOURS_PER_MONTH) +
    (ANCHOR_DAY - 1) + wholeHours;

  const year = Math.floor(absoluteGameDay / HOURS_PER_YEAR);
  const dayOfYear = positiveModulo(absoluteGameDay, HOURS_PER_YEAR);
  const month = Math.floor(dayOfYear / HOURS_PER_MONTH);
  const day = (dayOfYear % HOURS_PER_MONTH) + 1;
  const currentTick = day;

  const minLeft = Math.floor((3600 - secondsIntoTick) / 60);
  const secLeft = (3600 - secondsIntoTick) % 60;

  return {
    current: currentTick,
    minLeft,
    secLeft,
    year,
    month: UTOPIA_MONTHS[month],
    monthIndex: month + 1,
    day,
    label: `${UTOPIA_MONTHS[month]} ${day}, YR${year}`,
    timezone: "America/Chicago",
    source: "Utopia game clock anchor",
  };
}

export function getUtopiaDateLabel(date = new Date()) {
  return getTickState(date).label;
}
