const { EmbedBuilder } = require("discord.js");
const supabaseService = require("../../services/supabase");

const CATEGORY_EMOJI = {
  economy: '💰', military: '⚔️', arcane_arts: '🔮',
};

const PERS_SCIENCE_MODS = {
  artisan:     { artisan: 1.25 },
  tactician:   { siege: 1.40 },
  mystic:      { channeling: 1.75 },
  necromancer: { channeling: 1.30 },
  heretic:     { channeling: 1.30, crime: 1.30 },
  rogue:       { crime: 1.50 },
  warhero:     { valor: 1.40 },
};

function calcBonus(books, multiplier, persMod = 1.0) {
  if (!books || books === 0 || !multiplier) return 0;
  return Math.pow(books, 0.5556) * parseFloat(multiplier) * persMod;
}

module.exports = async function scienceSummaryHandler(interaction) {
  const supabase = supabaseService.getClient();
  if (!supabase) return interaction.reply({ content: "❌ Database unavailable.", ephemeral: true });

  const targetProvince = interaction.options.getString("province") || null;
  let provinceName, race, personality;

  if (targetProvince) {
    const { data: prov } = await supabase
      .from("provinces").select("name, race, personality")
      .ilike("name", `%${targetProvince}%`).limit(1);
    if (!prov || prov.length === 0)
      return interaction.reply({ content: `❌ Province **${targetProvince}** not found.`, ephemeral: true });
    provinceName = prov[0].name;
    race = prov[0].race?.toLowerCase();
    personality = prov[0].personality?.toLowerCase().replace(/\s/g, '');
  } else {
    const { data: prov } = await supabase
      .from("provinces").select("name, race, personality")
      .eq("user_id", interaction.user.id).limit(1);
    if (!prov || prov.length === 0)
      return interaction.reply({ content: "❌ No province found. Register with `/utopia register` or specify a province name.", ephemeral: true });
    provinceName = prov[0].name;
    race = prov[0].race?.toLowerCase();
    personality = prov[0].personality?.toLowerCase().replace(/\s/g, '');
  }

  const { data: sciData } = await supabase
    .from("intel_science").select("*").ilike("province", provinceName).limit(1);
  if (!sciData || sciData.length === 0)
    return interaction.reply({ content: `❌ No science data for **${provinceName}**. Paste their science page via \`/utopia intel\`.`, ephemeral: true });

  const books = sciData[0];

  // Get ONE row per science name — the one with a valid multiplier
  const { data: rules } = await supabase
    .from("science_rules")
    .select("science_name, category, multiplier, effect")
    .eq("active", true)
    .eq("age_number", 116)
    .not("multiplier", "is", null);

  if (!rules || rules.length === 0)
    return interaction.reply({ content: "❌ Science rules not found.", ephemeral: true });

  // Build map: lowercase name -> first rule with a multiplier
  const ruleMap = {};
  for (const r of rules) {
    const key = r.science_name.toLowerCase();
    if (!ruleMap[key]) ruleMap[key] = r;
  }

  const persMods = PERS_SCIENCE_MODS[personality] || {};
  const scienceKeys = [
    'alchemy','artisan','bookkeeping','channeling','crime','finesse',
    'heroism','housing','production','resilience','shielding','siege',
    'strategy','tactics','tools','valor','arcana'
  ];

  const grouped = {};
  for (const key of scienceKeys) {
    const bookCount = books[key] || 0;
    const rule = ruleMap[key];
    if (!rule) continue;
    const persMod = persMods[key] || 1.0;
    const bonus = calcBonus(bookCount, rule.multiplier, persMod);
    const cat = rule.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      name: rule.science_name,
      books: bookCount,
      bonus: bonus.toFixed(1),
      persMod,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`🔬 Science Summary — ${provinceName}`)
    .setColor(0x6366f1)
    .setDescription(`Race: **${race || 'Unknown'}** | Personality: **${personality || 'None'}** | Updated: <t:${Math.floor(new Date(books.updated_at).getTime()/1000)}:R>`)
    .setFooter({ text: "Judo Kingdom (4:9) • WoL Age 116 • Utopia Nexus" });

  for (const [cat, sciences] of Object.entries(grouped)) {
    const emoji = CATEGORY_EMOJI[cat] || '📊';
    const catName = cat.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    const lines = sciences
      .sort((a, b) => b.books - a.books)
      .map(s => {
        const persNote = s.persMod > 1.0 ? ` *(×${s.persMod} pers)*` : '';
        return `**${s.name}** — \`${s.bonus}%\`${persNote} *(${s.books > 0 ? s.books.toLocaleString() : '—'} books)*`;
      });
    embed.addFields({ name: `${emoji} ${catName}`, value: lines.join('\n'), inline: false });
  }

  return interaction.reply({ embeds: [embed], ephemeral: true });
};
