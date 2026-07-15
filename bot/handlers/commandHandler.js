const profileHandler = require("./commands/profileHandler");
const provinceHandler = require("./commands/provinceHandler");
const citizensHandler = require("./commands/citizensHandler");
const leadershipHandler = require("./commands/leadershipHandler");
const adminsHandler = require("./commands/adminsHandler");
const wikiHandler = require("./commands/wikiHandler");
const addadminHandler = require("./commands/addadminHandler");
const removeadminHandler = require("./commands/removeadminHandler");
const memberHandler = require("./commands/memberHandler");
const roleHandler = require("./commands/roleHandler");
const removeHandler = require("./commands/removeHandler");
const removecheckHandler = require("./commands/removecheckHandler");
const logsHandler = require("./commands/logsHandler");
const resetageHandler = require("./commands/resetageHandler");
const restoreHandler = require("./commands/restoreHandler");
const registerHandler = require("./commands/registerHandler");
const adminHandler = require("./commands/adminHandler");
const askHandler = require("./commands/askHandler");
const wavesHandler = require("./commands/wavesHandler");
const analyzeWarHandler = require("./commands/analyzeWarHandler");

module.exports = async function commandHandler(interaction) {

  if (interaction.commandName !== "utopia") return;

  const subcommand = interaction.options.getSubcommand();
  console.log(`Utopia command: ${subcommand}`);

  if (subcommand === "profile") return profileHandler(interaction);
  if (subcommand === "province") return provinceHandler(interaction);
  if (subcommand === "citizens") return citizensHandler(interaction);
  if (subcommand === "leadership") return leadershipHandler(interaction);
  if (subcommand === "admins") return adminsHandler(interaction);
  if (subcommand === "wiki") return wikiHandler(interaction);
  if (subcommand === "ask") return askHandler(interaction);
  if (subcommand === "addadmin") return addadminHandler(interaction);
  if (subcommand === "removeadmin") return removeadminHandler(interaction);
  if (subcommand === "member") return memberHandler(interaction);
  if (subcommand === "role") return roleHandler(interaction);
  if (subcommand === "remove") return removeHandler(interaction);
  if (subcommand === "removecheck") return removecheckHandler(interaction);
  if (subcommand === "logs") return logsHandler(interaction);
  if (subcommand === "resetage") return resetageHandler(interaction);
  if (subcommand === "register") return registerHandler(interaction);
  if (subcommand === "admin") return adminHandler(interaction);
  if (subcommand === "restore") return restoreHandler(interaction);
  if (subcommand === "waves") return wavesHandler(interaction);
  if (subcommand === "analyze-war") return analyzeWarHandler(interaction);
};
