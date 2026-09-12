const { REST, Routes } = require('discord.js');

const spartanCommand={name:'spartan',description:'Spartan command and access center',options:[
{name:'register',description:'Register this Discord identity for Spartan',type:1},
{name:'status',description:'Show your Spartan access status',type:1},
{name:'ask',description:'Ask Spartan AI',type:1,options:[{name:'question',description:'Your question',type:3,required:true,max_length:2000}]},
{name:'access',description:'Admin access control',type:1,options:[{name:'action',description:'Access action',type:3,required:true,choices:[{name:'grant',value:'grant'},{name:'suspend',value:'suspend'},{name:'revoke',value:'revoke'}]},{name:'user',description:'Discord user',type:6,required:true},{name:'reason',description:'Reason',type:3,required:false,max_length:500}]},
{name:'help',description:'Show Spartan commands',type:1}
]};

const musicCommand={name:'spartan-music',description:'Spartan music',options:[{name:'join',description:'Join your voice channel',type:1},{name:'play',description:'Play or queue a track',type:1,options:[{name:'query',description:'Song or URL',type:3,required:true}]},{name:'pause',description:'Pause playback',type:1},{name:'resume',description:'Resume playback',type:1},{name:'skip',description:'Skip track',type:1},{name:'stop',description:'Stop playback',type:1},{name:'queue',description:'Show queue',type:1},{name:'nowplaying',description:'Show current track',type:1},{name:'volume',description:'Set volume',type:1,options:[{name:'level',description:'0-100',type:4,required:true,min_value:0,max_value:100}]}]};

const intelCommand={name:'spartan-intel',description:'Spartan intelligence',options:[
{name:'check',description:'Intel coverage',type:1},{name:'capturehealth',description:'Capture health',type:1},{name:'incoming',description:'Incoming armies',type:1},{name:'eta',description:'Returning armies',type:1},{name:'status',description:'Province status',type:1},{name:'left',description:'Kingdom offense',type:1},{name:'plunders',description:'Plunder candidates',type:1},{name:'survey',description:'Building survey',type:1,options:[{name:'province',description:'Province',type:3,required:true}]},{name:'oprate',description:'Operation rates',type:1},{name:'kdecon',description:'Kingdom economy',type:1},{name:'econ',description:'Province economy',type:1},{name:'tppa',description:'Kingdom density',type:1} ]};

const calcCommand={name:'spartan-calc',description:'Spartan calculators',options:[{name:'thievery',description:'Thievery calculator',type:1},{name:'attack',description:'Attack calculator',type:1},{name:'invest',description:'Science investment planner',type:1},{name:'declare',description:'Legality checker',type:1},{name:'spellcheck',description:'Spell checker',type:1},{name:'science',description:'Science calculator',type:1},{name:'science-summary',description:'Science summary',type:1}]};

const warCommand={name:'spartan-war',description:'Spartan war operations',options:[{name:'analyze',description:'Analyze war',type:1},{name:'summary',description:'War summary',type:1},{name:'board',description:'War board',type:1},{name:'status',description:'War status',type:1},{name:'target',description:'Target operations',type:1},{name:'ambush',description:'Ambush planning',type:1},{name:'intel',description:'War intelligence',type:1}]};

const adminCommand={name:'spartan-admin',description:'Spartan administration',options:[{name:'panel',description:'Admin panel',type:1},{name:'logs',description:'Access logs',type:1},{name:'admins',description:'Manage administrators',type:1},{name:'access',description:'Manage Spartan access',type:1},{name:'alerts',description:'Manage alerts',type:1},{name:'broadcast',description:'Broadcast through Spartan',type:1}]};

const topLevel=[];

async function register(client){
 const token=process.env.DISCORD_TOKEN;const clientId=process.env.CLIENT_ID;if(!token||!clientId)throw new Error('DISCORD_TOKEN and CLIENT_ID are required for command registration.');
 const rest=new REST({version:'10'}).setToken(token);const guildIds=[process.env.GUILD_ID||'1534817549374455848'];
 for(const guildId of guildIds){const route=Routes.applicationGuildCommands(clientId,guildId);await rest.put(route,{body:[spartanCommand,musicCommand,intelCommand,calcCommand,warCommand,adminCommand,...topLevel]});console.log(`[SPARTAN COMMANDS] Fresh command surface registered for guild ${guildId}`);}
}
module.exports={register,spartanCommand,musicCommand,intelCommand,calcCommand,warCommand,adminCommand,topLevel};
