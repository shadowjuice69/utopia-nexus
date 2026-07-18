const { buildThreatMeter } = require("../../services/hostileAlertService");
const supabaseService = require("../../services/supabase");

module.exports = async function threatHandler(interaction) {
  await interaction.deferReply({ ephemeral: false });

  const supabase = supabaseService.getClient();
  const meter = await buildThreatMeter(supabase);

  if (!meter || meter.length === 0) {
    return interaction.editReply("✅ No hostile activity detected in the last 24 hours.");
  }

  const threatLevel = (score) => {
    if (score >= 10) return "🔴 CRITICAL";
    if (score >= 6) return "🟠 HIGH";
    if (score >= 3) return "🟡 MEDIUM";
    return "🟢 LOW";
  };

  const lines = [`⚠️ **Kingdom Threat Meter — Last 24h**\n`];

  for (const [kd, data] of meter) {
    const score = data.ops + data.attacks * 2;
    lines.push(`${threatLevel(score)} **${kd}**`);
    lines.push(`  Ops: ${data.ops} (${data.successfulOps} successful) • Attacks: ${data.attacks}`);
  }

  return interaction.editReply(lines.join('\n'));
};
