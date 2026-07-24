const { EmbedBuilder } = require("discord.js");
const wikiService = require("../../services/wikiService");

const MAX_LENGTH = 1900;
function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

const SCIENCE_CATEGORY_EMOJI = {
  economy: '💰', military: '⚔️', arcane_arts: '🔮',
};

module.exports = async function askHandler(interaction) {
  const question = interaction.options.getString("question").trim();
  const lq = question.toLowerCase();

  if (lq === 'wiki' || lq === 'link' || lq === 'wiki link') {
    return interaction.reply({
      content: `📖 **Utopia Nexus Wiki**\n${wikiService.getWikiLink()}`,
      ephemeral: true,
    });
  }

  const results = await wikiService.searchWiki(question);
  const rulesSnippet = await wikiService.searchRules(question);

  if ((!results || results.length === 0) && !rulesSnippet) {
    return interaction.reply({
      content: `🧠 **${question}**\n\nNo results found.\n📖 ${wikiService.getWikiLink()}`,
      ephemeral: true,
    });
  }

  let response = `🧠 **${question}**\n\n`;
  if (results && results.length > 0) {
    for (const entry of results) {
      const header = `📌 **${entry.title}**\n`;
      const remaining = MAX_LENGTH - response.length - header.length - 2;
      if (remaining < 50) break;
      response += header + truncate(entry.content, remaining) + '\n\n';
      if (response.length >= MAX_LENGTH) break;
    }
  }
  if (rulesSnippet && response.length + rulesSnippet.length < MAX_LENGTH) {
    response += rulesSnippet;
  }
  response += `\n📖 ${wikiService.getWikiLink()}`;

  return interaction.reply({ content: truncate(response, MAX_LENGTH), ephemeral: true });
};
