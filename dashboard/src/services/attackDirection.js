export function isOutgoingAttack(attack, kingdomCode) {
  if (attack?.attack_type === "incoming") return false;
  if (attack?.attack_type === "traditional" || attack?.attack_type === "ambush") return true;
  return Boolean(kingdomCode && attack?.kd_code === kingdomCode);
}
