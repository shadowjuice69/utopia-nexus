const { EmbedBuilder } = require("discord.js");
const { getKingdomInfo } = require("../../services/kingdomService");

// Age 116 WoL race unit values
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
  const kd = await getKingdomInfo();

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

  const ambushDef =
    (elites * units.eliteDef) +
    (offspecs * units.defSpecDef) +
    (soldiers * units.soldierOff);

  const minRawOff = Math.ceil(ambushDef * 0.80);
  const safeOff = minRawOff + 100;

  const raceName = race.charAt(0).toUpperCase() + race.slice(1);

  const embed = new EmbedBuilder()
    .setTitle(`⚡ Ambush Calculator — ${raceName}`)
    .addFields(
      {
        name: "🛡️ Ambush Defense",
        value: [
          `Elites: **${elites.toLocaleString()}** × ${units.eliteDef} = **${(elites * units.eliteDef).toLocaleString()}**`,
          `Off Specs: **${offspecs.toLocaleString()}** × ${units.defSpecDef} = **${(offspecs * units.defSpecDef).toLocaleString()}**`,
          `Soldiers: **${soldiers.toLocaleString()}** × ${units.soldierOff} = **${(soldiers * units.soldierOff).toLocaleString()}**`,
          `\n**Total Ambush Defense: ${ambushDef.toLocaleString()}**`
        ].join("\n")
      },
      {
        name: "⚔️ Required Offense",
        value: [
          `80% minimum: **${minRawOff.toLocaleString()}**`,
          `+100 buffer: **${safeOff.toLocaleString()}**`
        ].join("\n")
      }
    )
    .setFooter({ text: kd.footer });

  return interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
};
