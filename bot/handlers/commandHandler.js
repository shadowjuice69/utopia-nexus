const profileHandler = require("./commands/profileHandler");
const provinceHandler = require("./commands/provinceHandler");
const leadershipHandler = require("./commands/leadershipHandler");
const memberHandler = require("./commands/memberHandler");
const rosterHandler = require("./commands/rosterHandler");
const statusHandler = require("./commands/statusHandler");
const wavesHandler = require("./commands/wavesHandler");
const helpHandler = require("./commands/helpHandler");
const askHandler = require("./commands/askHandler");
const registerHandler = require("./commands/registerHandler");
const musicHandler = require("./commands/musicHandler");
const playlistHandler = require("./commands/playlistHandler");
const buildHandler = require("./commands/buildHandler");
const stewardHandler = require("./commands/stewardHandler");
const intelOpsHandler = require("./commands/intelOpsHandler");
const analyzeWarHandler = require("./commands/analyzeWarHandler");
const warSummaryHandler = require("./commands/warSummaryHandler");
const warBoardHandler = require("./commands/warBoardHandler");
const warHandler = require("./commands/warHandler");
const targetHandler = require("./commands/targetHandler");
const ambushHandler = require("./commands/ambushHandler");
const intelHandler = require("./commands/intelHandler");
const thieveryHandler = require("./commands/thieveryHandler");
const attackHandler = require("./commands/attackHandler");
const investHandler = require("./commands/investHandler");
const declareLegalityHandler = require("./commands/declareLegalityHandler");
const spellcheckHandler = require("./commands/spellcheckHandler");
const scienceHandler = require("./commands/scienceHandler");
const scienceSummaryHandler = require("./commands/scienceSummaryHandler");
const adminHandler = require("./commands/adminHandler");
const adminsHandler = require("./commands/adminsHandler");
const addadminHandler = require("./commands/addadminHandler");
const removeadminHandler = require("./commands/removeadminHandler");
const roleHandler = require("./commands/roleHandler");
const removeHandler = require("./commands/removeHandler");
const removecheckHandler = require("./commands/removecheckHandler");
const restoreHandler = require("./commands/restoreHandler");
const broadcastHandler = require("./commands/broadcastHandler");
const setalertHandler = require("./commands/setalertHandler");
const alertsHandler = require("./commands/alertsHandler");
const deletealertHandler = require("./commands/deletealertHandler");
const setkingdomHandler = require("./commands/setkingdomHandler");
const logsHandler = require("./commands/logsHandler");
const resetageHandler = require("./commands/resetageHandler");
const threatHandler = require("./commands/threatHandler");
const permissionService = require("../services/permissionService");
const commandAccess = require("../services/commandAccessService");
const commandRegistry = require("../services/commandRegistry");
const nexusIdentity = require("../services/nexusIdentityService");
const savageHandler = require("./commands/savageCommandHandler");

const COMMAND_GROUPS = {
  utopia:{register:registerHandler,profile:profileHandler,province:provinceHandler,leadership:leadershipHandler,roster:rosterHandler,status:statusHandler,waves:wavesHandler,help:helpHandler,member:memberHandler,ask:askHandler},
  music:{join:musicHandler,play:musicHandler,pause:musicHandler,resume:musicHandler,skip:musicHandler,stop:musicHandler,queue:musicHandler,nowplaying:musicHandler,volume:musicHandler,shuffle:musicHandler,clear:musicHandler,loop:musicHandler,seek:musicHandler},
  playlist:{save:playlistHandler,list:playlistHandler,info:playlistHandler,play:playlistHandler,refresh:playlistHandler,delete:playlistHandler},
  build:{list:buildHandler,info:buildHandler},
  steward:{dm:stewardHandler},
  intel:{check:intelOpsHandler,capturehealth:intelOpsHandler,incoming:intelOpsHandler,eta:intelOpsHandler,status:intelOpsHandler,left:intelOpsHandler,plunders:intelOpsHandler,survey:intelOpsHandler,oprate:intelOpsHandler,kdecon:intelOpsHandler,econ:intelOpsHandler,tppa:intelOpsHandler},
  war:{analyze:analyzeWarHandler,summary:warSummaryHandler,board:warBoardHandler,status:warHandler,target:targetHandler,ambush:ambushHandler,intel:intelHandler},
  calc:{thievery:thieveryHandler,attack:attackHandler,invest:investHandler,declare:declareLegalityHandler,spellcheck:spellcheckHandler,science:scienceHandler,"science-summary":scienceSummaryHandler},
  admin:{panel:adminHandler,logs:logsHandler,resetage:resetageHandler,threat:threatHandler,admins:adminsHandler,alerts:alertsHandler,addadmin:addadminHandler,removeadmin:removeadminHandler,role:roleHandler,remove:removeHandler,removecheck:removecheckHandler,restore:restoreHandler,broadcast:broadcastHandler,setalert:setalertHandler,deletealert:deletealertHandler,setkingdom:setkingdomHandler,war:warHandler}
};
const OPEN_COMMANDS=new Set(["register","help","roster"]);
for(const [group,commands] of Object.entries(COMMAND_GROUPS))for(const [subcommand,handler] of Object.entries(commands))commandRegistry.register(group,subcommand,handler,{requiresRegistration:!OPEN_COMMANDS.has(subcommand),requiresAdmin:group==="admin"});
for(const name of ["me","prov","lookup","links","invest","compare","wars","militaryplans","mp","orders","ledger","pin","unpin","settz","quiet","op","find","help"]) commandRegistry.register(name,"",savageHandler,{requiresRegistration:!OPEN_COMMANDS.has(name)});

async function isRegistered(userId){if(permissionService.isOwner(userId))return true;return nexusIdentity.isRegistered(userId);}
module.exports=async function commandHandler(interaction){const command=interaction.commandName;const subcommand=interaction.options.getSubcommand(false)||"";const entry=commandRegistry.get(command,subcommand);console.log(`[${command}] ${subcommand||"(top-level)"}`);if(!entry)return interaction.reply({content:`❌ Unknown command: /${command}${subcommand?` ${subcommand}`:""}`,ephemeral:true});if(!commandAccess.canAccess(entry,interaction.user,permissionService))return interaction.reply({content:commandAccess.denialMessage(entry),ephemeral:true});if(entry.requiresRegistration&&!permissionService.isOwner(interaction.user.id)&&!(await isRegistered(interaction.user.id)))return interaction.reply({content:"❌ You need to register first. Use `/utopia register` to get started.",ephemeral:true});try{interaction.nexusIdentity=await nexusIdentity.resolve(interaction.user.id);}catch(e){console.error("[NEXUS IDENTITY RESOLVE]",e.message);interaction.nexusIdentity=null;}return entry.handler(interaction);};
module.exports.commandRegistry=commandRegistry;