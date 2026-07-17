require("dotenv").config();

const axios = require("axios");

async function check() {
  const url = process.env.SUPABASE_URL + "/rest/v1/";

  const res = await axios.get(url, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
    }
  });

  console.log(JSON.stringify(res.data.definitions, null, 2));
}

check().catch(err => console.log(err.message));
