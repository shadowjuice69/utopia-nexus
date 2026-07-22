const { EmbedBuilder } = require("discord.js");

// Age 116 WoL race unit values - defense values used in ambush
const RACE_UNITS = {
  avian:    { eliteDef: 2,  defSpecDef: 10, soldierOff: 3 },
  darkelf:  { eliteDef: 2,  defSpecDef: 12, soldierOff: 3 },
  dryad:    { eliteDef: 3,  defSpecDef: 11, soldierOff: 3 },
  dwarf:    { eliteDef: 7,  defSpecDef: 10, soldierOff: 3 },
  elf:      { eliteDef: 4,  defSpecDef: 13, soldierOff: 3 },
  faery:    { eliteDef: 16, defSpecDef: 10, soldierOff: 3 },
  halfling: { eliteDef: 13, defSpecDef: 10, soldierOff: 3 },
  human:    { eliteDef: 5,  defSpecDef: 12, soldierOff: 3 },
  orc:      { eliteDef: 3,  defSpecDef: 10, soldierOff: 3 },
  undead:   { eliteDef: 4,  defSpecDef: 10, soldierOff: 3 },
};

const RACE_CHOICES = Object.keys(RACE_UNITS);

module.exports = async function ambushHandler(interaction) {
  const race = interaction.options.getString("race").toLowerCase();
  const elites = interaction.options.getInteger("elites") || 0;
  const defspecs = interaction.options.getInteger("defspecs") || 0;
  const soldiers = interaction.options.getInteger("soldiers") || 0;
  const offspecs = interaction.options.getInteger("offspecs") || 0;

  const units = RACE_UNITS[race];
  if (!units) {
    return interaction.reply({
      content: `❌ Unknown race: ${race}. Valid races: ${RACE_CHOICES.join(", ")}`,
      ephemeral: true
    });
  }

  // Ambush defense formula:
  // Elites defend at their Elite Defense value
  // Off Specs defend at their RACE'S Def Spec value (not their offense value)
  // Soldiers defend at racial soldier OFFENSE value (3) — NOT defense
  // Horses do NOT defend in ambush
  const ambushDef =
    (elites * units.eliteDef) +
    (offspecs * units.defSpecDef) +
    (soldiers * units.soldierOff);

  const minRawOff = Math.ceil(ambushDef * 0.80);
  const safeOff = minRawOff + 100; // +100 flat buffer recommended

  const raceName = race.charAt(0).toUpperCase() + race.slice(1);

  const embed = new EmbedBuilder()
    .setTitle(`⚡ Ambush Calculator — ${raceName}`)
    .setColor(0xf5c542)
    .addFields(
      {
        name: "🛡️ Enemy Army (Ambush Defense)",
        value: [
          `Elites: **${elites.toLocaleString()}** × ${units.eliteDef} def = **${(elites * units.eliteDef).toLocaleString()}**`,
          `Off Specs: **${offspecs.toLocaleString()}** × ${units.defSpecDef} (def spec value) = **${(offspecs * units.defSpecDef).toLocaleString()}**`,
          `Soldiers: **${soldiers.toLocaleString()}** × 3 (soldier OFF value) = **${(soldiers * 3).toLocaleString()}**`,
          `⚠️ Horses: NOT counted in ambush defense`,
          `\n**Total Ambush Defense: ${ambushDef.toLocaleString()}**`,
        ].join("\n"),
        inline: false
      },
      {
        name: "⚔️ Minimum Raw Offense Needed",
        value: [
          `Formula: ${ambushDef.toLocaleString()} × 0.80 = **${minRawOff.toLocaleString()}**`,
          `With +100 safety buffer: **${safeOff.toLocaleString()}**`,
        ].join("\n"),
        inline: false
      },
      {
        name: "📋 Ambush Rules (Age 116)",
        value: [
          "✅ Gains: 50% of enemy acres returned",
          "✅ Unaffected by all gains modifiers",
          "✅ Only 1 General counts for offense",
          "⚠️ +15% Military Casualties for attacker",
          "⚠️ Off Specs defend at DEF SPEC value, not their offense value",
          "⚠️ Soldiers defend at OFFENSE value (3), not defense (0)",
          "⚠️ Horses do NOT defend",
          "⚠️ Cannot ambush if target used Anonymity or War Spoils",
          "⚠️ Army can only be ambushed ONCE",
          "💡 Aggression spell on YOUR province adds +2 to soldier offense value",
        ].join("\n"),
        inline: false
      }
    )
    .setFooter({ text: "Judo Kingdom (4:9) • WoL Age 116 • Utopia Nexus" });

  return interaction.reply({ embeds: [embed], ephemeral: true });
};
