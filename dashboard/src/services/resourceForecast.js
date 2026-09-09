import { supabase } from "./supabase";
import { loadNexusConfig } from "./nexusConfig";

const TICKS_PER_DAY = 24;
const RATE_MAX_AGE_HOURS = 72;
const RATE_WARNING_AGE_HOURS = 24;
const DEFAULT_DRAFTS = [
  { label: "Emergency", rate: 2.0 },
  { label: "Aggressive", rate: 1.6 },
];
const DEFAULT_DRAFT_COST = 41;

const num = value => {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/,/g, "").replace(/%/g, ""));
  return Number.isFinite(n) ? n : null;
};

function ageHours(value) {
  if (!value) return Infinity;
  const ms = Date.now() - new Date(value).getTime();
  return Number.isFinite(ms) ? Math.max(0, ms / 3600000) : Infinity;
}

function newest(rows) {
  return rows.reduce((best, row) => !best || new Date(row.received_at || row.updated_at) > new Date(best.received_at || best.updated_at) ? row : best, null);
}

function linearRate(rows, field) {
  const usable = rows.filter(r => num(r[field]) != null && r.received_at).sort((a, b) => new Date(a.received_at) - new Date(b.received_at));
  if (usable.length < 2) return null;
  const a = usable[usable.length - 2];
  const b = usable[usable.length - 1];
  const hours = (new Date(b.received_at) - new Date(a.received_at)) / 3600000;
  if (!(hours > 0)) return null;
  return { perTick: (num(b[field]) - num(a[field])) / hours, measuredHours: hours, from: a, to: b };
}

function stateRate(state, field, divisor = TICKS_PER_DAY) {
  const direct = num(state?.[`${field}_yesterday`]);
  const month = num(state?.[`${field}_month`]);
  if (direct != null) return direct / divisor;
  if (month != null) return month / (30 * divisor);
  return null;
}

function projectLinear(current, rate, ticks) {
  return Math.max(0, Math.round(current + rate * ticks));
}

function projectDraft(peasants, army, ratePct, ticks) {
  let p = Math.max(0, Math.round(peasants));
  let a = Math.max(0, Math.round(army));
  let drafted = 0;
  for (let i = 0; i < ticks; i++) {
    const d = Math.min(p, Math.max(0, Math.floor(p * ratePct / 100)));
    drafted += d;
    p -= d;
    a += d;
  }
  return { drafted, peasants: p, army: a };
}

function resourceResult(label, current, rate, ticks) {
  const fresh = rate && ageHours(rate.to?.received_at) <= RATE_MAX_AGE_HOURS;
  return {
    label,
    current,
    rate: fresh ? rate.perTick : null,
    measuredHours: rate?.measuredHours || null,
    at24: fresh ? projectLinear(current, rate.perTick, ticks) : null,
    at48: fresh ? projectLinear(current, rate.perTick, ticks * 2) : null,
    ageHours: rate?.to ? ageHours(rate.to.received_at) : Infinity,
  };
}

export async function loadResourceForecast() {
  const config = await loadNexusConfig();
  const kd = config?.kd;
  const province = config?.province;
  if (!kd || !province) throw new Error("No current province context is configured");

  const [{ data: states, error: stateError }, { data: provinces, error: provinceError }] = await Promise.all([
    supabase.from("intel_game_state").select("*").eq("kd_code", kd).eq("province", province).order("received_at", { ascending: false }).limit(20),
    supabase.from("provinces").select("name,kd_code,peons,soldiers,state_data,updated_at").eq("kd_code", kd).eq("name", province).limit(1),
  ]);
  if (stateError) throw new Error(`intel_game_state: ${stateError.message}`);
  if (provinceError) throw new Error(`provinces: ${provinceError.message}`);

  const rows = states || [];
  const p = provinces?.[0] || {};
  const latest = newest(rows) || {};
  const state = p.state_data || {};
  const current = {
    gold: num(latest.money),
    food: num(latest.food),
    runes: num(latest.runes),
    peasants: num(latest.peasants ?? p.peons ?? state.peasants),
    soldiers: num(latest.soldier_count ?? p.soldiers ?? state.army),
    acres: num(latest.land ?? p.acres ?? state.land),
  };

  const goldRate = linearRate(rows, "money") || (num(state.daily_income) != null ? { perTick: num(state.daily_income) / TICKS_PER_DAY, measuredHours: null, to: { received_at: p.updated_at } } : null);
  const foodRate = linearRate(rows, "food") || (stateRate(state, "food_net") != null ? { perTick: stateRate(state, "food_net"), measuredHours: null, to: { received_at: p.updated_at } } : null);
  const runeRate = linearRate(rows, "runes") || (stateRate(state, "runes_net") != null ? { perTick: stateRate(state, "runes_net"), measuredHours: null, to: { received_at: p.updated_at } } : null);

  const resources = [
    resourceResult("Gold", current.gold, goldRate, 24),
    resourceResult("Food", current.food, foodRate, 24),
    resourceResult("Runes", current.runes, runeRate, 24),
  ];

  const draftCost = DEFAULT_DRAFT_COST;
  const draft = DEFAULT_DRAFTS.map(spec => ({
    ...spec,
    at24: projectDraft(current.peasants || 0, current.soldiers || 0, spec.rate, 24),
    at48: projectDraft(current.peasants || 0, current.soldiers || 0, spec.rate, 48),
  })).map(x => ({ ...x, gold24: x.at24.drafted * draftCost, gold48: x.at48.drafted * draftCost }));

  const rateDates = [goldRate?.to?.received_at, foodRate?.to?.received_at, runeRate?.to?.received_at].filter(Boolean);
  const oldestRateHours = rateDates.length ? Math.max(...rateDates.map(ageHours)) : Infinity;

  return {
    kd,
    province,
    loadedAt: new Date().toISOString(),
    current,
    resources,
    draft,
    rateStatus: oldestRateHours > RATE_MAX_AGE_HOURS ? "stale" : oldestRateHours > RATE_WARNING_AGE_HOURS ? "warning" : "fresh",
    oldestRateHours,
    rules: { ticksPerDay: TICKS_PER_DAY, warningHours: RATE_WARNING_AGE_HOURS, maxHours: RATE_MAX_AGE_HOURS, draftCost, draftSpecs: DEFAULT_DRAFTS },
    sourceCount: rows.length,
    sourceLatest: latest.received_at || p.updated_at || null,
  };
}
