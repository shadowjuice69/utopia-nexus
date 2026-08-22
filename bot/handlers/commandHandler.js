const profileHandler        = require("./commands/profileHandler");
const provinceHandler       = require("./commands/provinceHandler");
const leadershipHandler     = require("./commands/leadershipHandler");
const memberHandler         = require("./commands/memberHandler");
const rosterHandler         = require("./commands/rosterHandler");
const statusHandler         = require("./commands/statusHandler");
const wavesHandler          = require("./commands/wavesHandler");
const helpHandler           = require("./commands/helpHandler");
const askHandler            = require("./commands/askHandler");
const registerHandler       = require("./commands/registerHandler");
const musicHandler          = require("./commands/musicHandler");

const analyzeWarHandler     = require("./commands/analyzeWarHandler");
const warSummaryHandler     = require("./commands/warSummaryHandler");
const warBoardHandler       = require("./commands/warBoardHandler");
const warHandler            = require("./commands/warHandler");
const targetHandler         = require("./commands/targetHandler");
const ambushHandler         = require("./commands/ambushHandler");
const intelHandler          = require("./commands/intelHandler");

const thieveryHandler       = require("./commands/thieveryHandler");
const attackHandler          = require("./commands/attackHandler");
const spellcheckHandler     = require("./commands/spellcheckHandler");
const scienceHandler        = require("./commands/scienceHandler");
const scienceSummaryHandler = require("./commands/scienceSummaryHandler");

const adminHandler          = require("./commands/adminHandler");
const adminsHandler         = require("./commands/adminsHandler");
const addadminHandler       = require("./commands/addadminHandler");
const removeadminHandler    = require("./commands/removeadminHandler");
const roleHandler           = require("./commands/roleHandler");
const removeHandler         = require("./commands/removeHandler");
const removecheckHandler    = require("./commands/removecheckHandler");
const restoreHandler        = require("./commands/restoreHandler");
const broadcastHandler      = require("./commands/broadcastHandler");
const setalertHandler       = require("./commands/setalertHandler");
const alertsHandler         = require("./commands/alertsHandler");
const deletealertHandler    = require("./commands/deletealertHandler");
const setkingdomHandler     = require("./commands/setkingdomHandler");
const logsHandler            = require("./commands/logsHandler");
const resetageHandler       = require("./commands/resetageHandler");
const threatHandler          = require("./commands/threatHandler");

const permissionService = require("../services/permissionService");
const commandAccess = require("../services/commandAccessService");
const commandRegistry = require("../services/commandRegistry");

const COMMAND_GROUPS = {
  utopia: {
    register: registerHandler,
    profile: profileHandler,
    province: provinceHandler,
    leadership: leadershipHandler,
    roster: rosterHandler,
    status: statusHandler,
    waves: wavesHandler,
    help: helpHandler,
    member: memberHandler,
    ask: askHandler
  },
  music: {
    join: musicHandler,
    play: musicHandler,
    pause: musicHandler,
    resume: musicHandler,
    skip: musicHandler,
    stop: musicHandler,
    queue: musicHandler,
    nowplaying: musicHandler,
    volume: musicHandler,
    shuffle: musicHandler,
    clear: musicHandler,
    loop: musicHandler,
    seek: musicHandler
  },
  war: {
    analyze: analyzeWarHandler,
    summary: warSummaryHandler,
    board: warBoardHandler,
    status: warHandler,
    target: targetHandler,
    ambush: ambushHandler,
    intel: intelHandler
  },
  calc: {
    thievery: thieveryHandler,
    attack: attackHandler,
    spellcheck: spellcheckHandler,
    science: scienceHandler,
    "science-summary": scienceSummaryHandler
  },
  admin: {
    panel: adminHandler,
    logs: logsHandler,
    resetage: resetageHandler,
    threat: threatHandler,
    admins: adminsHandler,
    alerts: alertsHandler,
    addadmin: addadminHandler,
    removeadmin: removeadminHandler,
    role: roleHandler,
    remove: removeHandler,
    removecheck: removecheckHandler,
    restore: restoreHandler,
    broadcast: broadcastHandler,
    setalert: setalertHandler,
    deletealert: deletealertHandler,
    setkingdom: setkingdomHandler,
    war: warHandler
  }
};

const OPEN_COMMANDS = new Set(["register", "help", "roster"]);

for (const [group, commands] of Object.entries(COMMAND_GROUPS)) {
  for (const [subcommand, handler] of Object.entries(commands)) {
    commandRegistry.register(group, subcommand, handler, {
      requiresRegistration: !OPEN_COMMANDS.has(subcommand),
      requiresAdmin: group === "admin"
    });
  }
}

async function isRegistered(userId) {
  const supabase = require("../services/supabase").getClient();
  if (!supabase) return true;
  const { data } = await supabase.from("provinces").select("id").or(`user_id.eq.${userId},discord_id.eq.${userId}`).limit(1);
  return data && data.length > 0;
}

module.exports = async function commandHandler(interaction) {
  const command = interaction.commandName;
  const subcommand = interaction.options.getSubcommand(false);
  const entry = commandRegistry.get(command, subcommand);

  console.log(`[${command}] ${subcommand || "(no subcommand)"}`);

  if (!entry) {
    return interaction.reply({ content: `❌ Unknown command: \`/${command} ${subcommand || ""}\``, ephemeral: true });
  }
  if (!commandAccess.canAccess(entry, interaction.user, permissionService)) {
    return interaction.reply({ content: commandAccess.denialMessage(entry), ephemeral: true });
  }
  if (entry.requiresRegistration) {
    const registered = await isRegistered(interaction.user.id);
    if (!registered) {
      return interaction.reply({ content: "❌ You need to register first. Use `/utopia register` to get started.", ephemeral: true });
    }
  }
  return entry.handler(interaction);
};

module.exports.commandRegistry = commandRegistry;
