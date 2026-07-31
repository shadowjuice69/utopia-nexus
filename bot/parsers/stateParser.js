function cleanNum(str) {
  if (!str) return null;
  const n = parseInt(str.toString().replace(/,/g,"").replace(/[^0-9-]/g,""));
  return isNaN(n) ? null : n;
}

function parseState(text) {
  const result = {};
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const cols = line.split("\t").map(c => c.trim());
    const c = (i) => cols[i] || null;

    // Population rows
    if (cols[0] === "Peasants" && cols[1] && cols[2] === "Peasants") {
      result.peasants = cleanNum(c(1));
      result.unemployed = cleanNum(c(4));
      continue;
    }
    if (cols[0] === "Army") {
      result.army = cleanNum(c(1));
      result.unfilled_jobs = cleanNum(c(4));
      continue;
    }
    if (cols[0] === "Thieves") {
      result.thieves = cleanNum(c(1));
      result.employment_pct = c(4);
      continue;
    }
    if (cols[0] === "Wizards") {
      result.wizards = cleanNum(c(1));
      result.daily_income = cleanNum(c(4));
      continue;
    }
    if (cols[0] === "Total") {
      result.total_pop = cleanNum(c(1));
      result.daily_wages = cleanNum(c(4));
      continue;
    }
    if (cols[0] === "Max Population") {
      result.max_pop = cleanNum(c(1));
      continue;
    }

    // Highlights
    if (line.includes("Current Networth")) {
      const m = line.match(/Current Networth\s+([\d,]+)/);
      if (m) result.networth = cleanNum(m[1]);
    }
    if (line.includes("Current Land")) {
      const m = line.match(/Current Land\s+([\d,]+)/);
      if (m) result.land = cleanNum(m[1]);
    }
    if (line.includes("Current Honor")) {
      const m = line.match(/Current Honor\s+([\d,]+)/);
      if (m) result.honor = cleanNum(m[1]);
    }
    if (line.includes("Land Rank")) {
      const m = line.match(/Land Rank\s+([\d,]+ of [\d,]+)/);
      if (m) result.land_rank = m[1];
    }
    if (line.includes("Networth Rank")) {
      const m = line.match(/Networth Rank\s+([\d,]+ of [\d,]+)/);
      if (m) result.nw_rank = m[1];
    }
    if (line.includes("Multi-Attack Protection")) {
      const m = line.match(/Multi-Attack Protection\s+(.+)/);
      if (m) result.map = m[1].trim();
    }

    // Trends - tab separated: Label | yesterday | this month | last month
    if (cols[0] === "Our Income") {
      result.income_yesterday = cleanNum(c(1));
      result.income_month = cleanNum(c(2));
      continue;
    }
    if (cols[0] === "Military Wages") {
      result.wages_yesterday = cleanNum(c(1));
      result.wages_month = cleanNum(c(2));
      continue;
    }
    if (cols[0] === "Draft Costs") {
      result.draft_yesterday = cleanNum(c(1));
      result.draft_month = cleanNum(c(2));
      continue;
    }
    if (cols[0] === "Net Change" && cols[1] && cols[1].includes("gc")) {
      result.net_yesterday = cleanNum(c(1));
      result.net_month = cleanNum(c(2));
      continue;
    }
    if (cols[0] === "Peasants" && cols[1] && cols[1].includes("peasants")) {
      result.peasants_yesterday = cleanNum(c(1));
      result.peasants_month = cleanNum(c(2));
      continue;
    }
    if (cols[0] === "Food Grown") {
      result.food_grown_yesterday = cleanNum(c(1));
      result.food_grown_month = cleanNum(c(2));
      continue;
    }
    if (cols[0] === "Food Needed") {
      result.food_needed_yesterday = cleanNum(c(1));
      result.food_needed_month = cleanNum(c(2));
      continue;
    }
    if (cols[0] === "Food Decayed") {
      result.food_decay_yesterday = cleanNum(c(1));
      result.food_decay_month = cleanNum(c(2));
      continue;
    }
    if (cols[0] === "Net Change" && cols[1] && cols[1].includes("bushels")) {
      result.food_net_yesterday = cleanNum(c(1));
      result.food_net_month = cleanNum(c(2));
      continue;
    }
    if (cols[0] === "Runes Produced") {
      result.runes_produced_yesterday = cleanNum(c(1));
      result.runes_produced_month = cleanNum(c(2));
      continue;
    }
    if (cols[0] === "Runes Decayed") {
      result.runes_decay_yesterday = cleanNum(c(1));
      result.runes_decay_month = cleanNum(c(2));
      continue;
    }
    if (cols[0] === "Net Change" && cols[1] && cols[1].includes("runes")) {
      result.runes_net_yesterday = cleanNum(c(1));
      result.runes_net_month = cleanNum(c(2));
      continue;
    }
  }

  return result;
}

module.exports = { parseState };
