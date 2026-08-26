const { EmbedBuilder } = require("discord.js");

const RACE_TPA = {
  avian:    { off: 1.0,  def: 1.0,  name: "Avian"    },
  darkelf:  { off: 1.0,  def: 1.0,  name: "Dark Elf" },
  dryad:    { off: 1.0,  def: 1.0,  name: "Dryad"    },
  dwarf:    { off: 1.0,  def: 1.0,  name: "Dwarf"    },
  elf:      { off: 1.0,  def: 1.0,  name: "Elf"      },
  faery:    { off: 1.20, def: 1.0,  name: "Faery"    },
  halfling: { off: 1.30, def: 1.0,  name: "Halfling" },
  human:    { off: 1.0,  def: 1.0,  name: "Human"    },
  orc:      { off: 1.0,  def: 1.0,  name: "Orc"      },
  undead:   { off: 1.0,  def: 1.0,  name: "Undead"   },
};

const PERS_TPA = {
  none:        { off: 1.0,  name: "None"        },
  heretic:     { off: 1.35, name: "Heretic"     },
  mystic:      { off: 1.0,  name: "Mystic"      },
  necromancer: { off: 1.0,  name: "Necromancer" },
  cleric:      { off: 1.0,  name: "Cleric"      },
  general:     { off: 1.0,  name: "General"     },
  artisan:     { off: 1.0,  name: "Artisan"     },
  rogue:       { off: 1.25, name: "Rogue"       },
  sage:        { off: 1.0,  name: "Sage"        },
  tactician:   { off: 1.0,  name: "Tactician"   },
  warrior:     { off: 1.0,  name: "Warrior"     },
  warhero:     { off: 1.0,  name: "War Hero"    },
};

// Thieves Dens: +3% TPA per 10% dens (max 30% at 100% dens)
function densTpaBonus(densPct) {
  return 1 + Math.min(densPct / 100, 1) * 0.30;
}

// Watch Towers: +X% defensive TPA per % (approx 0.5% per 1% towers, cap check)
function watchtowerDefBonus(wtPct) {
  return 1 + Math.min(wtPct / 100, 1) * 0.50;
}

function getRating(ratio) {
  if (ratio >= 4)   return { label: "VERY STRONG", color: 0x22c55e, emoji: "🟢" };
  if (ratio >= 3)   return { label: "STRONG",      color: 0x4ade80, emoji: "🟢" };
  if (ratio >= 2)   return { label: "DECENT",      color: 0xfacc15, emoji: "🟡" };
  if (ratio >= 1.5) return { label: "RISKY",       color: 0xfb923c, emoji: "🟠" };
  return               { label: "POOR",         color: 0xef4444, emoji: "🔴" };
}

