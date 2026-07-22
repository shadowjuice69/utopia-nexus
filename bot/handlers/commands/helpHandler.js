const { EmbedBuilder } = require("discord.js");

module.exports = async function helpHandler(interaction) {
  const embed = new EmbedBuilder()
    .setTitle("⚔️ Utopia Nexus — Command Guide")
    .setColor(0x38bdf8)
    .setDescription("All available commands for Judo kingdom members. Age 116.")
    .addFields(
      {
        name: "👤 /utopia register",
        value: "Register your province — race, personality, role, timezone, wave times. Re-register each age.",
        inline: false
      },
      {
        name: "🏰 /utopia province",
        value: "View your registered province profile.",
        inline: false
      },
      {
        name: "👤 /utopia profile",
        value: "View your member profile and XP.",
        inline: false
      },
      {
        name: "🧠 /utopia ask [question]",
        value: "Ask the AI a game question. Searches the full Age 116 wiki — spells, ops, races, formulas, mechanics.",
        inline: false
      },
      {
        name: "⚔️ /utopia analyze-war",
        value: "AI war analysis — what happened, who is winning, enemy weaknesses, recommended actions.",
        inline: false
      },
      {
        name: "🌊 /utopia waves",
        value: "Kingdom wave schedule for the next 12 ticks in your local timezone.",
        inline: false
      },
      {
        name: "📋 /utopia intel",
        value: "Paste a throne or military page from Utopia to save enemy intel to the database.",
        inline: false
      },
      {
        name: "🎯 /utopia target [province]",
        value: "Look up intel on a specific province or show top ranked targets in your NW range.",
        inline: false
      },
      {
        name: "📊 /utopia status",
        value: "Quick kingdom health check — NW, members, recent activity.",
        inline: false
      },
      {
        name: "⚠️ /utopia threat",
        value: "Show threat levels from enemy kingdoms based on recent ops and attacks.",
        inline: false
      },
      {
        name: "📖 /utopia wiki",
        value: "Open the Utopia Nexus Age 116 wiki.",
        inline: false
      },
      {
        name: "👥 /utopia citizens",
        value: "View all kingdom citizens.",
        inline: false
      },
      {
        name: "🏅 /utopia leadership",
        value: "View kingdom leadership roles.",
        inline: false
      },
      {
        name: "👤 /utopia member [user]",
        value: "View another member's profile.",
        inline: false
      },
      {
        name: "🌐 War Room Dashboard",
        value: "https://dashboard-gold-six-11.vercel.app\nPassword: NikkoAce\nLive ops, wave schedule, attack calculator, intel, alerts.",
        inline: false
      }
    )
    .setFooter({ text: "Judo Kingdom (4:9) • WoL Age 116 • Utopia Nexus" })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
};
