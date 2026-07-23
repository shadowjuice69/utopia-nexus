const { EmbedBuilder } = require("discord.js");

const RACE_WPA_MODS = {
  avian:    { off: 1.0,  def: 1.0,  name: "Avian" },
  darkelf:  { off: 1.30, def: 1.0,  name: "Dark Elf" },
  dryad:    { off: 1.0,  def: 1.0,  name: "Dryad" },
  dwarf:    { off: 1.0,  def: 1.0,  name: "Dwarf" },
  elf:      { off: 1.40, def: 1.0,  name: "Elf" },
  faery:    { off: 1.20, def: 1.20, name: "Faery" },
  halfling: { off: 1.0,  def: 1.0,  name: "Halfling" },
  human:    { off: 1.0,  def: 1.0,  name: "Human" },
  orc:      { off: 1.0,  def: 1.0,  name: "Orc" },
  undead:   { off: 1.0,  def: 1.0,  name: "Undead" },
};

const PERS_WPA_MODS = {
  none:        { off: 1.0,  name: "None" },
  heretic:     { off: 1.35, name: "Heretic" },
  mystic:      { off: 1.25, name: "Mystic" },
  necromancer: { off: 1.25, name: "Necromancer" },
  cleric:      { off: 1.0,  name: "Cleric" },
  general:     { off: 1.0,  name: "General" },
  artisan:     { off: 1.0,  name: "Artisan" },
  rogue:       { off: 1.0,  name: "Rogue" },
  sage:        { off: 1.0,  name: "Sage" },
  tactician:   { off: 1.0,  name: "Tactician" },
  warrior:     { off: 1.0,  name: "Warrior" },
  warhero:     { off: 1.0,  name: "War Hero" },
};

const SPELL_DIFFICULTY = {
  fireball:      { tier: "standard", mult: 2.0, name: "Fireball" },
  storms:        { tier: "standard", mult: 2.0, name: "Storms" },
  droughts:      { tier: "standard", mult: 2.0, name: "Droughts" },
  gluttony:      { tier: "standard", mult: 2.0, name: "Gluttony" },
  greed:         { tier: "standard", mult: 2.0, name: "Greed" },
  chastity:      { tier: "standard", mult: 2.0, name: "Chastity" },
  sloth:         { tier: "standard", mult: 2.0, name: "Sloth" },
  blizzard:      { tier: "standard", mult: 2.0, name: "Blizzard" },
  pitfalls:      { tier: "standard", mult: 2.0, name: "Pitfalls" },
  exposethieves: { tier: "standard", mult: 2.0, name: "Expose Thieves" },
  abolishritual: { tier: "standard", mult: 2.0, name: "Abolish Ritual" },
  magicward:     { tier: "standard", mult: 2.0, name: "Magic Ward" },
  tornadoes:     { tier: "hard", mult: 3.0, name: "Tornadoes" },
  mysticvortex:  { tier: "hard", mult: 3.0, name: "Mystic Vortex" },
  nightmares:    { tier: "hard", mult: 3.0, name: "Nightmares" },
  lightningst:   { tier: "hard", mult: 3.0, name: "Lightning Strike" },
  foolsgold:     { tier: "hard", mult: 3.0, name: "Fools Gold" },
  landlust:      { tier: "hard", mult: 3.0, name: "Land Lust" },
  meteor:        { tier: "mystic", mult: 4.5, name: "Meteor Showers" },
  nightfall:     { tier: "mystic", mult: 4.5, name: "Nightfall" },
};

