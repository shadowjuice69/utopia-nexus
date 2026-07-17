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


async function approveAgeUpdate(id, adminId) {
  const supabase = supabaseService.getClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("age_updates")
      .update({
        status: "approved",
        approved_by: adminId,
        approved_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`[AGE UPDATE APPROVED] ID ${id} BY ${adminId}`);

    return data;

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
      .update({
        status: "rejected",
        approved_by: adminId,
        approved_at: new Date().toISOString()
      })
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


module.exports = {
  saveAgeUpdate,
  approveAgeUpdate,
  denyAgeUpdate
};
