const supabaseService = require("../../services/supabase");

module.exports = async function targetHandler(interaction) {
  const supabase = supabaseService.getClient();
  if (!supabase) return interaction.reply({ content: "❌ Database not connected.", ephemeral: true });

  await interaction.deferReply({ ephemeral: true });

  const province = interaction.options.getString("province");

  const [throne, military, buildings] = await Promise.all([
    supabase.from("intel_throne").select("*").ilike("province", `%${province}%`).limit(1),
    supabase.from("intel_military").select("*").ilike("province", `%${province}%`).limit(1),
    supabase.from("intel_buildings").select("*").ilike("province", `%${province}%`).limit(1)
  ]);

  const t = throne.data?.[0];
  const m = military.data?.[0];
  const b = buildings.data?.[0];

  if (!t && !m && !b) {
    return interaction.editReply(`❌ No intel found for **${province}**. Send intel via Utopia first.`);
  }

  let msg = `🎯 **Intel: ${province}**\n`;
  if (t?.kd_code) msg += `👑 Kingdom: ${t.kd_code}\n`;

  if (t) {
    msg += `\n**👑 Throne**\n`;
    if (t.race) msg += `  Race: ${t.race} | Personality: ${t.personality || "?"}\n`;
    if (t.land) msg += `  Land: ${t.land} | NW: ${t.networth || "?"}\n`;
    if (t.offense) msg += `  Off: ${t.offense} | Def: ${t.defense || "?"}\n`;
    if (t.be) msg += `  BE: ${t.be}\n`;
    if (t.updated_at) msg += `  📅 Updated: ${new Date(t.updated_at).toLocaleString()}\n`;
  }

  if (m) {
    msg += `\n**⚔️ Military**\n`;
    if (m.offense) msg += `  Off: ${m.offense} | Def: ${m.defense || "?"}\n`;
    if (m.generals) msg += `  Generals: ${m.generals}\n`;
    if (m.updated_at) msg += `  📅 Updated: ${new Date(m.updated_at).toLocaleString()}\n`;
  }

  if (b) {
    msg += `\n**🏗️ Buildings**\n`;
    const buildings_data = b.buildings || {};
    const top = Object.entries(buildings_data).slice(0, 5);
    for (const [name, data] of top) {
      msg += `  ${name}: ${data.count} (${data.pct}%)\n`;
    }
    if (b.updated_at) msg += `  📅 Updated: ${new Date(b.updated_at).toLocaleString()}\n`;
  }

  await interaction.editReply(msg);
};