module.exports = async function thieveryHandler(interaction) {
  try {
    const myThieves    = interaction.options.getInteger("my_thieves",    true);
    const myLand       = interaction.options.getInteger("my_land",       true);
    const myRaceKey    = interaction.options.getString("my_race",        true).toLowerCase();
    const theirThieves = interaction.options.getInteger("their_thieves", true);
    const theirLand    = interaction.options.getInteger("their_land",    true);
    const theirRaceKey = interaction.options.getString("their_race")?.toLowerCase() || "avian";
    const myPersKey    = interaction.options.getString("my_personality")?.toLowerCase() || "none";
    const myScience    = interaction.options.getNumber("my_crime_science") || 1.0;
    const myHonor      = interaction.options.getNumber("my_honor_mod")     || 1.0;
    const invisibility = interaction.options.getBoolean("invisibility")    || false;
    const myDensPct    = interaction.options.getNumber("my_dens_pct")      || 0;
    const theirDensPct = interaction.options.getNumber("their_dens_pct")   || 0;
    const theirWT      = interaction.options.getNumber("their_watchtowers")|| 0;
    const myNW         = interaction.options.getInteger("my_nw")           || 0;
    const theirNW      = interaction.options.getInteger("their_nw")        || 0;
    const op           = interaction.options.getString("op") || null;

    const myRace    = RACE_TPA[myRaceKey]    || { off: 1.0, name: myRaceKey };
    const theirRace = RACE_TPA[theirRaceKey] || { def: 1.0, name: theirRaceKey };
    const myPers    = PERS_TPA[myPersKey]    || { off: 1.0, name: myPersKey };

    const myRawTPA    = myThieves    / myLand;
    const theirRawTPA = theirThieves / theirLand;

    const invisMod   = invisibility ? 1.10 : 1.0;
    const myDensMod  = densTpaBonus(myDensPct);
    const theirDensMod = densTpaBonus(theirDensPct);
    const theirWTMod = watchtowerDefBonus(theirWT);

    // Mod TPA = Raw TPA × Invisibility × Crime Science × Race Mod × Dens Bonus × Honor Bonus
    const myModTPA    = myRawTPA    * invisMod * myScience * myRace.off * myPers.off * myDensMod * myHonor;
    // Defensive Mod TPA = Raw TPA × Race Mod × Dens Bonus × Watchtowers
    const theirModTPA = theirRawTPA * (theirRace.def || 1.0) * theirDensMod * theirWTMod;

    const ratio = theirModTPA > 0 ? myModTPA / theirModTPA : 999;
    const rating = getRating(ratio);

    let nwWarning = "";
    if (myNW > 0 && theirNW > 0) {
      const nwRatio = myNW / theirNW;
      if (nwRatio > 2.0)      nwWarning = "⛔ Your NW is 2x+ their NW — significant auto-fail penalty";
      else if (nwRatio > 1.5) nwWarning = "⚠️ Your NW is 1.5x their NW — moderate auto-fail penalty";
      else if (nwRatio < 0.5) nwWarning = "✅ You are much smaller — NW favors your success";
    }

    // Recommended thieves to send (aim for 2x ratio)
    const targetRatio = 2.0;
    const neededModTPA = theirModTPA * targetRatio;
    const neededRawTPA = neededModTPA / (invisMod * myScience * myRace.off * myPers.off * myDensMod * myHonor);
    const recommendedThieves = Math.ceil(neededRawTPA * myLand);

    const embed = new EmbedBuilder()
      .setTitle("🕵️ Thievery Calculator")
      .setColor(rating.color)
      .addFields(
        {
          name: "🗡️ Your TPA",
          value: [
            `Thieves: **${myThieves.toLocaleString()}** ÷ Land: **${myLand.toLocaleString()}**`,
            `Raw TPA: **${myRawTPA.toFixed(3)}**`,
            `× Race (${myRace.name}): **${myRace.off}x**`,
            `× Personality (${myPers.name}): **${myPers.off}x**`,
            `× Crime Science: **${myScience}x**`,
            `× Honor Mod: **${myHonor}x**`,
            `× Invisibility: **${invisMod}x**`,
            `× Dens Bonus: **${myDensMod.toFixed(3)}x**`,
            `\n**Your Mod TPA: ${myModTPA.toFixed(3)}**`,
          ].join("\n"),
          inline: false
        },
        {
          name: "🛡️ Their TPA",
          value: [
            `Thieves: **${theirThieves.toLocaleString()}** ÷ Land: **${theirLand.toLocaleString()}**`,
            `Raw TPA: **${theirRawTPA.toFixed(3)}**`,
            `× Race (${theirRace.name}): **${theirRace.def || 1.0}x**`,
            `× Dens Bonus: **${theirDensMod.toFixed(3)}x**`,
            `× Watch Towers: **${theirWTMod.toFixed(3)}x**`,
            `\n**Their Mod TPA: ${theirModTPA.toFixed(3)}**`,
          ].join("\n"),
          inline: false
        },
        {
          name: "📊 Result",
          value: [
            `Ratio: **${ratio.toFixed(2)}x** ${rating.emoji} **${rating.label}**`,
            `Recommended Thieves (for 2x): **${recommendedThieves.toLocaleString()}**`,
            nwWarning || "",
          ].filter(Boolean).join("\n"),
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: "Formula: Mod TPA = Raw × Invisibility × Crime × Race × Dens × Honor" });

    await interaction.reply({ embeds: [embed], ephemeral: true });

  } catch (err) {
    console.error("[THIEVERY HANDLER ERROR]", err);
    if (!interaction.replied) {
      await interaction.reply({ content: "❌ Thievery calculation failed.", ephemeral: true });
    }
  }
};
