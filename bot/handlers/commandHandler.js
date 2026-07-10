const profileHandler = require("./commands/profileHandler");
const provinceHandler = require("./commands/provinceHandler");

module.exports = async function commandHandler(interaction) {

    if (interaction.commandName !== "utopia") {
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    console.log(`Utopia command: ${subcommand}`);

    if (subcommand === "profile") {
        return profileHandler(interaction);
    }

if (subcommand === "province") {
    return provinceHandler(interaction);
}

};
