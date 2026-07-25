const { EmbedBuilder } = require("discord.js");
const wikiService = require("../../services/wikiService");
const supabaseService = require("../../services/supabase");

const MAX_LENGTH = 1900;
function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

async function getKingdomContext(supabase) {
  if (!supabase) return null;
  const lines = [];

  // Provinces
  const { data: provs } = await supabase
    .from("provinces")
    .select("name, race, personality, play_role, coordinates")
    .order("name").limit(30);
  if (provs && provs.length > 0) {
    lines.push(`KINGDOM: Judo (4:9) — ${provs.length} provinces`);
    for (const p of provs) {
      lines.push(`  • ${p.name} — ${p.race || '?'} ${p.personality || ''} (${p.play_role || '?'}) ${p.coordinates || ''}`);
    }
  }

  // Active war
  const { data: wars } = await supabase
    .from("wars")
    .select("enemy_kd, status, started_at")
    .eq("status", "active").limit(1);
  if (wars && wars.length > 0) {
    lines.push(`ACTIVE WAR: vs ${wars[0].enemy_kd} (started ${wars[0].started_at})`);
  }

  // Recent hostile ops (last 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: ops } = await supabase
    .from("hostile_ops")
    .select("op_type, target, caster_kd, timestamp")
    .gte("timestamp", since)
    .order("timestamp", { ascending: false })
    .limit(10);
  if (ops && ops.length > 0) {
    lines.push(`RECENT HOSTILE OPS (24h):`);
    for (const op of ops) {
      lines.push(`  • ${op.op_type} on ${op.target} from ${op.caster_kd}`);
    }
  }

  // Wave schedule
  const { data: waves } = await supabase
    .from("wave_assignments")
    .select("province_name, wave_number, tick")
    .order("wave_number").limit(15);
  if (waves && waves.length > 0) {
    lines.push(`WAVE ASSIGNMENTS:`);
    for (const w of waves) {
      lines.push(`  • Wave ${w.wave_number}: ${w.province_name} (tick ${w.tick})`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

async function askGroq(question, wikiContext, kingdomContext) {
  const systemPrompt = `You are Nexus, the Utopia kingdom advisor for Judo (4:9) on World of Legends Age 116. You have deep knowledge of Utopia game mechanics, strategy, and the specific context of this kingdom.

Be concise, tactical, and use Utopia terminology. IMPORTANT: Only reference spells, ops, races, personalities, and mechanics that actually exist in Utopia Age 116. Never invent spell or op names. If unsure whether something exists, say so. Answer in 3-5 sentences max unless a detailed breakdown is needed. Always consider the kingdom's specific race/personality makeup when giving advice.`;

  const userPrompt = `QUESTION: ${question}

${wikiContext ? `WIKI/RULES CONTEXT:\n${wikiContext}\n` : ''}
${kingdomContext ? `KINGDOM CONTEXT:\n${kingdomContext}\n` : ''}

Answer the question using the context above. Be specific and actionable.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 800
      })
    });
    const result = await response.json();
    return result.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error("[ASK GROQ ERROR]", err.message);
    return null;
  }
}

module.exports = async function askHandler(interaction) {
  const question = interaction.options.getString("question").trim();
  const lq = question.toLowerCase();

  if (lq === 'wiki' || lq === 'link' || lq === 'wiki link') {
    return interaction.reply({
      content: `📖 **Utopia Nexus Wiki**\n${wikiService.getWikiLink()}`,
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  const supabase = supabaseService.getClient();

  // Gather context in parallel
  const [wikiResults, rulesSnippet, kingdomContext] = await Promise.all([
    wikiService.searchWiki(question),
    wikiService.searchRules(question),
    getKingdomContext(supabase),
  ]);

  // Build wiki context string
  let wikiContext = '';
  if (wikiResults && wikiResults.length > 0) {
    for (const entry of wikiResults) {
      wikiContext += `${entry.title}:\n${truncate(entry.content, 600)}\n\n`;
    }
  }
  if (rulesSnippet) wikiContext += rulesSnippet;

  // Always inject race/personality rules if mentioned in question
  const raceNames = ['avian','darkelf','dark elf','dryad','dwarf','elf','faery','halfling','human','orc','undead'];
  const persNames = ['artisan','cleric','general','heretic','mystic','necromancer','rogue','sage','tactician','warrior','warhero','war hero'];
  const mentionsRace = raceNames.some(r => lq.includes(r));
  const masterPers = persNames.some(p => lq.includes(p));
  if (mentionsRace || masterPers) {
    const { data: raceRules } = await supabase
      .from("race_rules").select("race_name, rule_name, value")
      .eq("active", true).eq("age_number", 116);
    const { data: persRules } = await supabase
      .from("personality_rules").select("personality_name, rule_name, value")
      .eq("active", true).eq("age_number", 116);
    if (raceRules && raceRules.length > 0) {
      const relevant = raceRules.filter(r => lq.includes(r.race_name.toLowerCase().replace(' ','')));
      if (relevant.length > 0) {
        wikiContext += `\nRACE RULES:\n`;
        for (const r of relevant) wikiContext += `  • ${r.race_name} ${r.rule_name}: ${r.value}\n`;
      }
    }
    if (persRules && persRules.length > 0) {
      const relevant = persRules.filter(p => lq.includes(p.personality_name.toLowerCase().replace(' ','')));
      if (relevant.length > 0) {
        wikiContext += `\nPERSONALITY RULES:\n`;
        for (const p of relevant) wikiContext += `  • ${p.personality_name} ${p.rule_name}: ${p.value}\n`;
      }
    }
  }

  // Add science rules to wiki context if question mentions science
  if (lq.includes('science') || lq.includes('books') || lq.includes('research')) {
    const { data: sciRules } = await supabase
      .from("science_rules")
      .select("science_name, category, effect, multiplier, personality_modifier, race_modifier")
      .eq("active", true).eq("age_number", 116)
      .not("multiplier", "is", null);
    if (sciRules && sciRules.length > 0) {
      wikiContext += `\nSCIENCE TYPES (Age 116):\n`;
      for (const s of sciRules) {
        let line = `  • ${s.science_name} [${s.category}] — ${s.effect} (×${s.multiplier})`;
        if (s.personality_modifier) line += ` | Pers: ${s.personality_modifier}`;
        if (s.race_modifier) line += ` | Race: ${s.race_modifier}`;
        wikiContext += line + '\n';
      }
    }
  }

  // Get AI answer
  const aiAnswer = await askGroq(question, wikiContext, kingdomContext);

  if (!aiAnswer && !wikiContext) {
    return interaction.editReply({
      content: `🧠 **${question}**\n\nNo results found.\n📖 ${wikiService.getWikiLink()}`,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`🧠 ${question}`)
    .setColor(0x6366f1)
    .setFooter({ text: "Judo Kingdom (4:9) • WoL Age 116 • Utopia Nexus" });

  if (aiAnswer) {
    embed.setDescription(truncate(aiAnswer, 4000));
  }

  if (wikiContext && !aiAnswer) {
    embed.setDescription(truncate(wikiContext, 4000));
  }

  embed.addFields({ name: '📖 Wiki', value: wikiService.getWikiLink(), inline: false });

  return interaction.editReply({ embeds: [embed] });
};
