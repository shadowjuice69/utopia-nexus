const fs = require("fs");

const file = "handlers/commands/thieveryHandler.js";

let data = fs.readFileSync(file, "utf8");

data = data.replace(
  'await interaction.reply({ embeds: [embed] });',
  `await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });`
);

fs.writeFileSync(file, data);

console.log("✅ Thievery replies are now private");
