const ROUTE_TYPES = [
  "throne",
  "survey",
  "science",
  "som",
  "state",
  "news",
  "intel-site",
  "kingdom",
  "kingdom-page",
  "kd-stats-generic",
  "kd-stats-buildings",
  "attack",
  "spell",
  "thievery"
];

function textOf(capture) {
  return [
    capture?.url,
    capture?.tab,
    capture?.title,
    capture?.page_kind,
    capture?.source,
    capture?.data_type,
    capture?.data?.text,
    capture?.data?.raw_text,
    capture?.data?.raw
  ].filter(Boolean).join(" ").toLowerCase();
}

function classifyUniversalCapture(capture = {}) {
  const text = textOf(capture);
  const url = String(capture.url || "").toLowerCase();
  const tab = String(capture.tab || capture.page_kind || "").toLowerCase();
  const scores = Object.fromEntries(ROUTE_TYPES.map(type => [type, 0]));

  const add = (type, points) => { if (scores[type] !== undefined) scores[type] += points; };

  if (/throne|province.*summary|province.*overview|ruler|your province/.test(text)) add("throne", 8);
  if (/survey|buildings|building.*efficiency|construction/.test(text)) add("survey", 8);
  if (/science|alchemy|channeling|crime|housing|magic|military.*science/.test(text)) add("science", 7);
  if (/som|survey of military|military.*intel|offense.*defense|generals/.test(text)) add("som", 9);
  if (/state|population|peasants|unemployed|jobs|daily income|wages/.test(text)) add("state", 7);
  if (/news|war room|recent attacks|battle report|news.*events/.test(text)) add("news", 7);
  if (/kingdom|provinces.*kingdom|kd overview|kingdom overview/.test(text)) add("kingdom-page", 7);
  if (/kd stats|kingdom stats|statistics/.test(text)) add("kd-stats-generic", 7);
  if (/attack|invaded|captured.*acres|lost.*troops/.test(text)) add("attack", 8);
  if (/spell|magic.*cast|successfully cast|failed spell/.test(text)) add("spell", 8);
  if (/thievery|thieves|thievery operation|stole|robbed|sabotage/.test(text)) add("thievery", 8);

  // Match the actual Utopia route names used by the Universal Capture browser script.
  if (/\/throne(?:[/?#]|$)/.test(url)) add("throne", 12);
  if (/\/survey(?:[/?#]|$)|\/build(?:[/?#]|$)/.test(url)) add("survey", 12);
  if (/\/science(?:[/?#]|$)|\/council_science(?:[/?#]|$)/.test(url)) add("science", 12);
  if (/\/military|\/som(?:[/?#]|$)|\/send_armies(?:[/?#]|$)|\/train_army(?:[/?#]|$)|\/release_army(?:[/?#]|$)/.test(url)) add("som", 12);
  if (/\/state(?:[/?#]|$)|\/council_state(?:[/?#]|$)/.test(url)) add("state", 12);
  if (/\/news(?:[/?#]|$)|\/province_news(?:[/?#]|$)|\/kingdom_news(?:[/?#]|$)/.test(url)) add("news", 12);
  if (/\/kingdom(?:[/?#]|$)|\/kingdom_details(?:[/?#]|$)/.test(url)) add("kingdom-page", 12);
  if (/\/stats(?:[/?#]|$)|kd.?stats/.test(url)) add("kd-stats-generic", 12);
  if (/\/attack|\/war/.test(url)) add("attack", 10);
  if (/\/spell|\/magic/.test(url)) add("spell", 10);
  if (/\/thievery|\/thieves/.test(url)) add("thievery", 10);
  if (/intel\.utopia\.site/.test(url)) add("intel-site", 20);

  // Specialized aliases are only selected when the capture itself strongly indicates them.
  if (/building.*stats|stats.*building/.test(text)) scores["kd-stats-buildings"] += 10;
  if (/complete vault|intel 7|intel-site/.test(text)) scores["intel-site"] += 12;

  // A generic game page must not be forced into a specialized table just because
  // it contains broad words such as "magic", "thieves", or "population".
  // The URL-specific evidence above is preferred and the fallback remains lossless.
  let best = null;
  let second = 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > (best?.score || 0)) {
      second = best?.score || 0;
      best = { type, score };
    } else if (score > second) {
      second = score;
    }
  }

  const confidence = best && best.score >= 8
    ? Math.min(99, Math.round(55 + best.score * 3 + Math.max(0, best.score - second) * 2))
    : 0;
  const ambiguous = !best || best.score < 8 || (best.score - second < 3 && best.score < 15);

  return {
    type: ambiguous ? null : best.type,
    confidence,
    ambiguous,
    scores,
    reason: ambiguous
      ? "Universal capture did not contain enough unique evidence for a trusted destination."
      : `Universal capture classified as ${best.type} from URL/page metadata/content signatures.`
  };
}

module.exports = { classifyUniversalCapture, ROUTE_TYPES };
