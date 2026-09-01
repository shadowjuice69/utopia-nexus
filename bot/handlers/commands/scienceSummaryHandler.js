const { EmbedBuilder } = require("discord.js");
const { getKingdomInfo } = require("../../services/kingdomService");
const supabaseService = require("../../services/supabase");

const CATEGORY_EMOJI = {
  economy: '💰', military: '⚔️', arcane_arts: '🔮',
};

// Personality science modifiers. These are formula modifiers, not age/kingdom selection.
const PERS_SCIENCE_MODS = {
  artisan:     { artisan: 1.25, _all: 1.0 },
  tactician:   { siege: 1.40,   _all: 1.0 },
  mystic:      { channeling: 1.75, _all: 1.0 },
  necromancer: { channeling: 1.30, _all: 1.0 },
  heretic:     { channeling: 1.30, crime: 1.30, _all: 1.0 },
  rogue:       { crime: 1.50,   _all: 1.0 },
  warhero:     { valor: 1.40,   _all: 1.0 },
  sage:        { _all: 1.15 },
  cleric:      { _all: 1.0 },
  general:     { _all: 1.0 },
  warrior:     { _all: 1.0 },
};

const RACE_SCIENCE_MODS = {
  undead: 0.90,
};

function calcBonus(books, multiplier, persMod = 1.0, allMod = 1.0, raceMod = 1.0) {
  if (!books || books === 0 || !multiplier) return 0;
  return Math.pow(books, 1 / 2.125) * parseFloat(multiplier) * persMod * allMod * raceMod;
}

module.exports = async function scienceSummaryHandler(interaction) {
  const kd = await getKingdomInfo();
  const supabase = supabaseService.getClient();
  if (!supabase) return interaction.reply({ content: "❌ Database unavailable.", ephemeral: true });

  const targetProvince = interaction.options.getString("province") || null;
  const librariesPct  = interaction.options.getNumber("libraries") || 0;
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
      return interaction.reply({ content: "❌ No province found. Register with `/utopia register` or specify a province.", ephemeral: true });
    provinceName = prov[0].name;
    race = prov[0].race?.toLowerCase();
    personality = prov[0].personality?.toLowerCase().replace(/\s/g, '');
  }

  const { data: sciData } = await supabase
    .from("intel_science").select("*").ilike("province", provinceName).limit(1);
  if (!sciData || sciData.length === 0)
    return interaction.reply({ content: `❌ No science data for **${provinceName}**. Paste their science page via \`/utopia intel\`.`, ephemeral: true });

  const books = sciData[0];

  // Current kingdom and age are runtime configuration. Never hard-code an age here.
  const { data: settings } = await supabase
    .from("bot_settings")
    .select("key, value")
    .in("key", ["current_age", "kingdom_code"]);

  const settingsMap = Object.fromEntries((settings || []).map(s => [s.key, s.value]));
  const currentAge = Number.parseInt(settingsMap.current_age, 10);
  const kingdomCode = settingsMap.kingdom_code?.trim();

  if (!Number.isInteger(currentAge) || currentAge <= 0)
    return interaction.reply({ content: "❌ Current age is not configured in Nexus.", ephemeral: true });
  if (!kingdomCode)
    return interaction.reply({ content: "❌ Kingdom code is not configured in Nexus.", ephemeral: true });

  const { data: rules, error: rulesError } = await supabase
    .from("science_rules")
    .select("science_name, category, multiplier, effect, kd_code, age_number")
    .eq("active", true)
    .eq("kd_code", kingdomCode)
    .eq("age_number", currentAge)
    .not("multiplier", "is", null);

  if (rulesError) {
    console.error(`[SCIENCE RULES] ${rulesError.message}`);
    return interaction.reply({ content: "❌ Unable to load science rules.", ephemeral: true });
  }

  if (!rules || rules.length === 0)
    return interaction.reply({
      content: `❌ No science rules configured for **${kingdomCode}**, Age **${currentAge}**. Add the new age's kingdom-specific science weights before using the calculator.`,
      ephemeral: true
    });

  const ruleMap = {};
  for (const r of rules) {
    const key = r.science_name.toLowerCase();
    if (!ruleMap[key]) ruleMap[key] = r;
  }

  const persMods = PERS_SCIENCE_MODS[personality] || { _all: 1.0 };
  const allMod   = (persMods._all || 1.0) * (1 + librariesPct / 100);
  const raceMod  = RACE_SCIENCE_MODS[race] ?? 1.0;

  const scienceKeys = [
    'alchemy','artisan','bookkeeping','channeling','crime','cunning',
    'finesse','heroism','housing','production','resilience','shielding',
    'siege','sorcery','strategy','tactics','tools','valor','arcana'
  ];

  const grouped = {};
  for (const key of scienceKeys) {
    const bookCount = books[key] || 0;
    const rule = ruleMap[key];
    if (!rule) continue;
    const persMod = persMods[key] || 1.0;
    // Use game's own effect % if available, otherwise calculate from the active
    // kingdom/age science multiplier plus the formula modifiers.
    const effects = books.science_effects || {};
    const gameEffect = effects[key];
    const bonusStr = gameEffect
      ? gameEffect.replace('%', '')
      : calcBonus(bookCount, rule.multiplier, persMod, allMod, raceMod).toFixed(1);
    const cat = rule.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      name: rule.science_name,
      books: bookCount,
      bonus: bonusStr,
      persMod,
      allMod,
      fromGame: !!gameEffect,
    });
  }

  const libNote = librariesPct > 0 ? ` · Libraries: ${librariesPct}%` : '';
  const embed = new EmbedBuilder()
    .setTitle(`🔬 Science Summary — ${provinceName}`)
    .setColor(0x6366f1)
    .setDescription(`Kingdom: **${kingdomCode}** | Age: **${currentAge}** | Race: **${race || 'Unknown'}** | Personality: **${personality || 'None'}**${libNote} | Updated: <t:${Math.floor(new Date(books.updated_at).getTime()/1000)}:R>`)
    .setFooter({ text: kd.footer });

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
