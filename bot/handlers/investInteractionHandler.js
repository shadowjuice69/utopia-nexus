const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
const { listInvestBuilds, calculateInvestById } = require("../services/scienceInvestService");

const CATEGORY_EMOJI = { economy: "💰", military: "⚔️", arcane: "🔮" };
const CATEGORY_LABELS = { economy: "Economy", military: "Military", arcane: "Arcane Arts" };
const CATEGORY_ORDER = ["economy", "military", "arcane"];
const pageState = new Map();

function renderOutcome(outcome) {
  const embed = new EmbedBuilder().setTitle(`📚 Science Investment — ${outcome.buildName}`).setColor(0x6366f1).setTimestamp();
  const orderedCats = [...CATEGORY_ORDER.filter(c => outcome.results[c]), ...Object.keys(outcome.results).filter(c => !CATEGORY_ORDER.includes(c))];
  for (const cat of orderedCats) {
    const r = outcome.results[cat];
    const emoji = CATEGORY_EMOJI[cat] || "📊";
    const label = CATEGORY_LABELS[cat] || cat;
    const lines = r.rows.map(row => `**${row.name}** — ${row.allocated.toLocaleString()} books${row.effect ? `\n  └ ${row.effect}` : ""}`);
    embed.addFields({ name: `${emoji} ${label} — ${r.books.toLocaleString()} books`, value: lines.join("\n"), inline: false });
  }
  return embed;
}

function makeRows(builds, userId, page, total) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(`invest_build_select:${userId}`)
    .setPlaceholder("Choose the saved build to load")
    .addOptions(builds.map(build => ({
      label: String(build.name || "Unnamed Build").slice(0, 100),
      description: [build.build_type, build.race, build.personality].filter(Boolean).join(" • ").slice(0, 100) || "Saved build",
      value: String(build.id)
    })));
  const rows = [new ActionRowBuilder().addComponents(select)];
  const pageCount = Math.max(1, Math.ceil(total / 25));
  if (pageCount > 1) rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`invest_build_page:${userId}:prev`).setLabel("◀ Previous").setStyle(ButtonStyle.Secondary).setDisabled(page <= 0),
    new ButtonBuilder().setCustomId(`invest_build_page:${userId}:next`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(page >= pageCount - 1)
  ));
  return rows;
}

async function showBuildPicker(interaction, search, page = 0, categoryBooks = {}) {
  const result = await listInvestBuilds({ search, page, pageSize: 25 });
  if (!result.builds.length) return interaction.reply({ content: `❌ No active builds matched${search ? ` "${search}"` : ""}.`, ephemeral: true });
  const pageCount = Math.max(1, Math.ceil(result.total / 25));
  const embed = new EmbedBuilder()
    .setTitle("📚 Select a Build for Science Investment")
    .setDescription(search ? `Showing builds matching **${search}**. Select the exact saved build you want loaded.` : "Showing the saved Build Library. Select the exact build you want loaded.")
    .setFooter({ text: `Page ${page + 1}/${pageCount} • ${result.total} active build${result.total === 1 ? "" : "s"}` });
  const reply = { embeds: [embed], components: makeRows(result.builds, interaction.user.id, page, result.total), ephemeral: true };
  if (interaction.isButton()) return interaction.update(reply);
  const message = await interaction.reply(reply);
  pageState.set(message.id, { search, categoryBooks, userId: interaction.user.id, page });
}

function showBooksModal(interaction, buildId, categoryBooks = {}) {
  const modal = new ModalBuilder().setCustomId(`invest_books:${interaction.user.id}:${buildId}`).setTitle("Science Investment Books");
  for (const [id, label, value] of [["economy_books", "Economy books", categoryBooks.economy], ["military_books", "Military books", categoryBooks.military], ["arcane_books", "Arcane Arts books", categoryBooks.arcane]]) {
    const input = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder("0");
    if (Number(value) > 0) input.setValue(String(value));
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  return interaction.showModal(modal);
}

async function handleSelect(interaction) {
  const [prefix, userId] = interaction.customId.split(":");
  if (prefix !== "invest_build_select" || userId !== interaction.user.id) return interaction.reply({ content: "❌ This build picker belongs to another user.", ephemeral: true });
  const buildId = interaction.values?.[0];
  if (!buildId) return interaction.reply({ content: "❌ No build was selected.", ephemeral: true });
  const messageId = interaction.message?.id;
  const state = messageId ? pageState.get(messageId) : null;
  pageState.delete(messageId);
  return showBooksModal(interaction, buildId, state?.categoryBooks || {});
}

async function handlePage(interaction) {
  const [, userId, direction] = interaction.customId.split(":");
  if (userId !== interaction.user.id) return interaction.reply({ content: "❌ This build picker belongs to another user.", ephemeral: true });
  const state = pageState.get(interaction.message.id);
  if (!state) return interaction.reply({ content: "❌ This build picker expired. Run `/calc invest` again.", ephemeral: true });
  state.page = Math.max(0, state.page + (direction === "next" ? 1 : -1));
  return showBuildPicker(interaction, state.search, state.page, state.categoryBooks);
}

async function handleModal(interaction) {
  const parts = interaction.customId.split(":");
  if (parts[0] !== "invest_books" || parts[1] !== interaction.user.id) return false;
  const categoryBooks = {
    economy: Number(interaction.fields.getTextInputValue("economy_books") || 0),
    military: Number(interaction.fields.getTextInputValue("military_books") || 0),
    arcane: Number(interaction.fields.getTextInputValue("arcane_books") || 0)
  };
  const outcome = await calculateInvestById(parts[2], categoryBooks);
  if (outcome.error) await interaction.reply({ content: `❌ ${outcome.error}`, ephemeral: true });
  else await interaction.reply({ embeds: [renderOutcome(outcome)], ephemeral: true });
  return true;
}

module.exports = { showBuildPicker, handleSelect, handlePage, handleModal };
