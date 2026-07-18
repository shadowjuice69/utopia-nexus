const supabaseService = require("../../services/supabase");

// Races that give better gains (Elf/Faery bonuses)
const HIGH_GAIN_RACES = ["elf", "faery", "halfling", "dryad"];
const LOW_GAIN_RACES = ["undead", "orc"];

function parseNW(nw) {
  if (!nw) return 0;
  return parseFloat(nw.toString().replace(/,/g, "")) || 0;
}

function scoreTarget(province, myNW) {
  let score = 0;
  const nw = parseNW(province.nw);
  const acres = parseNW(province.acres);
  const def = parseNW(province.def);
  const off = parseNW(province.off);
  const race = (province.race || province.combo || "").toLowerCase();

  // NW ratio score (prefer 90-105% targets)
  const nwRatio = myNW > 0 ? nw / myNW : 0;
  if (nwRatio >= 0.9 && nwRatio <= 1.05) score += 30;
  else if (nwRatio >= 0.75 && nwRatio <= 1.1) score += 15;

  // Acres score (more acres = better gains)
  if (acres > 2500) score += 25;
  else if (acres > 2000) score += 18;
  else if (acres > 1500) score += 10;

  // Race bonus
  if (HIGH_GAIN_RACES.some(r => race.includes(r))) score += 20;
  if (LOW_GAIN_RACES.some(r => race.includes(r))) score -= 10;

  // Defense score (low def = easier target)
  if (def > 0 && off > 0) {
    if (def < off * 0.3) score += 20;
    else if (def < off * 0.5) score += 10;
    else if (def > off) score -= 15;
  }

  // Intel freshness (older intel = lower score)
  if (province.updated_at) {
    const ageDays = (Date.now() - new Date(province.updated_at)) / (1000 * 60 * 60 * 24);
    if (ageDays > 7) score -= 20;
    else if (ageDays > 3) score -= 10;
  }

  return score;
}

function gradeScore(score) {
  if (score >= 70) return "🟢 S";
  if (score >= 50) return "🟢 A";
  if (score >= 30) return "🟡 B";
  if (score >= 10) return "🟠 C";
  return "🔴 D";
}

module.exports = async function targetHandler(interaction) {
  const supabase = supabaseService.getClient();
  if (!supabase) return interaction.reply({ content: "❌ Database not connected.", ephemeral: true });

  await interaction.deferReply({ ephemeral: false });

  const provinceName = interaction.options.getString("province");

  // If specific province requested, show its full intel
  if (provinceName) {
    const { data } = await supabase
      .from("provinces")
      .select("*")
      .ilike("name", `%${provinceName}%`)
      .limit(1);

    if (!data || data.length === 0) {
      return interaction.editReply(`❌ No intel found for **${provinceName}**`);
    }

    const p = data[0];
    const nw = parseNW(p.nw);

    // Get my NW for comparison
    const { data: me } = await supabase
      .from("provinces")
      .select("nw")
      .eq("user_id", interaction.user.id)
      .limit(1);

    const myNW = me?.[0] ? parseNW(me[0].nw) : 0;
    const score = scoreTarget(p, myNW);
    const grade = gradeScore(score);

    const lines = [
      `🎯 **${p.name}** — ${p.combo || p.race || "Unknown"}`,
      `${grade} Target Score: ${score}`,
      ``,
      `📊 **Stats:**`,
      p.nw ? `• NW: ${p.nw}${myNW ? ` (${Math.round((nw/myNW)*100)}% of yours)` : ""}` : "",
      p.acres ? `• Acres: ${p.acres}` : "",
      p.off ? `• Offense: ${p.off}` : "",
      p.def ? `• Defense: ${p.def}` : "",
      p.be ? `• BE: ${p.be}%` : "",
      p.wages ? `• Wages: ${p.wages}%` : "",
      p.o_tpa ? `• oTPA: ${p.o_tpa} | dTPA: ${p.d_tpa}` : "",
      p.o_wpa ? `• oWPA: ${p.o_wpa} | dWPA: ${p.d_wpa}` : "",
      p.good_spells ? `✨ Spells: ${p.good_spells}` : "",
      p.bad_spells ? `💀 Enemy Spells: ${p.bad_spells}` : "",
      p.map ? `🗺️ MAP: ${p.map}` : "",
      p.notes ? `📝 Notes: ${p.notes}` : "",
      ``,
      `🕐 Intel age: ${p.updated_at ? Math.round((Date.now() - new Date(p.updated_at)) / (1000*60*60*24)) + " days" : "Unknown"}`,
    ].filter(Boolean).join("\n");

    return interaction.editReply(lines.slice(0, 1900));
  }

  // No province specified — show top targets
  const { data: me } = await supabase
    .from("provinces")
    .select("nw")
    .eq("user_id", interaction.user.id)
    .limit(1);

  const myNW = me?.[0] ? parseNW(me[0].nw) : 0;

  const { data: provinces } = await supabase
    .from("provinces")
    .select("name, race, combo, nw, acres, off, def, be, updated_at")
    .not("nw", "is", null);

  if (!provinces || provinces.length === 0) {
    return interaction.editReply("❌ No province intel in database yet. Submit thrones to build the intel list.");
  }

  // Filter to attackable range and score
  const scored = provinces
    .map(p => ({ ...p, score: scoreTarget(p, myNW) }))
    .filter(p => {
      if (!myNW) return true;
      const ratio = parseNW(p.nw) / myNW;
      return ratio >= 0.75 && ratio <= 1.15;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (scored.length === 0) {
    return interaction.editReply("❌ No targets found in your NW range. Update your province NW or submit more thrones.");
  }

  const lines = [
    `🎯 **Top Targets** ${myNW ? `(vs ${myNW.toLocaleString()} NW)` : ""}`,
    ``
  ];

  for (const p of scored) {
    const nw = parseNW(p.nw);
    const ratio = myNW ? `${Math.round((nw/myNW)*100)}%` : "";
    const grade = gradeScore(p.score);
    lines.push(`${grade} **${p.name}** (${p.combo || p.race || "?"}) — ${p.nw} NW ${ratio}`);
    if (p.acres) lines.push(`  📍 ${p.acres} acres${p.def ? ` | Def: ${p.def}` : ""}`);
  }

  lines.push(`\nUse \`/utopia target province:<name>\` for full intel on a specific target.`);

  return interaction.editReply(lines.join("\n").slice(0, 1900));
};
