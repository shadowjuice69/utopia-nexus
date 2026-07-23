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
const intelHandler = require('./commands/intelHandler');
const adminHandler = require("./commands/adminHandler");
const askHandler = require("./commands/askHandler");
const wavesHandler = require("./commands/wavesHandler");
const spellcheckHandler = require("./commands/spellcheckHandler");
const ambushHandler = require("./commands/ambushHandler");
const analyzeWarHandler = require("./commands/analyzeWarHandler");
const setalertHandler = require("./commands/setalertHandler");
const alertsHandler = require("./commands/alertsHandler");
const deletealertHandler = require("./commands/deletealertHandler");
const statusHandler = require("./commands/statusHandler");
const targetHandler = require("./commands/targetHandler");
const warHandler = require("./commands/warHandler");
const threatHandler = require("./commands/threatHandler");
const broadcastHandler = require("./commands/broadcastHandler");
const helpHandler = require("./commands/helpHandler");
const permissionService = require("../services/permissionService");

const UTOPIA_COMMANDS = {
  profile: profileHandler,
  province: provinceHandler,
  citizens: citizensHandler,
  leadership: leadershipHandler,
  waves: wavesHandler,
  wiki: wikiHandler,
  ask: askHandler,
  status: statusHandler,
  target: targetHandler,
  member: memberHandler,
  register: registerHandler,
  ambush: ambushHandler,
  spellcheck: spellcheckHandler,
  intel: intelHandler,
  help: helpHandler
};

const ADMIN_COMMANDS = {
  panel: adminHandler,
  admins: adminsHandler,
  logs: logsHandler,
  resetage: resetageHandler,
  "analyze-war": analyzeWarHandler,
  addadmin: addadminHandler,
  removeadmin: removeadminHandler,
  restore: restoreHandler,
  remove: removeHandler,
  removecheck: removecheckHandler,
  role: roleHandler,
  setalert: setalertHandler,
  alerts: alertsHandler,
  deletealert: deletealertHandler,
  threat: threatHandler,
  broadcast: broadcastHandler,
  war: warHandler
};

// Combined map — owner can run admin commands from either group
const ALL_COMMANDS = { ...UTOPIA_COMMANDS, ...ADMIN_COMMANDS };

module.exports = async function commandHandler(interaction) {
  const cmd = interaction.commandName;
  if (cmd !== "utopia" && cmd !== "admin") return;

  const subcommand = interaction.options.getSubcommand();
  console.log(`[${cmd}] ${subcommand}`);

  // Check if it's an admin command being run from /utopia
  const isAdminCmd = ADMIN_COMMANDS[subcommand] !== undefined;
  if (isAdminCmd && !permissionService.isAdmin(interaction.user.id)) {
    return interaction.reply({
      content: "❌ You don't have permission to use admin commands.",
      ephemeral: true
    });
  }

  const handler = ALL_COMMANDS[subcommand];
  if (handler) return handler(interaction);

  return interaction.reply({ content: `❌ Unknown command: ${subcommand}`, ephemeral: true });
};
