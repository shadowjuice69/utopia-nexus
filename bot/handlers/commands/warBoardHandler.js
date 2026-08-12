const { updateWarStatusBoard } = require("../../services/warStatusBoard");
const supabaseService = require("../../services/supabase");

module.exports = async function warBoardHandler(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const supabase = supabaseService.getClient();
  try {
    await updateWarStatusBoard(interaction.client, supabase);
    return interaction.editReply("✅ War status board updated!");
  } catch (err) {
    return interaction.editReply("❌ Failed: " + err.message);
  }
};
