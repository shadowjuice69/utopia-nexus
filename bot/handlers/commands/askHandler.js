const wikiService = require("../../services/wikiService");

module.exports = async function askHandler(interaction) {
  console.log("ASK HANDLER STARTED");

  const question = interaction.options.getString("question");

  console.log("QUESTION:", question);

  const results = await wikiService.searchWiki(question);

  if (!results || results.length === 0) {
    await interaction.reply({
      content:
        `🧠 You asked: **${question}**\n\n` +
        `I couldn't find an answer in the Nexus Wiki database yet.\n\n` +
        `📖 Browse the full wiki:\n${wikiService.getWikiLink()}`,
      ephemeral: true,
    });
    return;
  }

  let response = `🧠 Answer for: **${question}**\n\n`;

  for (const entry of results) {
    response += `📌 **${entry.title}**\n`;
    response += `${entry.content}\n\n`;
  }

  await interaction.reply({
    content: response,
    ephemeral: true,
  });
};
