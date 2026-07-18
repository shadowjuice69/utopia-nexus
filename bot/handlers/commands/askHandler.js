const wikiService = require("../../services/wikiService");

const MAX_LENGTH = 1900; //留 100 chars buffer for Discord

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

module.exports = async function askHandler(interaction) {
  const question = interaction.options.getString("question");

  const results = await wikiService.searchWiki(question);

  if (!results || results.length === 0) {
    return interaction.reply({
      content: `🧠 **${question}**\n\nNo results found in the wiki.\n📖 ${wikiService.getWikiLink()}`,
      ephemeral: true
    });
  }

  let response = `🧠 **${question}**\n\n`;

  for (const entry of results) {
    const header = `📌 **${entry.title}**\n`;
    const remaining = MAX_LENGTH - response.length - header.length - 2;
    if (remaining < 50) break; // No room for more
    const content = truncate(entry.content, remaining);
    response += header + content + '\n\n';
    if (response.length >= MAX_LENGTH) break;
  }

  // Also query rules tables for race/personality matches
  const rulesSnippet = await wikiService.searchRules(question);
  if (rulesSnippet && response.length + rulesSnippet.length < MAX_LENGTH) {
    response += rulesSnippet;
  }

  return interaction.reply({
    content: truncate(response, MAX_LENGTH),
    ephemeral: true
  });
};
