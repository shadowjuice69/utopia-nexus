const permissionService=require('../services/permissionService');
const commandAccess=require('../services/commandAccessService');
const commandRegistry=require('../services/commandRegistry');
const nexusIdentity=require('../services/nexusIdentityService');
const spartanAccess=require('../services/spartanAccessService');
const spartanHandler=require('./commands/spartanHandler');
const spartanRegister=require('./commands/spartanRegisterHandler');
const spartanStatus=require('./commands/spartanStatusHandler');
const spartanAccessHandler=require('./commands/spartanAccessHandler');
const helpHandler=require('./commands/helpHandler');
const musicHandler=require('./commands/musicHandler');
const intelOpsHandler=require('./commands/intelOpsHandler');
const thieveryHandler=require('./commands/thieveryHandler');
const attackHandler=require('./commands/attackHandler');
const investHandler=require('./commands/investHandler');
const declareLegalityHandler=require('./commands/declareLegalityHandler');
const spellcheckHandler=require('./commands/spellcheckHandler');
const scienceHandler=require('./commands/scienceHandler');
const scienceSummaryHandler=require('./commands/scienceSummaryHandler');
const analyzeWarHandler=require('./commands/analyzeWarHandler');
const warSummaryHandler=require('./commands/warSummaryHandler');
const warBoardHandler=require('./commands/warBoardHandler');
const warHandler=require('./commands/warHandler');
const targetHandler=require('./commands/targetHandler');
const ambushHandler=require('./commands/ambushHandler');
const intelHandler=require('./commands/intelHandler');
const adminHandler=require('./commands/adminHandler');
const adminsHandler=require('./commands/adminsHandler');
const logsHandler=require('./commands/logsHandler');
const alertsHandler=require('./commands/alertsHandler');
const broadcastHandler=require('./commands/broadcastHandler');

const COMMANDS={
 spartan:{register:spartanRegister,status:spartanStatus,ask:spartanHandler,access:spartanAccessHandler,help:helpHandler},
 'spartan-music':{join:musicHandler,play:musicHandler,pause:musicHandler,resume:musicHandler,skip:musicHandler,stop:musicHandler,queue:musicHandler,nowplaying:musicHandler,volume:musicHandler},
 'spartan-intel':{check:intelOpsHandler,capturehealth:intelOpsHandler,incoming:intelOpsHandler,eta:intelOpsHandler,status:intelOpsHandler,left:intelOpsHandler,plunders:intelOpsHandler,survey:intelOpsHandler,oprate:intelOpsHandler,kdecon:intelOpsHandler,econ:intelOpsHandler,tppa:intelOpsHandler},
 'spartan-calc':{thievery:thieveryHandler,attack:attackHandler,invest:investHandler,declare:declareLegalityHandler,spellcheck:spellcheckHandler,science:scienceHandler,'science-summary':scienceSummaryHandler},
 'spartan-war':{analyze:analyzeWarHandler,summary:warSummaryHandler,board:warBoardHandler,status:warHandler,target:targetHandler,ambush:ambushHandler,intel:intelHandler},
 'spartan-admin':{panel:adminHandler,logs:logsHandler,admins:adminsHandler,access:spartanAccessHandler,alerts:alertsHandler,broadcast:broadcastHandler}
};

for(const [command,subs] of Object.entries(COMMANDS))for(const [sub,handler] of Object.entries(subs)){if(!commandRegistry.has(command,sub))commandRegistry.register(command,sub,handler,{access:command==='spartan'&&sub==='register'?'public':command==='spartan'&&sub==='status'?'public':command==='spartan-admin'?'admin':'registered'});}

async function hasSpartanAccess(userId){return spartanAccess.hasAccess(userId);}

module.exports=async function commandHandler(interaction){
 const command=interaction.commandName;let sub='';try{sub=interaction.options.getSubcommand(false)||'';}catch(_){sub='';}
 const entry=commandRegistry.get(command,sub);
 console.log(`[SPARTAN COMMAND] /${command}${sub?` ${sub}`:''} entry=${entry?'found':'missing'}`);
 if(!entry)return interaction.reply({content:`❌ Unknown Spartan command: /${command}${sub?` ${sub}`:''}`,ephemeral:true});
 if(command!=='spartan'&&command!=='spartan-music'&&command!=='spartan-intel'&&command!=='spartan-calc'&&command!=='spartan-war'&&command!=='spartan-admin')return interaction.reply({content:'❌ This command surface has been retired. Use the new `/spartan` commands.',ephemeral:true});
 if(!commandAccess.canAccess(entry,interaction.user,permissionService))return interaction.reply({content:commandAccess.denialMessage(entry),ephemeral:true});
 if(entry.access==='registered'&&!permissionService.isOwner(interaction.user.id)&&!(await hasSpartanAccess(interaction.user.id)))return interaction.reply({content:'❌ Spartan access is required. Use `/spartan register`.',ephemeral:true});
 try{interaction.nexusIdentity=await nexusIdentity.resolve(interaction.user.id);}catch(e){interaction.nexusIdentity=null;}
 try{return await entry.handler(interaction);}catch(e){console.error(`[SPARTAN COMMAND] /${command} ${sub}`,e);if(!interaction.replied&&!interaction.deferred)return interaction.reply({content:`❌ ${e.message||'Spartan command failed.'}`,ephemeral:true});throw e;}
};
module.exports.commandRegistry=commandRegistry;
