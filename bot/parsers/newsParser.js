const supabaseService = require("../services/supabase");
const logger = require("../services/logger");
const { parseNews } = require("./news");

function cleanNum(str) {
  if (!str) return null;
  return str.toString().replace(/,/g, "").trim();
}

function parseSpyMilitary(text, coordsStr) {
  const result = { coordinates: coordsStr };

  // Province name from coords context — "The Humble Baron Novice"
  const nameMatch = text.match(/Military Elders of (.+?):/i);
  if (nameMatch) result.ruler = nameMatch[1].trim();

  // Generals
  const genMatch = text.match(/(\d+) generals? are available/i);
  if (genMatch) result.generals = genMatch[1];

  // Wages
  const wagesMatch = text.match(/wages are at ([\d.]+)% of normal/i);
  if (wagesMatch) result.wages = wagesMatch[1];

  // OME
  const omeMatch = text.match(/Offense: ([\d.]+)% effectiveness with ([\d,]+) net Offensive Points/i);
  if (omeMatch) { result.ome = omeMatch[1]; result.off = cleanNum(omeMatch[2]); }

  // DME
  const dmeMatch = text.match(/Defense: ([\d.]+)% effectiveness with ([\d,]+) net Defensive Points/i);
  if (dmeMatch) { result.dme = dmeMatch[1]; result.def = cleanNum(dmeMatch[2]); }

  // Troops
  const troopsMatch = text.match(/At home: ([\d,]+) soldiers?, ([\d,]+) offensive specialists?, ([\d,]+) defensive specialists?, ([\d,]+) elites?, and ([\d,]+) war horses/i);
  if (troopsMatch) {
    result.soldiers = cleanNum(troopsMatch[1]);
    result.off_specs = cleanNum(troopsMatch[2]);
    result.def_specs = cleanNum(troopsMatch[3]);
    result.elites = cleanNum(troopsMatch[4]);
    result.war_horses = cleanNum(troopsMatch[5]);
  }

  return result;
}

function parseAttackResult(text, coordsStr) {
  const result = { coordinates: coordsStr };

  const acresMatch = text.match(/taken ([\d,]+) acres/i);
  if (acresMatch) result.acres_captured = cleanNum(acresMatch[1]);

  const killsMatch = text.match(/killed about ([\d,]+) enemy troops/i);
  if (killsMatch) result.kills = cleanNum(killsMatch[1]);

  const lossMatch = text.match(/lost ([\d,]+) (\w+) in this battle/i);
  if (lossMatch) { result.own_losses = cleanNum(lossMatch[1]); result.unit_lost = lossMatch[2]; }

  const honorMatch = text.match(/gained ([\d,]+) honor/i);
  if (honorMatch) result.honor_gained = cleanNum(honorMatch[1]);

  const specCreditsMatch = text.match(/gained ([\d,]+) specialist training credits/i);
  if (specCreditsMatch) result.spec_credits = cleanNum(specCreditsMatch[1]);

  return result;
}

function parseNewsLog(text) {
  const parsed = parseNews(text);

  return {
    spyMilitary: parsed.intel.filter(i => i.category === "military"),
    attacks: parsed.attacks,
    spells: parsed.spells,
    science: parsed.science,
    military: parsed.military,
    economy: parsed.economy,
    events: parsed.events
  };
}

async function saveNewsIntel(parsed, submittedBy) {
  const supabase = supabaseService.getClient();
  if (!supabase) return { saved: 0, errors: 0 };

  let saved = 0;
  let errors = 0;

  // Save spy military intel to provinces
  for (const spy of parsed.spyMilitary) {
    if (!spy.off && !spy.def) continue;
    try {
      // Try to find existing province by coordinates
      const { data: existing } = await supabase
        .from("provinces")
        .select("id, name")
        .eq("coordinates", spy.coordinates)
        .limit(1);

      const updateData = {
        updated_at: new Date().toISOString(),
        coordinates: spy.coordinates
      };

      if (spy.off) updateData.off = spy.off;
      if (spy.def) updateData.def = spy.def;
      if (spy.ome) updateData.ome = spy.ome;
      if (spy.dme) updateData.dme = spy.dme;
      if (spy.wages) updateData.wages = spy.wages;
      if (spy.generals) updateData.generals = spy.generals;
      if (spy.soldiers) updateData.soldiers = spy.soldiers;
      if (spy.off_specs) updateData.off_specs = spy.off_specs;
      if (spy.def_specs) updateData.def_specs = spy.def_specs;
      if (spy.elites) updateData.elites = spy.elites;
      if (spy.war_horses) updateData.war_horses = spy.war_horses;
      if (spy.ruler) updateData.ruler = spy.ruler;

      if (existing && existing.length > 0) {
        await supabase.from("provinces").update(updateData).eq("id", existing[0].id);
      } else {
        updateData.name = spy.coordinates; // Use coords as temp name
        await supabase.from("provinces").insert(updateData);
      }
      saved++;
    } catch (e) {
      logger.error(`[NEWS PARSER] Spy save error: ${e.message}`);
      errors++;
    }
  }

  // Save attacks
  for (const atk of parsed.attacks) {
    if (!atk.acres_captured) continue;
    try {
      await supabase.from("attacks").insert({
        timestamp: new Date().toISOString(),
        attacker_province: "Freaking A",
        target_province: atk.target_province,
        target_kingdom: atk.target_kingdom,
        acres_captured: atk.acres_captured,
        kills: atk.kills,
        message_id: `news_${Date.now()}`
      });
      saved++;
    } catch (e) {
      errors++;
    }
  }

  return { saved, errors, spyCount: parsed.spyMilitary.length, attackCount: parsed.attacks.length };
}

module.exports = { parseNewsLog, saveNewsIntel };
