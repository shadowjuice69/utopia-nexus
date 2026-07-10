const profileHandler = require("./commands/profileHandler");

module.exports = async function commandHandler(interaction) {

    if (interaction.commandName !== "utopia") {
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    console.log(`Utopia command: ${subcommand}`);

    if (subcommand === "profile") {
        return profileHandler(interaction);
    }

};
