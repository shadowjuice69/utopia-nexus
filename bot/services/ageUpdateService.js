const supabaseService = require("./supabase");
const logger = require("./logger");
const { parseAgeFileChunked: parseAgeFile, summarize } = require("../parsers/ageParser");

async function saveAgeUpdate(updateText, userId, filename) {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  // Clean invalid characters before storing in Supabase
  updateText = String(updateText)
    .replace(/\u0000/g, "")
    .replace(/\\(?!["\\/bfnrtu])/g, "");

  try {
    const match = filename?.match(/Age[_\s-]?(\d+)/i);
    const ageNumber = match ? parseInt(match[1], 10) : null;

    if (!ageNumber) {
      logger.info(`[AGE UPDATE] Rejected - no age number in filename: ${filename}`);
      return { error: "no_age_number" };
    }

    // Duplicate check
    const { data: existing } = await supabase
      .from("age_updates")
      .select("id, status")
      .eq("age_number", ageNumber)
      .eq("submitted_by", userId)
      .in("status", ["pending", "approved"])
      .limit(1);

    if (existing && existing.length > 0) {
      logger.info(`[AGE UPDATE] Duplicate rejected - Age ${ageNumber} already ${existing[0].status}`);
      return { error: "duplicate", existingId: existing[0].id, status: existing[0].status };
    }

    // Pre-parse to get summary
    const parsed = parseAgeFile(updateText);
    const parsedSummary = summarize(parsed);

    const { data, error } = await supabase
      .from("age_updates")
      .insert({
        age_number: ageNumber,
        raw_text: updateText,
        source: "discord",
        submitted_by: userId,
        status: "pending"
      })
      .select()
      .single();

    if (error) throw error;

    logger.info(`[AGE UPDATE SAVED] ID ${data.id} AGE ${ageNumber}`);
    return { ...data, parsedSummary };

  } catch (err) {
    logger.error(`[AGE UPDATE ERROR] ${err.message}`);
    return null;
  }
}

async function approveAgeUpdate(id, adminId) {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  try {
    // Get the raw text
    const { data: update, error: fetchError } = await supabase
      .from("age_updates")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError) throw fetchError;

    // Parse it
    const parsed = parseAgeFile(update.raw_text);

    console.log("[AGE DEBUG] races:", Object.keys(parsed.races || {}));
    console.log("[AGE DEBUG] personalities:", Object.keys(parsed.personalities || {}));
    console.log("[AGE DEBUG] game_rules:", Object.keys(parsed.game_rules || {}));
    const ageNumber = update.age_number;

    // Batch insert to rules tables
    const raceRows = [];
    for (const [raceName, raceData] of Object.entries(parsed.races)) {
      for (const bonus of raceData.bonuses) {
        raceRows.push({ age_number: ageNumber, race_name: raceName, rule_name: 'bonus', value: bonus, description: bonus });
      }
      for (const penalty of raceData.penalties) {
        raceRows.push({ age_number: ageNumber, race_name: raceName, rule_name: 'penalty', value: penalty, description: penalty });
      }
      for (const [unitName, unitStats] of Object.entries(raceData.units)) {
        raceRows.push({ age_number: ageNumber, race_name: raceName, rule_name: `unit_${unitName}`, value: unitStats, description: `${unitName}: ${unitStats}` });
      }
      if (raceData.war_doctrine) {
        raceRows.push({ age_number: ageNumber, race_name: raceName, rule_name: 'war_doctrine', value: raceData.war_doctrine, description: raceData.war_doctrine });
      }
      if (raceData.unique_passive) {
        raceRows.push({ age_number: ageNumber, race_name: raceName, rule_name: 'unique_passive', value: raceData.unique_passive, description: raceData.unique_passive });
      }
      if (raceData.spells.length) {
        raceRows.push({ age_number: ageNumber, race_name: raceName, rule_name: 'spells', value: raceData.spells.join(', '), description: raceData.spells.join(', ') });
      }
    }

    const personalityRows = [];
    for (const [pName, pData] of Object.entries(parsed.personalities)) {
      for (const bonus of pData.bonuses) {
        personalityRows.push({ age_number: ageNumber, personality_name: pName, rule_name: 'bonus', value: bonus, description: bonus });
      }
      if (pData.unique_passive) {
        personalityRows.push({ age_number: ageNumber, personality_name: pName, rule_name: 'unique_passive', value: pData.unique_passive, description: pData.unique_passive });
      }
      if (pData.spells.length) {
        personalityRows.push({ age_number: ageNumber, personality_name: pName, rule_name: 'spells', value: pData.spells.join(', '), description: pData.spells.join(', ') });
      }
      for (const s of pData.starts_with) {
        personalityRows.push({ age_number: ageNumber, personality_name: pName, rule_name: 'starts_with', value: s, description: s });
      }
    }

    const gameRows = [];
    for (const [key, val] of Object.entries(parsed.spells)) {
      gameRows.push({ age_number: ageNumber, category: 'spell', rule_name: key, value: val, description: val });
    }
    for (const [key, val] of Object.entries(parsed.thievery)) {
      gameRows.push({ age_number: ageNumber, category: 'thievery', rule_name: key, value: val, description: val });
    }
    for (const [key, val] of Object.entries(parsed.buildings)) {
      gameRows.push({ age_number: ageNumber, category: 'building', rule_name: key, value: val, description: val });
    }
    for (const [key, val] of Object.entries(parsed.science)) {
      gameRows.push({ age_number: ageNumber, category: 'science', rule_name: key, value: val, description: val });
    }
    for (const [key, val] of Object.entries(parsed.game_rules)) {
      gameRows.push({ age_number: ageNumber, category: 'game', rule_name: key, value: val, description: val });
    }

    const dragonRows = [];
    for (const [dName, dData] of Object.entries(parsed.dragons)) {
      for (const effect of dData.effects) {
        dragonRows.push({ age_number: ageNumber, category: 'dragon', rule_name: dName, value: effect, description: effect });
      }
    }

    // Clear old rules for this age then insert fresh
    await supabase.from("race_rules").delete().eq("age_number", ageNumber);
    await supabase.from("personality_rules").delete().eq("age_number", ageNumber);
    await supabase.from("game_rules").delete().eq("age_number", ageNumber);

    if (raceRows.length) await supabase.from("race_rules").insert(raceRows);
    if (personalityRows.length) await supabase.from("personality_rules").insert(personalityRows);
    if (gameRows.length || dragonRows.length) await supabase.from("game_rules").insert([...gameRows, ...dragonRows]);

    // Mark approved
    const { data, error } = await supabase
      .from("age_updates")
      .update({ status: "approved", approved_by: adminId, approved_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`[AGE UPDATE APPROVED] ID ${id} BY ${adminId} - ${raceRows.length} race rules, ${personalityRows.length} personality rules, ${gameRows.length + dragonRows.length} game rules`);

    return {
      ...data,
      stats: {
        races: Object.keys(parsed.races).length,
        personalities: Object.keys(parsed.personalities).length,
        raceRows: raceRows.length,
        personalityRows: personalityRows.length,
        gameRows: gameRows.length + dragonRows.length,
        summary: summarize(parsed)
      }
    };

  } catch (err) {
    logger.error(`[AGE APPROVE ERROR] ${err.message}`);
    return null;
  }
}

async function denyAgeUpdate(id, adminId) {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("age_updates")
      .update({ status: "rejected", approved_by: adminId, approved_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    logger.info(`[AGE UPDATE REJECTED] ID ${id} BY ${adminId}`);
    return data;

  } catch (err) {
    logger.error(`[AGE DENY ERROR] ${err.message}`);
    return null;
  }
}

module.exports = { saveAgeUpdate, approveAgeUpdate, denyAgeUpdate };
