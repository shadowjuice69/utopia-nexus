from pathlib import Path

p = Path("services/warAnalysisService.js")
s = p.read_text()

if 'opsAnalysisService' not in s:
    s = s.replace(
        'const logger = require("./logger");',
        'const logger = require("./logger");\nconst opsAnalysisService = require("./opsAnalysisService");'
    )

s = s.replace(
    'const [attacks, hostileOps, intelMilitary, intelThrone] = await Promise.all([',
    'const [attacks, hostileOps, intelMilitary, intelThrone, intelOps] = await Promise.all(['
)

s = s.replace(
    'supabase.from("intel_throne").select("*").limit(20),',
    'supabase.from("intel_throne").select("*").limit(20),\n    supabase.from("intel_ops").select("*").limit(50),'
)

s = s.replace(
    'if (intelThrone.error) logger.error(`[INTEL THRONE ERROR] ${intelThrone.error.message}`);',
    'if (intelThrone.error) logger.error(`[INTEL THRONE ERROR] ${intelThrone.error.message}`);\n    if (intelOps.error) logger.error(`[INTEL OPS ERROR] ${intelOps.error.message}`);'
)

s = s.replace(
    'intelThrone: intelThrone.data || [],',
    'intelThrone: intelThrone.data || [],\n    intelOps: intelOps.data || [],'
)

s = s.replace(
    'const { attacks, hostileOps, intelMilitary, intelThrone } = data;',
    'const { attacks, hostileOps, intelMilitary, intelThrone, intelOps } = data;'
)

marker = 'const prompt = `You are a Utopia war strategist'
if 'const opsThreats = [];' not in s:
    s = s.replace(
        marker,
        '''const opsThreats = [];

for (const op of intelOps) {
  const analysis = await opsAnalysisService.analyzeHostileProvince(op.province);
  if (analysis) opsThreats.push(analysis);
}

''' + marker
    )

s = s.replace(
    'HOSTILE OPS (${hostileOps.length} total):',
    'HOSTILE OPS (${hostileOps.length} total):'
)

s = s.replace(
    '${opsSummary || "None"}',
    '${opsSummary || "None"}\\n\\nHOSTILE THREAT ANALYSIS:\\n${JSON.stringify(opsThreats, null, 2) || "None"}'
)

p.write_text(s)
print("warAnalysisService patched")
