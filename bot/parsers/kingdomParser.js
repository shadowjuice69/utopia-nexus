function parseKingdom(text) {
  const result = {
    kd_code: null,
    kingdom_name: null,
    kd_name: null,
    total_provinces: null,
    total_nw: null,
    total_land: null,
    nw_rank: null,
    land_rank: null,
    provinces: []
  };

  const source = String(text || "");
  const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const number = (value) => {
    const n = parseInt(String(value || "").replace(/[^0-9-]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  };

  const kd = source.match(/\((\d+:\d+)\)/);
  if (kd) result.kd_code = kd[1];

  const name = source.match(/The kingdom of\s+(.+?)\s*\((\d+:\d+)\)/i);
  if (name) {
    result.kingdom_name = clean(name[1]);
    result.kd_name = result.kingdom_name;
    if (!result.kd_code) result.kd_code = name[2];
  }

  const totalProvinces = source.match(/Total Provinces:\s*([\d,]+)/i);
  const totalNw = source.match(/Total Networth:\s*([\d,]+)gc/i);
  const totalLand = source.match(/Total Land:\s*([\d,]+)\s*acres?/i);
  const nwRank = source.match(/Networth Rank:\s*([\d,]+)\s+of\s+([\d,]+)/i);
  const landRank = source.match(/Land Rank:\s*([\d,]+)\s+of\s+([\d,]+)/i);

  result.total_provinces = totalProvinces ? number(totalProvinces[1]) : null;
  result.total_nw = totalNw ? number(totalNw[1]) : null;
  result.total_land = totalLand ? number(totalLand[1]) : null;
  result.nw_rank = nwRank ? number(nwRank[1]) : null;
  result.land_rank = landRank ? number(landRank[1]) : null;

  // Text fallback for kingdom pages where the DOM table has already been flattened.
  const lines = source.split(/\r?\n/).map(clean).filter(Boolean);
  for (const line of lines) {
    if (!result.kd_code && /\(\d+:\d+\)/.test(line)) {
      const m = line.match(/\((\d+:\d+)\)/);
      if (m) result.kd_code = m[1];
    }
  }

  return result;
}

module.exports = { parseKingdom };
