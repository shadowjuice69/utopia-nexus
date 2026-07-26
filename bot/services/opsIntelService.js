const axios = require("axios");

const URL = "https://fcvozxmfocvrqfyrakbq.supabase.co/rest/v1/my_kd_ops";

async function getRecentOps() {
  try {
    const params = new URLSearchParams({
      select: "tick,timestamp,category,op,outcome,attacker_province,target_province,target_kingdom,result_value,unit,att_tpa_modified,def_tpa_modified,att_wpa_modified,def_wpa_modified,fail_units_lost,fail_units_lost_unit",
      order: "tick.desc",
      limit: "100"
    });

    const response = await axios.get(
      `${URL}?${params}`,
      {
        headers: {
          apikey: process.env.NICOLAIJ_OPS_KEY,
          Authorization: `Bearer ${process.env.NICOLAIJ_OPS_KEY}`
        }
      }
    );

    console.log(`[NICOLAIJ OPS RAW] ${response.data.length} records`);

    return response.data;

  } catch (error) {
    console.error("[OPS INTEL ERROR]", error.response?.data || error.message);
    return [];
  }
}

module.exports = {
  getRecentOps
};
