const { EmbedBuilder } = require("discord.js");
const { getKingdomInfo } = require("../../services/kingdomService");
const wikiService = require("../../services/wikiService");
const supabaseService = require("../../services/supabase");
const { getNexusPrompt } = require("../../services/nexusPrompt");
const { askOpenRouter } = require("../../services/openrouterService");

const MAX_LENGTH = 1900;
function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

async function getKingdomContext(supabase, kd) {
  if (!supabase) return null;
  const lines = [];

  // Kingdom settings
  const { data: settings } = await supabase.from("bot_settings").select("key, value");
  const kdName = settings?.find(s => s.key === "kingdom_name")?.value || "Unknown Kingdom";
  const kdCode = settings?.find(s => s.key === "kingdom_code")?.value || "Unknown";
  lines.push(`KINGDOM: ${kdName} (${kdCode})`);

  // Provinces with full stats
  const { data: provs } = await supabase
    .from("provinces")
    .select("name, race, personality, play_role, nw, acres, off, def, be, o_tpa, o_wpa, good_spells, updated_at")
    .order("nw", { ascending: false }).limit(30);
  if (provs && provs.length > 0) {
    lines.push(`\nKINGDOM MEMBERS (${provs.length}):`);
    for (const p of provs) {
      let line = `  • ${p.name} — ${p.race || '?'} ${p.personality || ''} (${p.play_role || '?'})`;
      if (p.nw) line += ` NW:${p.nw}`;
      if (p.acres) line += ` Acres:${p.acres}`;
      if (p.off) line += ` Off:${p.off}`;
      if (p.def) line += ` Def:${p.def}`;
      if (p.be) line += ` BE:${p.be}%`;
      lines.push(line);
    }
  }

  // My province full intel
  const myProvName = settings?.find(s => s.key === "my_province")?.value || null;
  const { data: myState } = myProvName ? await supabase.from("intel_state").select("*").eq("province", myProvName).single() : { data: null };
  if (myState) {
    lines.push(`\nMY PROVINCE STATE:`);
    lines.push(`  NW:${myState.networth} Land:${myState.land} Honor:${myState.honor} Rank:${myState.nw_rank} MAP:${myState.map}`);
    lines.push(`  Daily Income:${myState.daily_income} Wages:${myState.daily_wages} Net Yesterday:${myState.net_yesterday}`);
    lines.push(`  Population: Army:${myState.army} Thieves:${myState.thieves} Wizards:${myState.wizards} Peasants:${myState.peasants}/${myState.max_pop}`);
    lines.push(`  Food Net/day:${myState.food_net_yesterday} Runes Net/day:${myState.runes_net_yesterday}`);
  }

  // My military
  const { data: myMil } = myProvName ? await supabase.from("intel_military").select("*").eq("province", myProvName).single() : { data: null };
  if (myMil) {
    lines.push(`\nMY MILITARY:`);
    lines.push(`  Off Points:${myMil.offense} Def Points:${myMil.defense} Generals:${myMil.generals}`);
    if (myMil.troops) lines.push(`  Troops at home: ${JSON.stringify(myMil.troops)}`);
    if (myMil.armies && myMil.armies.length > 0) {
      for (const [i, army] of myMil.armies.entries()) {
        lines.push(`  Army #${i+1}: returns in ${army.return_days} game days — ${JSON.stringify(army.troops)}`);
      }
    }
  }

  // Enemy intel
  const { data: enemies } = await supabase.from("intel_throne")
    .select("province, race, kd_code, networth, land, offense, defense, be, spells, updated_at")
    .order("updated_at", { ascending: false }).limit(20);
  if (enemies && enemies.length > 0) {
    lines.push(`\nENEMY INTEL (${enemies.length} provinces):`);
    for (const e of enemies) {
      let line = `  • ${e.province} (${e.kd_code}) — ${e.race || '?'}`;
      if (e.networth) line += ` NW:${e.networth}`;
      if (e.land) line += ` Land:${e.land}`;
      if (e.offense) line += ` Off:${e.offense}`;
      if (e.defense) line += ` Def:${e.defense}`;
      lines.push(line);
    }
  }

  // Recent attack summary
  const { data: attacks } = await supabase.from("news_events")
    .select("event_type, date, defender_name, defender_kd, attacker_name, attacker_kd, acres, troops_sent, credits_gained")
    .in("event_type", ["outgoing_attack","outgoing_ambush","incoming_attack","incoming_ambush"])
    .order("created_at", { ascending: false }).limit(20);
  if (attacks && attacks.length > 0) {
    const outgoing = attacks.filter(a => a.event_type.startsWith("outgoing"));
    const incoming = attacks.filter(a => a.event_type.startsWith("incoming"));
    lines.push(`\nATTACK HISTORY:`);
    lines.push(`  Outgoing: ${outgoing.length} attacks, ${outgoing.reduce((s,a)=>s+(a.acres||0),0)} acres gained, ${outgoing.reduce((s,a)=>s+(a.credits_gained||0),0)} credits`);
    lines.push(`  Incoming: ${incoming.length} attacks, ${incoming.reduce((s,a)=>s+(a.acres||0),0)} acres lost`);
    for (const a of outgoing.slice(0,5)) {
      lines.push(`  • ${a.date}: attacked ${a.defender_name} (${a.defender_kd}) +${a.acres} acres`);
    }
  }

  // Recent hostile ops
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: ops } = await supabase.from("hostile_ops")
    .select("op_type, target, caster_kd, timestamp")
    .gte("timestamp", since).order("timestamp", { ascending: false }).limit(10);
  if (ops && ops.length > 0) {
    lines.push(`\nRECENT HOSTILE OPS (24h):`);
    for (const op of ops) lines.push(`  • ${op.op_type} on ${op.target} from ${op.caster_kd}`);
  }

  // Active war
  const { data: wars } = await supabase.from("wars")
    .select("enemy_kd, status, started_at").eq("status", "active").limit(1);
  if (wars && wars.length > 0) {
    lines.push(`\nACTIVE WAR: vs ${wars[0].enemy_kd} (started ${wars[0].started_at})`);
  }

  // Wave assignments
  const { data: waves } = await supabase.from("wave_assignments")
    .select("province_name, wave_number, tick").order("wave_number").limit(15);
  if (waves && waves.length > 0) {
    lines.push(`\nWAVE ASSIGNMENTS:`);
    for (const w of waves) lines.push(`  • Wave ${w.wave_number}: ${w.province_name} (tick ${w.tick})`);
  }

  const full = lines.join("\n");
  return full.length > 3000 ? full.slice(0, 3000) + "\n...[truncated]" : full;
}

