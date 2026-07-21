const supabaseService = require("../services/supabase");
const logger = require("../services/logger");

function cleanNum(str) {
  if (!str) return null;
  return str.toString().replace(/,/g, "").trim();
}

function parseNewsLog(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const results = { spyMilitary: [], attacks: [] };

  for (const line of lines) {
    // Spy on Military
    if (line.includes("Military Elders of") && line.includes("net Offensive Points")) {
      const coordsMatch = line.match(/(\w[\w\s]+?)\s*\(([^)]+)\),\s*sent/i);
      const province = coordsMatch ? coordsMatch[1].trim() : null;
      const coords = coordsMatch ? coordsMatch[2] : null;
      const spy = { coordinates: coords, province_name: province };

      const nameMatch = line.match(/Military Elders of (.+?):/i);
      if (nameMatch) spy.ruler = nameMatch[1].trim();

      const genMatch = line.match(/(\d+) generals? are available/i);
      if (genMatch) spy.generals = genMatch[1];

      const wagesMatch = line.match(/wages are at ([\d.]+)% of normal/i);
      if (wagesMatch) spy.wages = wagesMatch[1];

      const omeMatch = line.match(/Offense: ([\d.]+)% effectiveness with ([\d,]+) net Offensive Points/i);
      if (omeMatch) { spy.ome = omeMatch[1]; spy.off = cleanNum(omeMatch[2]); }

      const dmeMatch = line.match(/Defense: ([\d.]+)% effectiveness with ([\d,]+) net Defensive Points/i);
      if (dmeMatch) { spy.dme = dmeMatch[1]; spy.def = cleanNum(dmeMatch[2]); }

      const troopsMatch = line.match(/At home: ([\d,]+) soldiers?, ([\d,]+) offensive specialists?, ([\d,]+) defensive specialists?, ([\d,]+) elites?, and ([\d,]+) war horses/i);
      if (troopsMatch) {
        spy.soldiers = cleanNum(troopsMatch[1]);
        spy.off_specs = cleanNum(troopsMatch[2]);
        spy.def_specs = cleanNum(troopsMatch[3]);
        spy.elites = cleanNum(troopsMatch[4]);
        spy.war_horses = cleanNum(troopsMatch[5]);
      }

      if (spy.off) results.spyMilitary.push(spy);
      continue;
    }

    // Attack result
    if (line.includes("Your forces arrive at") && line.includes("taken")) {
      const coordsMatch = line.match(/arrive at (.+?)\s*\(([^)]+)\)/i);
      const atk = {
        target_province: coordsMatch ? coordsMatch[1].trim() : null,
        target_kingdom: coordsMatch ? coordsMatch[2] : null
      };

      const acresMatch = line.match(/taken ([\d,]+) acres/i);
      if (acresMatch) atk.acres_captured = cleanNum(acresMatch[1]);

      const killsMatch = line.match(/killed about ([\d,]+) enemy troops/i);
      if (killsMatch) atk.kills = cleanNum(killsMatch[1]);

      const lossMatch = line.match(/lost ([\d,]+) (\w+) in this battle/i);
      if (lossMatch) { atk.own_losses = cleanNum(lossMatch[1]); atk.unit_lost = lossMatch[2]; }

      if (atk.acres_captured) results.attacks.push(atk);
      continue;
    }
  }

  return results;
}

async function saveNewsIntel(parsed, submittedBy) {
  const supabase = supabaseService.getClient();
  if (!supabase) return { saved: 0, errors: 0, spyCount: 0, attackCount: 0 };

  let saved = 0;
  let errors = 0;

  for (const spy of parsed.spyMilitary) {
    if (!spy.off && !spy.def) continue;
    try {
      const { data: existing } = await supabase
        .from("provinces")
        .select("id, name")
        .eq("coordinates", spy.coordinates)
        .limit(1);

      const updateData = {
        updated_at: new Date().toISOString(),
        coordinates: spy.coordinates,
        intel_age: "0"
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
        updateData.name = spy.province_name || spy.ruler || spy.coordinates;
        const { error: insertErr } = await supabase.from("provinces").insert(updateData);
        if (insertErr) logger.error(`[NEWS INSERT ERROR] ${insertErr.message}`);
      }
      saved++;
    } catch (e) {
      logger.error(`[NEWS PARSER] Spy save error: ${e.message}`);
      errors++;
    }
  }

  for (const atk of parsed.attacks) {
    try {
      await supabase.from("attacks").insert({
        timestamp: new Date().toISOString(),
        attacker_province: "Freaking A",
        target_province: atk.target_province,
        target_kingdom: atk.target_kingdom,
        acres_captured: parseInt(atk.acres_captured) || 0,
        kills: parseInt(atk.kills) || 0,
        message_id: `news_${Date.now()}_${Math.random().toString(36).slice(2)}`
      });
      saved++;
    } catch (e) {
      errors++;
    }
  }

  
  // Save news event records
  for (const atk of parsed.attacks) {
    try {
      const { error } = await supabase.from("news_events").insert({
        user_id: submittedBy,
        date: new Date().toISOString(),
        attacker_name: "Freaking A",
        defender_name: atk.target_province,
        defender_kd: atk.target_kingdom,
        acres: parseInt(atk.acres_captured) || 0,
        killed: parseInt(atk.kills) || 0,
        in_war: false,
        event_type: "attack",
        kd_code: atk.target_kingdom
      });

      if (error) {
        logger.error(`[NEWS EVENT ERROR] ${error.message}`);
        errors++;
      } else {
        saved++;
      }
    } catch (e) {
      logger.error(`[NEWS EVENT ERROR] ${e.message}`);
      errors++;
    }
  }

return { saved, errors, spyCount: parsed.spyMilitary.length, attackCount: parsed.attacks.length };
}

module.exports = { parseNewsLog, saveNewsIntel };
