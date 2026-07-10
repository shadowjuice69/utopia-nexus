const profileHandler = require("./commands/profileHandler");
const provinceHandler = require("./commands/provinceHandler");
const citizensHandler = require("./commands/citizensHandler");
const leadershipHandler = require("./commands/leadershipHandler");
const adminsHandler = require("./commands/adminsHandler");
const wikiHandler = require("./commands/wikiHandler");
const addadminHandler = require("./commands/addadminHandler");

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

    if (subcommand === "citizens") {
        return citizensHandler(interaction);
    }

    if (subcommand === "leadership") {
        return leadershipHandler(interaction);
    }

    if (subcommand === "admins") {
        return adminsHandler(interaction);
    }

if (subcommand === "wiki") {
    return wikiHandler(interaction);
}

if (subcommand === "addadmin") {
  return addadminHandler(interaction);
}
};
