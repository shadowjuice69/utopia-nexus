const DEFAULT_KINGDOM = "Judo";
const DEFAULT_KD = "3:2";

function clean(value, fallback) {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

export function getNexusConfig() {
  return {
    kingdom: clean(import.meta.env.VITE_NEXUS_KINGDOM, DEFAULT_KINGDOM),
    kd: clean(import.meta.env.VITE_NEXUS_KD, DEFAULT_KD),
  };
}

export function getKingdomLabel() {
  const { kingdom, kd } = getNexusConfig();
  return `Kingdom ${kingdom} · ${kd}`;
}
