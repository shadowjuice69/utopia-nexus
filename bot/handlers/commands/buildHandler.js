const { EmbedBuilder } = require("discord.js");
const { getClient } = require("../../services/supabase");

function clean(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function formatJson(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2).slice(0, 1000);
  } catch {
    return String(value);
  }
}

function codeBlock(value) {
  return "```json\n" + formatJson(value) + "\n```";
}

function buildEmbed(build) {
  const embed = new EmbedBuilder()
    .setTitle(`🧱 ${clean(build.name, "Unnamed Build")}`)
    .setDescription(clean(build.description, "No description saved."))
    .addFields(
      { name: "Race", value: clean(build.race), inline: true },
      { name: "Personality", value: clean(build.personality), inline: true },
      { name: "Role", value: clean(build.role), inline: true },
      { name: "Type", value: clean(build.build_type), inline: true },
      { name: "Version", value: clean(build.version), inline: true },
      { name: "Status", value: build.active ? "Active" : "Inactive", inline: true },
      { name: "Buildings", value: codeBlock(build.buildings), inline: false },
      { name: "Military", value: codeBlock(build.military), inline: false },
      { name: "Science", value: codeBlock(build.science), inline: false },
      { name: "Spells", value: codeBlock(build.spells), inline: false },
      { name: "Thievery", value: codeBlock(build.thievery), inline: false },
      { name: "Priorities", value: codeBlock(build.priorities), inline: false },
      { name: "Notes", value: clean(build.notes, "No notes saved.").slice(0, 1024), inline: false }
    )
    .setFooter({ text: `Build ID: ${build.id}` });

  return embed;
}

async function getBuilds({ search, buildType }) {
  const supabase = getClient();
  if (!supabase) throw new Error("Supabase is not configured on the bot.");

  let query = supabase
    .from("ai_builds")
    .select("id,name,description,race,personality,role,buildings,military,science,spells,thievery,priorities,notes,active,version,build_type,province_id,raw_text,created_at,updated_at")
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
