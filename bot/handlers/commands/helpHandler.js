const { EmbedBuilder } = require("discord.js");

module.exports = async function helpHandler(interaction) {
  const embed = new EmbedBuilder()
    .setTitle("⚔️ Utopia Nexus — Command Guide")
    .setColor(0x38bdf8)
    .setDescription("All available commands for Judo kingdom members.")
    .addFields(
      {
        name: "👤 /utopia register",
        value: "Register your province with race, personality, role, timezone and wave times. Required before using other commands.",
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
        name: "📋 /utopia intel",
        value: "Paste a throne or military page from Utopia to save enemy intel to the database.",
        inline: false
      },
      {
        name: "🎯 /utopia target [province]",
        value: "Look up intel on a specific province, or show top ranked targets in your NW range.",
        inline: false
      },
      {
        name: "🧠 /utopia ask [question]",
        value: "Ask the Utopia Nexus AI a game question. Searches the wiki and Age 116 rules.",
        inline: false
      },
      {
        name: "🌊 /utopia waves",
        value: "Show the kingdom wave schedule for the next 12 ticks in your timezone.",
        inline: false
      },
      {
        name: "📊 /utopia status",
        value: "Quick kingdom health check — NW, members, activity.",
        inline: false
      },
      {
        name: "📖 /utopia wiki",
        value: "Open the Utopia Nexus wiki in your browser.",
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
        name: "🌐 Dashboard",
        value: "https://dashboard-gold-six-11.vercel.app\nPassword: ask your General",
        inline: false
      }
    )
    .setFooter({ text: "Judo Kingdom (4:9) • Utopia Nexus Bot" })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
};
