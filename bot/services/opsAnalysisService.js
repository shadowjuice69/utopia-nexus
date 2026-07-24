const supabaseService = require("./supabase");
const logger = require("./logger");

function getRating(score) {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "ELEVATED";
  return "LOW";
}

async function analyzeHostileProvince(province) {
  const supabase = supabaseService.getClient();

  if (!supabase) return null;

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [intelResult, hostileResult] = await Promise.all([
      supabase
        .from("intel_ops")
        .select("*")
        .eq("province", province),

      supabase
        .from("hostile_ops")
        .select("*")
        .eq("attacker_province", province)
        .gte("timestamp", since)
    ]);

    if (intelResult.error) throw intelResult.error;
    if (hostileResult.error) throw hostileResult.error;

    const intel = intelResult.data || [];
    const recentOps = hostileResult.data || [];

    if (intel.length === 0 && recentOps.length === 0) {
      return {
        province,
        threatScore: 0,
        rating: "LOW",
        reasons: ["No hostile activity found"]
      };
    }

    const totalOps = intel.reduce(
      (sum, op) => sum + (op.times_seen || 1),
      0
    );

    const successfulOps = recentOps.filter(
      op => op.success === true
    ).length;

    const successRate = recentOps.length
      ? Math.round((successfulOps / recentOps.length) * 100)
      : 0;

    const uniqueTargets = new Set(
      recentOps.map(op => op.target_province)
    ).size;

    const activityScore = Math.min(totalOps * 3, 30);
    const frequencyScore = Math.min(recentOps.length * 5, 25);
    const successScore = Math.min(Math.round(successRate / 4), 25);
    const targetScore = Math.min(uniqueTargets * 5, 20);

    const threatScore = Math.min(
      activityScore +
      frequencyScore +
      successScore +
      targetScore,
      100
    );

    const reasons = [];

    if (recentOps.length >= 5)
      reasons.push("High recent hostile activity");

    if (successRate >= 70)
      reasons.push("High operation success rate");

    if (uniqueTargets >= 3)
      reasons.push("Multiple provinces targeted");

    if (totalOps >= 10)
      reasons.push("Established hostile history");

    if (reasons.length === 0)
      reasons.push("Limited hostile activity");

    return {
      province,
      threatScore,
      rating: getRating(threatScore),
      factors: {
        activity: activityScore,
        frequency: frequencyScore,
        successRate: successScore,
        targetSpread: targetScore
      },
      statistics: {
        totalOps,
        recentOps: recentOps.length,
        successRate,
        uniqueTargets
      },
      reasons,
      operations: intel.map(op => op.operation)
    };

  } catch (err) {
    logger.error(`[OPS ANALYSIS ERROR] ${err.message}`);
    return null;
  }
}

module.exports = {
  analyzeHostileProvince
};
