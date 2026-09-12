const spartanAccess=require('../../services/spartanAccessService');
module.exports=async function spartanRegisterHandler(interaction){
 try{const row=await spartanAccess.register({userId:interaction.user.id,username:interaction.user.username,metadata:{guild_id:interaction.guildId,source:'discord-spartan-register'}});return interaction.reply({content:`🛡️ **Spartan registration**\nStatus: **${row.status}**\nRole: **${row.role}**\nYour Discord identity is connected to Spartan.`,ephemeral:true});}
 catch(error){console.error('[SPARTAN REGISTER]',error);return interaction.reply({content:`❌ ${error.message}`,ephemeral:true});}
};
