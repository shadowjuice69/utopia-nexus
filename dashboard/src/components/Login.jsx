import { useState } from "react";
import { getKingdomLabel } from "../services/nexusConfig";
import { getDashboardAuthorization } from "../services/auth";

export default function Login({ onAuth }) {
  const [province, setProvince] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(false);
  const [checking, setChecking] = useState(false);
  const kingdomLabel = getKingdomLabel();

  async function submit(e) {
    e.preventDefault();
    setErr(false);
    setChecking(true);

    try {
      const result = await getDashboardAuthorization(province, password);
      if (result.allowed) {
        onAuth(result);
      } else {
        setErr(true);
        setTimeout(() => setErr(false), 2500);
      }
    } catch {
      setErr(true);
      setTimeout(() => setErr(false), 2500);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">⚔</div>
        <div className="login-title">NEXUS</div>
        <div className="login-sub">{kingdomLabel}</div>
        <form onSubmit={submit}>
          <input
            className="login-input"
            type="text"
            placeholder="Province Name"
            value={province}
            onChange={e => setProvince(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
          <input
            className="login-input"
            type="password"
            placeholder="Dashboard Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {err && <div className="login-error">Access denied</div>}
          <button className="btn btn-gold" style={{ width: "100%" }} type="submit" disabled={checking}>
            {checking ? "Checking Authorization..." : "Enter Command Center"}
          </button>
        </form>
      </div>
    </div>
  );
}