async function askGroq(question, wikiContext, kingdomContext, kd) {
  const systemPrompt = getNexusPrompt(kd)

  const userPrompt = `QUESTION: ${question}

${wikiContext ? `WIKI/RULES CONTEXT:\n${wikiContext}\n` : ''}
${kingdomContext ? `KINGDOM CONTEXT:\n${kingdomContext}\n` : ''}

Answer the question using the context above.
Priority rules:
- Structured game rule databases (spell_rules, race_rules, personality_rules, science_rules) are authoritative.
- If wiki_entries conflicts with structured rules, always use the structured rules.
- Use wiki_entries for additional explanation and strategy only.
Be specific and actionable.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      signal: controller.signal,
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
        max_tokens: 600
      })
    });
    clearTimeout(timeout);
    const result = await response.json();
    return result.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error("[ASK GROQ ERROR]", err.message);
    return null;
  }
}


// ─── COMBO ADVISOR ────────────────────────────────────────────────────────────

const ROLE_KEYWORDS = {
  thief:    ["thief", "thieves", "tpa", "thievery", "rogue", "steal", "rob", "ops"],
  mage:     ["mage", "wizard", "wpa", "spell", "sorcery", "magic", "arcane"],
  attacker: ["attacker", "attack", "offense", "offensive", "off", "soldier", "general", "march"],
  defender: ["defender", "defense", "defensive", "def", "fortress"],
  hybrid:   ["hybrid", "spellfighter", "thief mage", "thief-mage", "mage thief"]
};

const RACE_SYNERGY = {
  thief:    ["halfling", "dark elf", "darkelf", "rogue", "human"],
  mage:     ["elf", "faery", "dryad", "mystic"],
  attacker: ["orc", "avian", "dwarf", "undead"],
  defender: ["dwarf", "human", "halfling"],
  hybrid:   ["dark elf", "darkelf", "elf", "faery", "halfling"]
};

const PERS_SYNERGY = {
  thief:    ["rogue", "heretic"],
  mage:     ["mystic", "necromancer", "sage", "cleric"],
  attacker: ["general", "warrior", "war hero", "warhero", "tactician"],
  defender: ["tactician", "warrior", "artisan"],
  hybrid:   ["rogue", "mystic", "necromancer", "heretic"]
};

function detectRoles(question) {
  const lq = question.toLowerCase();
  const roles = [];
  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
    if (keywords.some(k => lq.includes(k))) roles.push(role);
  }
  if (roles.includes("thief") && roles.includes("mage") && !roles.includes("hybrid")) {
    roles.push("hybrid");
  }
  return roles;
}

async function getComboContext(supabase, question) {
  const roles = detectRoles(question);
  if (roles.length === 0) return null;

  const { data: raceRules } = await supabase
    .from("race_rules").select("race_name, rule_name, value")
    .eq("active", true).eq("age_number", 116);
  const { data: persRules } = await supabase
    .from("personality_rules").select("personality_name, rule_name, value")
    .eq("active", true).eq("age_number", 116);

  if (!raceRules || !persRules) return null;

  const relevantRaces = new Set();
  const relevantPers = new Set();
  for (const role of roles) {
    (RACE_SYNERGY[role] || []).forEach(r => relevantRaces.add(r));
    (PERS_SYNERGY[role] || []).forEach(p => relevantPers.add(p));
  }

  const matchedRaces = raceRules.filter(r =>
    relevantRaces.has(r.race_name.toLowerCase()) ||
    relevantRaces.has(r.race_name.toLowerCase().replace(" ", ""))
  );
  const matchedPers = persRules.filter(p =>
    relevantPers.has(p.personality_name.toLowerCase().replace("the ", "")) ||
    relevantPers.has(p.personality_name.toLowerCase().replace("the ", "").replace(" ", ""))
  );

  if (matchedRaces.length === 0 && matchedPers.length === 0) return null;

  let ctx = "\nCOMBO ADVISOR (detected roles: " + roles.join(", ") + "):\n";
  ctx += "Relevant races: " + [...relevantRaces].join(", ") + "\n";
  ctx += "Relevant personalities: " + [...relevantPers].join(", ") + "\n";

  if (matchedRaces.length > 0) {
    const byRace = {};
    for (const r of matchedRaces) {
      if (!byRace[r.race_name]) byRace[r.race_name] = [];
      byRace[r.race_name].push(r.rule_name + ": " + r.value);
    }
    ctx += "\nRACE BONUSES:\n";
    for (const [race, rules] of Object.entries(byRace)) {
      ctx += "  " + race + ":\n";
      for (const rule of rules) ctx += "    - " + rule + "\n";
    }
  }

  if (matchedPers.length > 0) {
    const byPers = {};
    for (const p of matchedPers) {
      if (!byPers[p.personality_name]) byPers[p.personality_name] = [];
      byPers[p.personality_name].push(p.rule_name + ": " + p.value);
    }
    ctx += "\nPERSONALITY BONUSES:\n";
    for (const [pers, rules] of Object.entries(byPers)) {
      ctx += "  " + pers + ":\n";
      for (const rule of rules) ctx += "    - " + rule + "\n";
    }
  }

  ctx += "\nRecommend the best race+personality combos for the detected role(s) with specific synergy reasoning.\n";
  return ctx;
}

module.exports = async function askHandler(interaction) {
  const kd = await getKingdomInfo();
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
  const [wikiResults, rulesSnippet, kingdomContext, comboContext] = await Promise.all([
    wikiService.searchWiki(question),
    wikiService.searchRules(question),
    getKingdomContext(supabase, kd),
    getComboContext(supabase, question),
  ]);

  console.log("=== NEXUS RULES DEBUG ===");
  console.log(rulesSnippet);
  console.log("=== NEXUS WIKI DEBUG ===");
  console.log(wikiResults);
  console.log("=========================");

  // Build wiki context string
  let wikiContext = '';
  if (wikiResults && wikiResults.length > 0) {
    for (const entry of wikiResults) {
      wikiContext += `${entry.title}:\n${truncate(entry.content, 600)}\n\n`;
    }
  }
  if (rulesSnippet) wikiContext += rulesSnippet;
  if (comboContext) wikiContext += comboContext;
  if (comboContext) wikiContext += comboContext;

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
      const relevant = persRules.filter(p => lq.includes(p.personality_name.toLowerCase().replace('the ', '').replace(' ', '')));
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
  let aiAnswer = await askGroq(question, wikiContext, kingdomContext, kd);

  if (!aiAnswer) {
    console.log("[ASK] Groq failed, trying OpenRouter...");
    aiAnswer = await askOpenRouter(
      `You are Nexus, a Utopia kingdom advisor.

QUESTION:
${question}

WIKI CONTEXT:
${wikiContext}

KINGDOM CONTEXT:
${kingdomContext}

Give a concise tactical answer using only real Utopia mechanics.`
    );
  }

  if (!aiAnswer && !wikiContext) {
    return interaction.editReply({
      content: `🧠 **${question}**\n\nNo results found.\n📖 ${wikiService.getWikiLink()}`,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`🧠 ${question}`)
    .setColor(0x6366f1)
    .setFooter({ text: kd.footer });

  if (aiAnswer) {
    embed.setDescription(truncate(aiAnswer, 4000));
  }

  if (wikiContext && !aiAnswer) {
    embed.setDescription(truncate(wikiContext, 4000));
  }

  embed.addFields({ name: '📖 Wiki', value: wikiService.getWikiLink(), inline: false });

  return interaction.editReply({ embeds: [embed] });
};
