from pathlib import Path

p = Path('bot/services/intelReceiver.js')
s = p.read_text()
original = s

repls = [
('function parseIntel(url, prov, text, source="") {', 'function parseIntel(url, prov, text, source="", tab="") {'),
('const result = { url, prov, updated: new Date().toISOString() };', 'const result = { url, prov, tab: tab || "", source: source || "", updated: new Date().toISOString() };'),
('console.log("[DEBUG URL CHECK]", JSON.stringify(url), url.includes("kingdom_details"));', 'console.log("[DEBUG URL CHECK]", JSON.stringify(url), url.includes("kingdom_details"), "tab=", tab, "source=", source);\n  const routeTab = String(tab || "").toLowerCase();'),
('} else if (url.includes("throne") || url.includes("SPY_ON_THRONE")) {', '} else if (url.includes("throne") || url.includes("SPY_ON_THRONE") || routeTab === "throne") {'),
('} else if (url.includes("survey") || url.includes("council_internal") || url.includes("/build")) {', '} else if (url.includes("survey") || url.includes("council_internal") || url.includes("/build") || routeTab === "survey" || routeTab === "buildings") {'),
('} else if (url.includes("council_science") || url.includes("sciences") || url.includes("/science")) {', '} else if (url.includes("council_science") || url.includes("sciences") || url.includes("/science") || routeTab === "science") {'),
('} else if (url.includes("som") || url.includes("military")) {', '} else if (url.includes("som") || url.includes("military") || routeTab === "military" || routeTab === "armies") {'),
('} else if (url.includes("council_state") || url.includes("province_state")) {', '} else if (url.includes("council_state") || url.includes("province_state") || routeTab === "state") {'),
('} else if (url.includes("province_news") || url.includes("province_logs") || url.includes("kd_news") || url.includes("kingdom_news")) {', '} else if (url.includes("province_news") || url.includes("province_logs") || url.includes("kd_news") || url.includes("kingdom_news") || routeTab === "news") {'),
('} else if (url.includes("intel.utopia.site") || text.includes(\'"source":"intel-site-csv"\') || text.includes(\'"source":"intel-site"\') || prov === "intel-site") {', '} else if (url.includes("intel.utopia.site") || source === "intel-site" || source === "intel-site-csv" || text.includes(\'"source":"intel-site-csv"\') || text.includes(\'"source":"intel-site"\') || prov === "intel-site") {'),
('result.data = { text };', 'result.data = { text, raw: text };'),
('const parsed = parseIntel(url, prov, data_simple, source);', 'const parsed = parseIntel(url, prov, data_simple, source, tabParam);'),
]

for old, new in repls:
    if old not in s:
        raise SystemExit(f'Missing expected text: {old[:100]}')
    s = s.replace(old, new, 1)

marker = 'async function saveIntel(parsed, prov) {\n  const sb = supabaseService.getClient();\n  if (!sb) return;'
insert = '''async function saveRawPageIntel(sb, parsed, prov) {
  try {
    const { error } = await sb.from("intel_page_ingest").insert({
      kd_code: parsed.kd || MY_KD,
      province: prov || parsed.prov || null,
      source: parsed.source || null,
      tab: parsed.tab || null,
      url: parsed.url || null,
      data_type: parsed.type || "unknown",
      raw_text: parsed.data?.raw || parsed.data?.text || null,
      parsed: parsed.data || {}
    });
    if (error) logger.error(`[RAW PAGE SAVE ERROR] ${error.message}`);
    else logger.info(`[RAW PAGE SAVED] type=${parsed.type} tab=${parsed.tab || ""} kd=${parsed.kd || MY_KD} prov=${prov || ""}`);
  } catch (e) {
    logger.error(`[RAW PAGE SAVE CATCH] ${e.message}`);
  }
}

async function saveIntel(parsed, prov) {
  const sb = supabaseService.getClient();
  if (!sb) return;
  await saveRawPageIntel(sb, parsed, prov);'''
if marker not in s:
    raise SystemExit('saveIntel marker not found')
s = s.replace(marker, insert, 1)

p.write_text(s)
print('patched' if s != original else 'already patched')
