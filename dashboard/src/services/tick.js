export function getTickState(date = new Date()) {
  const minutesSinceStart = ((date.getUTCHours() - 13 + 24) % 24) * 60 + date.getUTCMinutes();
  const currentTick = Math.floor(minutesSinceStart / 60) + 1;
  const minLeft = 59 - date.getUTCMinutes();
  const secLeft = 59 - date.getUTCSeconds();

  return { current: currentTick, minLeft, secLeft };
}
