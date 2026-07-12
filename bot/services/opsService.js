const supabaseService = require("./supabase");
const supabase = supabaseService.getClient();

async function saveOpsMessage(data) {
  const { error } = await supabase
    .from("bot_ops_messages")
    .insert([
      {
        msg_id: data.msgId,
        timestamp: new Date().toISOString(),
        content: data.message,
        kd_code: data.kdCode || null
      }
    ]);

  if (error) {
    console.error("[OPS SERVICE ERROR]", error.message);
    return false;
  }

  console.log("[OPS STORED]", data.message);
  return true;
}

module.exports = {
  saveOpsMessage
};
