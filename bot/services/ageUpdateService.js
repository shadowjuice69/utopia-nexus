const supabaseService = require("./supabase");
const logger = require("./logger");

async function saveAgeUpdate(updateText, userId, filename) {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  try {
    const match = filename?.match(/Age_(\d+)/i);
    const ageNumber = match ? parseInt(match[1], 10) : null;

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

    return data;

  } catch (err) {
    logger.error(`[AGE UPDATE ERROR] ${err.message}`);
    return null;
  }
}

module.exports = { saveAgeUpdate };
