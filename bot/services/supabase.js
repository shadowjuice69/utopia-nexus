require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const logger = require("./logger");

let supabase = null;

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
      auth: {
        persistSession: false,
      },
    }
  );

  logger.info("Supabase initialized");
} else {
  logger.info("Supabase credentials missing - disabled");
}

module.exports = {
  getClient() {
    return supabase;
  },

  isConnected() {
    return supabase !== null;
  },
};
