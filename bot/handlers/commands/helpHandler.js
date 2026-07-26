const { EmbedBuilder } = require("discord.js");
const { getKingdomInfo } = require("../../services/kingdomService");

module.exports = async function helpHandler(interaction) {
  const kd = await getKingdomInfo();
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
        value: "AI-powered wiki search. Ask about spells, ops, races, formulas, science, or kingdom strategy. Also type 'wiki' for the wiki link.",
        inline: false
      },
      {
        name: "🔮 /utopia spellcheck",
        value: "Calculate spell success chance based on WPA. Supports all spells, race/personality mods, Mage's Fury, Magic Shield, honor mod, NW warning.",
        inline: false
      },
      {
        name: "🗡️ /utopia thievery",
        value: "Calculate thievery op success chance based on TPA. Supports race/personality mods, Thieves Dens, Watch Towers, Invisibility, NW warning.",
        inline: false
      },
      {
        name: "⚔️ /utopia ambush",
        value: "Calculate minimum offense needed to ambush an enemy army. Enter their troop counts and race.",
        inline: false
      },
      {
        name: "🔬 /utopia science [type]",
        value: "Look up Age 116 science multipliers and effects. Choose a type or 'All' for the full table.",
        inline: false
      },
      {
        name: "📊 /utopia science-summary [province]",
        value: "Calculate science bonuses for your province or a target. Pulls from pasted intel — accurate to game values.",
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
        value: "Paste a throne, military, science, or buildings page to save intel to the database.",
        inline: false
      },
      {
        name: "🎯 /utopia target [province]",
        value: "Look up intel on a specific province.",
        inline: false
      },
      {
        name: "📊 /utopia status",
        value: "Quick kingdom health check — NW, members, recent activity.",
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
        value: "https://dashboard-gold-six-11.vercel.app\nPassword: NikkoAce\nLive ops, attacks, waves, intel, science, spell tracker, province comparison.",
        inline: false
      }
    )
    .setFooter({ text: kd.footer })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
};
