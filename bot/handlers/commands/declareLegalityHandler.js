const { EmbedBuilder } = require("discord.js");
const {
  checkRange, getMeterBand, canWeDeclare, canTheyDeclare, checkFCF, getRangeGap
} = require("../../services/warLegalityService");

function checkLine(pass, label, detail) {
  return `${pass ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`;
}

module.exports = async function declareLegalityHandler(interaction) {
  try {
    const ourNW      = interaction.options.getNumber("our_nw",    true);
    const theirNW    = interaction.options.getNumber("their_nw",  true);
    const ourLand    = interaction.options.getInteger("our_land",  true);
    const theirLand  = interaction.options.getInteger("their_land",true);
    const ourMeter   = interaction.options.getNumber("our_meter",  true);
    const theirMeter = interaction.options.getNumber("their_meter",true);
    const quietTicks = interaction.options.getInteger("quiet_ticks") ?? 0;
    const theirName  = interaction.options.getString("their_name") ?? "Target Kingdom";

    const range   = checkRange({ ourNW, theirNW, ourLand, theirLand });
    const weDecl  = canWeDeclare({ ourMeter, theirMeter, range });
    const theyDecl = canTheyDeclare({ ourMeter, theirMeter, range });
    const fcf     = checkFCF({ ourMeter, theirMeter, ourNW, theirNW, ourLand, theirLand, quietTicks });
    const gap     = getRangeGap({ ourNW, theirNW, ourLand, theirLand });
    const ourBand  = getMeterBand(ourMeter);
    const theirBand = getMeterBand(theirMeter);

    const embed = new EmbedBuilder()
      .setTitle(`⚖️ War Legality — vs ${theirName}`)
      .setColor(weDecl.can ? 0xcc2200 : theyDecl.can ? 0xff8800 : 0x22c55e)
      .addFields(
        {
          name: "📊 Hostility Meters",
          value:
            `Us → Them: ${ourBand.emoji} **${ourMeter}** (${ourBand.label})\n` +
            `Them → Us: ${theirBand.emoji} **${theirMeter}** (${theirBand.label})\n` +
            `Bands: Unfriendly 15 · Hostile 30 · Mutual-Declare 60/60 · Auto-War 180/180`,
          inline: false
        },
        {
          name: "🗺️ Range Check",
          value:
            `NW: **${(range.nwRatio*100).toFixed(1)}%** ${range.nwIn ? "✅" : "❌"} (85–117.65%)\n` +
            `Land: **${(range.landRatio*100).toFixed(1)}%** ${range.landIn ? "✅" : "❌"} (85–117.65%)\n` +
            (range.theyAreSmaller ? "⚠️ They are smaller — BOTH axes required" : "They are larger — either axis suffices"),
          inline: false
        },
        {
          name: `${weDecl.can ? "🔥" : "🚫"} CAN WE DECLARE?`,
          value: weDecl.checks.map(c => checkLine(c.pass, c.label, c.detail)).join("\n") +
            `\n→ **${weDecl.can ? "YES — DECLARE AVAILABLE" : "NO"}**`,
          inline: false
        },
        {
          name: `${theyDecl.can ? "⚠️" : "✅"} CAN THEY DECLARE ON US?`,
          value: theyDecl.checks.map(c => checkLine(c.pass, c.label, c.detail)).join("\n") +
            `\n→ **${theyDecl.can ? "YES — THEY CAN DECLARE" : "NO"}**`,
          inline: false
        },
        {
          name: `${fcf.available ? "🕊️" : "🚫"} FCF AVAILABLE?`,
          value: fcf.checks.map(c => checkLine(c.pass, c.label, c.detail)).join("\n") +
            `\n→ **${fcf.available ? "YES — FCF AVAILABLE" : "NO"}**`,
          inline: false
        }
      );

    if (!range.inRange) {
      const lines = [];
      if (gap.nwToLose  > 0) lines.push(`Lose **${gap.nwToLose.toLocaleString()}** NW to enter NW range`);
      if (gap.nwToGain  > 0) lines.push(`Gain **${gap.nwToGain.toLocaleString()}** NW to enter NW range`);
      if (gap.landToLose > 0) lines.push(`Lose **${gap.landToLose.toLocaleString()}** land to enter land range`);
      if (gap.landToGain > 0) lines.push(`Gain **${gap.landToGain.toLocaleString()}** land to enter land range`);
      if (lines.length) {
        embed.addFields({ name: "📏 Get In Range", value: lines.join("\n"), inline: false });
      }
    }

    embed.setTimestamp().setFooter({ text: "Range: 85–117.65% NW or Land" });

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } catch (err) {
    console.error("[DECLARE HANDLER ERROR]", err);
    if (!interaction.replied) {
      await interaction.reply({ content: "❌ Declare check failed.", ephemeral: true });
    }
  }
};
