const { EmbedBuilder } = require("discord.js");
const { getClient } = require("../../services/supabase");

function clean(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function compact(items, separator = " • ", fallback = "None listed") {
  if (!Array.isArray(items) || !items.length) return fallback;
  return items.map((item) => String(item)).join(separator);
}

function formatBuildings(buildings) {
  if (!buildings || typeof buildings !== "object") return "None saved.";
  const labels = {
    farms: "Farms", forts: "Forts", homes: "Homes", guilds: "Guilds",
    towers: "Towers", stables: "Stables", thieves_dens: "Thieves' Dens",
    universities: "Universities", barren: "Barren"
  };
  const entries = Object.entries(buildings).map(([key, value]) => {
    const label = labels[key] || titleCase(key);
    if (value && typeof value === "object") {
      const amount = value.value ?? value.target;
      const metric = value.metric || "%";
      if (amount !== undefined && amount !== null) return `${label} ${amount}${metric === "%" ? "%" : ` ${metric}`}`;
    }
    return `${label} ${String(value)}`;
  });
  return entries.join(" • ");
}

function formatPopulationTargets(military) {
  if (!military || typeof military !== "object") return "None saved.";
  const labels = {
    thieves_acre: "Thieves", wizards_acre: "Wizards", peasants_acre: "Peasants",
    off_specs_acre: "Off Specs"
  };
  const parts = [];
  for (const [key, value] of Object.entries(military)) {
    if (!value || typeof value !== "object") continue;
    const amount = value.value;
    if (amount === null || amount === undefined) continue;
    const label = labels[key] || titleCase(key);
    const metric = String(value.metric || "").toUpperCase();
    parts.push(`${label} ${amount}${metric ? ` ${metric}` : ""}`);
  }
  const fill = military.elites_acre_first_def_specs_acre_fill_at_least;
  if (fill && fill.minimum) parts.push("10+ EPA/DSPA — elites first, defense fills");
  return parts.join(" • ") || "None saved.";
}

function formatScience(science) {
  if (!science || typeof science !== "object") return "None saved.";
  const groups = { economy: [], military: [], arcane: [] };
  for (const [key, value] of Object.entries(science)) {
    if (!value || typeof value !== "object") continue;
    const category = String(value.category || "other").toLowerCase();
    const books = value.books ?? value.value;
    const item = `${titleCase(key)} ${books ?? 0}`;
    if (!groups[category]) groups[category] = [];
    groups[category].push(item);
  }
  return Object.entries(groups)
    .filter(([, items]) => items.length)
    .map(([category, items]) => `**${titleCase(category)}:** ${items.join(" • ")}`)
    .join("\n") || "None saved.";
}

function formatSpells(spells) {
  if (!spells || typeof spells !== "object") return "None saved.";
  const groups = {};
  for (const value of Object.values(spells)) {
    if (!value) continue;
    const name = typeof value === "string" ? value : value.name;
    if (!name) continue;
    const sources = Array.isArray(value.source) ? value.source : [];
    const source = sources.length ? sources.join(" / ") : "Build";
    if (!groups[source]) groups[source] = [];
    groups[source].push(name);
  }
  return Object.entries(groups)
    .map(([source, names]) => `**${source}:** ${names.join(" • ")}`)
    .join("\n") || "None saved.";
}

function formatThievery(thievery) {
  if (!thievery || typeof thievery !== "object") return "None saved.";
  const access = clean(thievery.access, "Standard");
  const operations = Array.isArray(thievery.operations) && thievery.operations.length
    ? thievery.operations.map((op) => typeof op === "object" ? (op.name || op.operation || JSON.stringify(op)) : String(op)).join(" • ")
    : "None";
  return `**Access:** ${access}\n**Operations:** ${operations}`;
}

function formatRules(profile, race, personality) {
  const raceRules = profile?.race || {};
  const personalityRules = profile?.personality || {};
  const sections = [];
  if (race || raceRules.name) {
    sections.push(`**${clean(raceRules.name || race, "Race")}**\n` +
      `**Bonuses:** ${compact(raceRules.bonuses)}\n` +
      `**Penalties:** ${compact(raceRules.penalties)}\n` +
      `**Unique:** ${clean(raceRules.unique, "None listed")}`);
  }
  if (personality || personalityRules.name) {
    sections.push(`**${clean(personalityRules.name || personality, "Personality")}**\n` +
      `**Bonuses:** ${compact(personalityRules.bonuses)}\n` +
      `**Penalties:** ${compact(personalityRules.penalties)}\n` +
      `**Unique:** ${clean(personalityRules.unique, "None listed")}`);
  }
  return sections.join("\n\n") || "No race/personality rules saved.";
}

function formatDoctrine(profile) {
  const doctrine = profile?.warDoctrine || profile?.war_doctrine || profile?.doctrine;
  return Array.isArray(doctrine) ? compact(doctrine, "\n") : clean(doctrine, "None listed");
}

function formatPriorities(priorities) {
  if (!priorities || typeof priorities !== "object") return "None saved.";
  return Object.entries(priorities).map(([key, value]) => {
    if (value && typeof value === "object") {
      const amount = value.value ?? value.target;
      const metric = value.metric || "";
      return `${titleCase(key)} ${amount ?? "—"}${metric === "%" ? "%" : metric ? ` ${metric}` : ""}`;
    }
    return `${titleCase(key)} ${String(value)}`;
  }).join(" • ");
}

function buildEmbed(build) {
  const profile = build.rules_profile || {};
  const rulesText = formatRules(profile, build.race, build.personality);
  const doctrineText = formatDoctrine(profile);

  const embed = new EmbedBuilder()
    .setTitle(`🧱 ${clean(build.name, "Unnamed Build")}`)
    .setDescription([
      clean(build.description, "No description saved."),
      `**Age:** ${clean(build.age, "116")} • **Version:** ${clean(build.version)} • **Status:** ${build.active ? "Active" : "Inactive"}`,
      `**Type:** ${clean(build.build_type)} • **Role:** ${clean(build.role)}`,
      `**Race:** ${clean(build.race)} • **Personality:** ${clean(build.personality)}`
    ].join("\n"))
    .addFields(
      { name: "🏗️ Buildings", value: formatBuildings(build.buildings).slice(0, 1024), inline: false },
      { name: "👥 Population / Training Targets", value: formatPopulationTargets(build.military).slice(0, 1024), inline: false },
      { name: "🔬 Science", value: formatScience(build.science).slice(0, 1024), inline: false },
      { name: "✨ Spells", value: formatSpells(build.spells).slice(0, 1024), inline: false },
      { name: "🗡️ Thievery", value: formatThievery(build.thievery).slice(0, 1024), inline: false },
      { name: "🧬 Race / Personality Effects", value: rulesText.slice(0, 1024), inline: false },
      { name: "⚔️ War Doctrine", value: doctrineText.slice(0, 1024), inline: false },
      { name: "🎯 Priorities", value: formatPriorities(build.priorities).slice(0, 1024), inline: false },
      { name: "📝 Notes", value: clean(build.notes, "No notes saved.").slice(0, 1024), inline: false }
    )
    .setFooter({ text: `Build ID: ${build.id}` });

  return embed;
}

async function getBuilds({ search, buildType }) {
  const supabase = getClient();
  if (!supabase) throw new Error("Supabase is not configured on the bot.");

  let query = supabase
    .from("ai_builds")
    .select("id,name,description,race,personality,role,buildings,military,science,spells,thievery,priorities,notes,active,version,build_type,province_id,raw_text,age,rules_profile,created_at,updated_at")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(25);

  if (buildType) query = query.eq("build_type", buildType);
  if (search) {
    const term = search.replace(/[%_,]/g, " ").trim();
    if (term) {
      query = query.or(`name.ilike.%${term}%,race.ilike.%${term}%,personality.ilike.%${term}%,role.ilike.%${term}%,build_type.ilike.%${term}%`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function handleList(interaction) {
  const search = interaction.options.getString("search");
  const buildType = interaction.options.getString("type");
  const builds = await getBuilds({ search, buildType });

  if (!builds.length) {
    return interaction.reply({ content: "📚 No active builds matched that search.", ephemeral: true });
  }

  const lines = builds.map((build, index) => {
    const combo = [build.race, build.personality].filter(Boolean).join(" / ");
    return `**${index + 1}. ${clean(build.name, "Unnamed Build")}** — ${clean(build.build_type, "unknown")} — ${combo || clean(build.role, "no role")} — v${clean(build.version)}`;
  });

  const embed = new EmbedBuilder()
    .setTitle("📚 Nexus Build Library")
    .setDescription(lines.join("\n").slice(0, 4000))
    .setFooter({ text: `Showing ${builds.length} active build${builds.length === 1 ? "" : "s"}` });

  return interaction.reply({ embeds: [embed] });
}

async function handleInfo(interaction) {
  const name = interaction.options.getString("name", true).trim();
  const builds = await getBuilds({ search: name });
  const exact = builds.find((build) => String(build.name || "").toLowerCase() === name.toLowerCase()) || builds[0];

  if (!exact) {
    return interaction.reply({ content: `📚 No build found for **${name}**.`, ephemeral: true });
  }

  return interaction.reply({ embeds: [buildEmbed(exact)] });
}

module.exports = async function buildHandler(interaction) {
  try {
    const subcommand = interaction.options.getSubcommand(false);
    if (subcommand === "list") return handleList(interaction);
    if (subcommand === "info") return handleInfo(interaction);
    return interaction.reply({ content: "❌ Unknown build subcommand.", ephemeral: true });
  } catch (error) {
    console.error("[BUILD COMMAND]", error);
    const message = `❌ Build Library error: ${error.message || "Unable to access builds."}`;
    if (interaction.replied || interaction.deferred) return interaction.followUp({ content: message, ephemeral: true });
    return interaction.reply({ content: message, ephemeral: true });
  }
};
