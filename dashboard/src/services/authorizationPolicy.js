export function evaluateAuthorization({
  authenticated,
  provinceName,
  password,
  registeredProvince,
  isOwner,
  expectedPassword,
}) {
  if (!authenticated) {
    return { allowed: false, reason: "unauthenticated", owner: false };
  }

  if (isOwner) {
    return { allowed: true, reason: "owner-emergency", owner: true };
  }

  const requested = String(provinceName ?? "").trim();
  const registered = registeredProvince && String(registeredProvince.name ?? "").trim() === requested;

  if (!registered) {
    return { allowed: false, reason: "unregistered", owner: false };
  }

  if (password !== expectedPassword) {
    return { allowed: false, reason: "password", owner: false };
  }

  return { allowed: true, reason: "registered", owner: false };
}