module.exports = async function spellcheckHandler(interaction) {
  const myWizards = interaction.options.getInteger("my_wizards");
  const myLand    = interaction.options.getInteger("my_land");
  const myRace    = interaction.options.getString("my_race").toLowerCase();
  const myPers    = interaction.options.getString("my_personality")?.toLowerCase() || "none";
  const myScience = interaction.options.getNumber("my_channeling") || 1.0;
  const myHonor   = interaction.options.getNumber("my_honor_mod") || 1.0;
  const myMagesFury = interaction.options.getBoolean("mages_fury") || false;
  const theirWizards = interaction.options.getInteger("their_wizards");
  const theirLand    = interaction.options.getInteger("their_land");
  const theirRace    = interaction.options.getString("their_race")?.toLowerCase() || "avian";
  const theirMagicShield = interaction.options.getBoolean("their_magic_shield") || false;
  const myNW    = interaction.options.getInteger("my_nw") || 0;
  const theirNW = interaction.options.getInteger("their_nw") || 0;
  const spell = interaction.options.getString("spell")?.toLowerCase().replace(/\s/g,"") || null;

  const myRaceMod    = RACE_WPA_MODS[myRace]    || { off: 1.0, name: myRace };
  const myPersMod    = PERS_WPA_MODS[myPers]    || { off: 1.0, name: myPers };
  const theirRaceMod = RACE_WPA_MODS[theirRace] || { def: 1.0, name: theirRace };

  const myRawWPA    = myWizards / myLand;
  const theirRawWPA = theirWizards / theirLand;
  const magesFuryMod   = myMagesFury ? 1.25 : 1.0;
  const magicShieldMod = theirMagicShield ? 1.20 : 1.0;
  const myModWPA    = myRawWPA * myScience * myRaceMod.off * myPersMod.off * myHonor * magesFuryMod;
  const theirModWPA = theirRawWPA * 1.0 * theirRaceMod.def * magicShieldMod;
  const ratio = theirModWPA > 0 ? myModWPA / theirModWPA : 999;

  let nwWarning = "";
  if (myNW > 0 && theirNW > 0) {
    const nwRatio = myNW / theirNW;
    if (nwRatio > 2.0)      nwWarning = "⛔ Your NW is 2x+ their NW — significant auto-fail penalty";
    else if (nwRatio > 1.5) nwWarning = "⚠️ Your NW is 1.5x their NW — moderate auto-fail penalty";
    else if (nwRatio < 0.5) nwWarning = "✅ You are much smaller — NW favors your success";
  }

  let rating, ratingColor, ratingEmoji;
  if (ratio >= 4.5)      { rating = "EXCELLENT"; ratingColor = 0x22c55e; ratingEmoji = "🟢"; }
  else if (ratio >= 3.0) { rating = "STRONG";    ratingColor = 0x4ade80; ratingEmoji = "🟢"; }
  else if (ratio >= 2.0) { rating = "DECENT";    ratingColor = 0xfacc15; ratingEmoji = "🟡"; }
  else if (ratio >= 1.0) { rating = "WEAK";      ratingColor = 0xfb923c; ratingEmoji = "🟠"; }
  else                   { rating = "VERY WEAK"; ratingColor = 0xef4444; ratingEmoji = "🔴"; }

  let spellAdvice = "";
  if (spell && SPELL_DIFFICULTY[spell]) {
    const s = SPELL_DIFFICULTY[spell];
    const pct = Math.round((myModWPA / (theirModWPA * s.mult)) * 100);
    spellAdvice = `\n**${s.name}** (${s.tier} — needs ~${s.mult}x mod WPA)\nYou have ${pct}% of needed — ${pct >= 100 ? "✅ Good chance" : pct >= 75 ? "⚠️ Risky" : "❌ Likely fail"}`;
  }

  const embed = new EmbedBuilder()
    .setTitle("🔮 Spellcheck Calculator")
    .setColor(ratingColor)
    .addFields(
      {
        name: "🧙 Your WPA",
        value: [
          `Wizards: **${myWizards.toLocaleString()}** ÷ Land: **${myLand.toLocaleString()}**`,
          `Raw WPA: **${myRawWPA.toFixed(3)}**`,
          `× Race (${myRaceMod.name}): **${myRaceMod.off}x**`,
          `× Personality (${myPersMod.name}): **${myPersMod.off}x**`,
          `× Channeling Science: **${myScience}x**`,
          `× Honor Mod: **${myHonor}x**`,
          `× Mage's Fury: **${magesFuryMod}x**`,
          `\n**Your Mod WPA: ${myModWPA.toFixed(3)}**`,
        ].join("\n"),
        inline: false
      },
      {
        name: "🛡️ Their WPA",
        value: [
          `Wizards: **${theirWizards.toLocaleString()}** ÷ Land: **${theirLand.toLocaleString()}**`,
          `Raw WPA: **${theirRawWPA.toFixed(3)}**`,
          `× Race (${theirRaceMod.name}): **${theirRaceMod.def}x**`,
          `× Magic Shield: **${magicShieldMod}x**`,
          `\n**Their Mod WPA: ${theirModWPA.toFixed(3)}**`,
        ].join("\n"),
        inline: false
      },
      {
        name: "📊 Result",
        value: [
          `Ratio: **${ratio.toFixed(2)}x**`,
          `Rating: ${ratingEmoji} **${rating}**`,
          ``,
          `2x = Decent on standard spells`,
          `3x = Strong on standard spells`,
          `4-5x = Decent on mystic spells`,
          nwWarning || "",
          spellAdvice || "",
        ].filter(Boolean).join("\n"),
        inline: false
      }
    )
    .setFooter({ text: "Judo Kingdom (4:9) • WoL Age 116 • Utopia Nexus" });

  return interaction.reply({ embeds: [embed], ephemeral: true });
};
