const database = require("../services/database");
const supabaseService = require("../services/supabase");
const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { parseThrone, parseMilitary, summarizeIntel } = require("../parsers/throneParser");

module.exports = async function modalHandler(interaction) {

  const db = database.getDb();
  const supabase = supabaseService.getClient();

  if (interaction.customId === "utopia_register_1") {
    const user = db.get("users").value()?.find(u => u.id === interaction.user.id);
    if (!user) {
      return interaction.reply({
        content: "❌ You need a profile first. Use /utopia register.",
        flags: MessageFlags.Ephemeral,
      });
    }

    user.province = interaction.fields.getTextInputValue("province");
    user.coordinates = interaction.fields.getTextInputValue("coordinates");
    user._reg_race = interaction.fields.getTextInputValue("race");
    user._reg_personality = interaction.fields.getTextInputValue("personality");
    user._reg_play_role = interaction.fields.getTextInputValue("play_role");
    await db.write();

    const button = new ButtonBuilder()
      .setCustomId("continue_registration")
      .setLabel("Continue Registration")
      .setStyle(ButtonStyle.Primary);

    return interaction.reply({
      content: "✅ Step 1 complete. Click below to continue.",
      components: [new ActionRowBuilder().addComponents(button)],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (interaction.customId === "utopia_register_2") {
    const user = db.get("users").value()?.find(u => u.id === interaction.user.id);
    if (!user) {
      return interaction.reply({
        content: "❌ Registration session expired. Please start again.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const timezone = interaction.fields.getTextInputValue("timezone");
    const waveTimes = interaction.fields.getTextInputValue("wave_times");
    user.timezone = timezone;
    user.wave_times = waveTimes;
    await db.write();

    if (supabase) {
      const { error } = await supabase
        .from("provinces")
        .upsert({
          user_id: interaction.user.id,
          name: user.province,
          coordinates: user.coordinates,
          race: user._reg_race,
          personality: user._reg_personality,
          play_role: user._reg_play_role,
          timezone,
          wave_times: waveTimes,
          discord_id: interaction.user.id,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });

      if (error) console.error("[REGISTER SUPABASE ERROR]", error.message);
    }

    return interaction.reply({
      content:
        `✅ **Registration Complete!**\n\n` +
        `🏰 Province: ${user.province}\n` +
        `📍 Coordinates: ${user.coordinates}\n` +
        `⚔️ Race: ${user._reg_race}\n` +
        `🧠 Personality: ${user._reg_personality}\n` +
        `🎯 Role: ${user._reg_play_role}\n` +
        `🕐 Timezone: ${timezone}\n` +
        `⏰ Best Wave Times: ${waveTimes}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  // Intel paste handler
  if (interaction.customId === "intel_paste") {
    await interaction.deferReply({ ephemeral: true });

    const text = interaction.fields.getTextInputValue("intel_text");
    
    console.log("[INTEL RAW]", JSON.stringify(text.slice(0, 500)));
    const parsed = parseThrone(text);

    // Save throne intel snapshot
    if (supabase && parsed.name) {
      const { error } = await supabase
        .from("intel_throne")
        .upsert({
          province: parsed.name,
          kd_code: parsed.coordinates || "unknown",
          race: parsed.race,
          ruler: parsed.ruler,
          land: parsed.acres,
          networth: parsed.nw,
          honor: parsed.honor,
          offense: parsed.off,
          defense: parsed.def,
          be: parsed.be,
          peasants: parsed.peons,
          troops: {
            soldiers: parsed.soldiers,
            off_specs: parsed.off_specs,
            def_specs: parsed.def_specs,
            elites: parsed.elites,
            thieves: parsed.thieves,
            wizards: parsed.wizards,
            war_horses: parsed.war_horses,
            prisoners: parsed.prisoners
          },
          spells: parsed.good_spells,
          updated_at: new Date().toISOString()
        }, { onConflict: "province,kd_code" });

      if (error) {
        console.error("[THRONE INTEL SAVE ERROR]", error.message);
      } else {
        console.log("[THRONE INTEL SAVED]", parsed.name);
      }
    }

    // Look up province by ruler name if name not parsed
    if (!parsed.name && parsed.ruler && supabase) {
      const { data: byRuler } = await supabase.from("provinces").select("name").ilike("ruler", parsed.ruler).limit(1);
      if (byRuler?.[0]) parsed.name = byRuler[0].name;
    }
    if (!parsed.name && !parsed.nw && !parsed.acres && !parsed.off && !parsed.def && !parsed.off_specs && !parsed.def_specs && !parsed.science) {
      return interaction.editReply("❌ Could not parse intel from that text. Make sure you're pasting a throne or military page.");
    }

    // Try to find existing province or create new one
    if (supabase && parsed.name) {
      const { data: existing } = await supabase
        .from("provinces")
        .select("id, name")
        .ilike("name", parsed.name)
        .limit(1);

      const updateData = {
        name: parsed.name,
        updated_at: new Date().toISOString(),
        intel_age: "0",
      };

      // Only update fields that were parsed
      if (parsed.combo) updateData.combo = parsed.combo;
      if (parsed.race) updateData.race = parsed.race;
      if (parsed.nw) updateData.nw = parsed.nw;
      if (parsed.acres) updateData.acres = parsed.acres;
      if (parsed.off) updateData.off = parsed.off;
      if (parsed.def) updateData.def = parsed.def;
      if (parsed.be) updateData.be = parsed.be;
      if (parsed.wages) updateData.wages = parsed.wages;
      if (parsed.stlth) updateData.stlth = parsed.stlth;
      if (parsed.mana) updateData.mana = parsed.mana;
      if (parsed.peons) updateData.peons = parsed.peons;
      if (parsed.honor) updateData.honor = parsed.honor;
      if (parsed.o_tpa) updateData.o_tpa = parsed.o_tpa;
      if (parsed.d_tpa) updateData.d_tpa = parsed.d_tpa;
      if (parsed.o_wpa) updateData.o_wpa = parsed.o_wpa;
      if (parsed.d_wpa) updateData.d_wpa = parsed.d_wpa;
      if (parsed.pop_pct) updateData.pop_pct = parsed.pop_pct;
      if (parsed.good_spells) updateData.good_spells = parsed.good_spells;
      if (parsed.map) updateData.map = parsed.map;
      if (parsed.coordinates) updateData.coordinates = parsed.coordinates;
      if (parsed.kingdom) updateData.kingdom_name = parsed.kingdom;
      if (parsed.soldiers) updateData.soldiers = parsed.soldiers;
      if (parsed.off_specs) updateData.off_specs = parsed.off_specs;
      if (parsed.def_specs) updateData.def_specs = parsed.def_specs;
      if (parsed.elites) updateData.elites = parsed.elites;
      if (parsed.thieves) updateData.thieves = parsed.thieves;
      if (parsed.wizards) updateData.wizards = parsed.wizards;
      if (parsed.war_horses) updateData.war_horses = parsed.war_horses;
      if (parsed.prisoners) updateData.prisoners = parsed.prisoners;
      if (parsed.ruler) updateData.ruler = parsed.ruler;
      if (parsed.game_type) updateData.game_type = parsed.game_type;
      if (parsed.science) updateData.science = parsed.science;
      if (parsed.ome) updateData.ome = parsed.ome;
      if (parsed.dme) updateData.dme = parsed.dme;

      let error;
      if (existing && existing.length > 0) {
        const result = await supabase
          .from("provinces")
          .update(updateData)
          .eq("id", existing[0].id);
        error = result.error;
      } else {
        // Intel paste - no user_id to avoid conflicts with registered provinces
        const result = await supabase
          .from("provinces")
          .insert(updateData);
        error = result.error;
      }

      if (error) {
        console.error("[INTEL SAVE ERROR]", error.message);
        return interaction.editReply(`❌ Failed to save intel: ${error.message}`);
      }
    }

    const summary = summarizeIntel(parsed);
    const fields = Object.entries(parsed)
      .filter(([k, v]) => v && !["name", "combo", "kingdom"].includes(k))
      .map(([k, v]) => `• **${k}:** ${v}`)
      .join('\n');

    return interaction.editReply(
      `✅ **Intel saved for ${parsed.name || "Unknown"}**\n\n${summary}\n\n${fields}`.slice(0, 1900)
    );
  }

  // Broadcast modal handler
  if (interaction.customId === "broadcast_modal") {
    await interaction.deferReply({ ephemeral: true });

    const title = interaction.fields.getTextInputValue("broadcast_title") || "📢 Kingdom Broadcast";
    const message = interaction.fields.getTextInputValue("broadcast_message");

    const { data: provinces } = await supabase
      .from("provinces")
      .select("discord_id, name")
      .not("discord_id", "is", null);

    if (!provinces || provinces.length === 0) {
      return interaction.editReply("❌ No registered members found.");
    }

    let sent = 0;
    let failed = 0;

    for (const p of provinces) {
      try {
        const user = await interaction.client.users.fetch(p.discord_id);
        await user.send([
          `🏰 **${title}**`,
          `From: ${interaction.user.username} (Judo 4:9)`,
          ``,
          message
        ].join("\n"));
        sent++;
      } catch (e) {
        failed++;
      }
    }

    return interaction.editReply(
      `✅ Broadcast sent to **${sent}** members${failed > 0 ? ` (${failed} failed — DMs may be closed)` : ""}.`
    );
  }
};
