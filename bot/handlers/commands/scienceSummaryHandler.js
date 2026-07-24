const { EmbedBuilder } = require("discord.js");
const supabaseService = require("../../services/supabase");

const CATEGORY_EMOJI = {
  economy: '💰', military: '⚔️', arcane_arts: '🔮',
};

// Race science modifiers (multipliers on top of base)
const RACE_SCIENCE_MODS = {
  // None have general science bonuses in Age 116 — individual pers mods handled via DB
};

// Science formula: books^(1/2.125) * multiplier * pers_mod
function calcBonus(books, multiplier, persMod = 1.0) {
  if (!books || books === 0) return 0;
  return Math.pow(books, 1 / 2.125) * multiplier * persMod;
}

// Personality science modifiers per science type
const PERS_SCIENCE_MODS = {
  artisan:     { artisan: 1.25 },
  tactician:   { siege: 1.40 },
  mystic:      { channeling: 1.75 },
  necromancer: { channeling: 1.30 },
  heretic:     { channeling: 1.30, crime: 1.30 },
  rogue:       { crime: 1.50 },
  warhero:     { valor: 1.40 },
};

module.exports = async function scienceSummaryHandler(interaction) {
  const supabase = supabaseService.getClient();
  if (!supabase) return interaction.reply({ content: "❌ Database unavailable.", ephemeral: true });

  // Get target — self or a named province
  const targetProvince = interaction.options.getString("province") || null;

  let provinceName, race, personality;

  if (targetProvince) {
    const { data: prov } = await supabase
      .from("provinces")
      .select("name, race, personality")
      .ilike("name", `%${targetProvince}%`)
      .limit(1);
    if (!prov || prov.length === 0) {
      return interaction.reply({ content: `❌ Province **${targetProvince}** not found.`, ephemeral: true });
    }
    provinceName = prov[0].name;
    race = prov[0].race?.toLowerCase();
    personality = prov[0].personality?.toLowerCase().replace(/\s/g, '');
  } else {
    const { data: prov } = await supabase
      .from("provinces")
      .select("name, race, personality")
      .eq("user_id", interaction.user.id)
      .limit(1);
    if (!prov || prov.length === 0) {
      return interaction.reply({ content: "❌ No province found. Register with `/utopia register` or specify a province name.", ephemeral: true });
    }
    provinceName = prov[0].name;
    race = prov[0].race?.toLowerCase();
    personality = prov[0].personality?.toLowerCase().replace(/\s/g, '');
  }

  // Get science books
  const { data: sciData } = await supabase
    .from("intel_science")
    .select("*")
    .ilike("province", provinceName)
    .limit(1);

  if (!sciData || sciData.length === 0) {
    return interaction.reply({ content: `❌ No science data for **${provinceName}**. Paste their science page via \`/utopia intel\`.`, ephemeral: true });
  }

  const books = sciData[0];

  // Get science rules multipliers
  const { data: rules } = await supabase
    .from("science_rules")
    .select("science_name, category, multiplier, effect")
    .eq("active", true)
    .eq("age_number", 116);

  if (!rules || rules.length === 0) {
    return interaction.reply({ content: "❌ Science rules not found in database.", ephemeral: true });
  }

  // Dedupe rules — one multiplier per science name
  const ruleMap = {};
  for (const r of rules) {
    if (!ruleMap[r.science_name.toLowerCase()]) {
      ruleMap[r.science_name.toLowerCase()] = r;
    }
  }

  const persMods = PERS_SCIENCE_MODS[personality] || {};

  // Build results grouped by category
  const grouped = {};
  const scienceKeys = [
    'alchemy','artisan','bookkeeping','channeling','crime','finesse',
    'heroism','housing','production','resilience','shielding','siege',
    'strategy','tactics','tools','valor','arcana'
  ];

  for (const key of scienceKeys) {
    const bookCount = books[key] || 0;
    const rule = ruleMap[key];
    if (!rule) continue;

    const persMod = persMods[key] || 1.0;
    const bonus = calcBonus(bookCount, parseFloat(rule.multiplier), persMod);
    const bonusPct = (bonus * 100).toFixed(1);
    const cat = rule.category;

    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      name: rule.science_name,
      books: bookCount,
      bonus: bonusPct,
      effect: rule.effect,
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
        const booksStr = s.books > 0 ? s.books.toLocaleString() : '—';
        return `**${s.name}** — \`${s.bonusPct}%\`${persNote} *(${booksStr} books)*`;
      });
    embed.addFields({ name: `${emoji} ${catName}`, value: lines.join('\n'), inline: false });
  }

  return interaction.reply({ embeds: [embed], ephemeral: true });
};
