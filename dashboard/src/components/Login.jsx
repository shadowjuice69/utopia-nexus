import { useState } from "react";
import { getKingdomLabel } from "../services/nexusConfig";
import { supabase } from "../services/supabase";

const PASSWORD = "NikkoAce";

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

    const provinceName = province.trim();
    const { data, error } = await supabase
      .from("provinces")
      .select("name")
      .eq("name", provinceName)
      .limit(1)
      .maybeSingle();

    const registered = !error && !!data;
    if (registered && password === PASSWORD) {
      onAuth();
    } else {
      setErr(true);
      setTimeout(() => setErr(false), 2500);
    }

    setChecking(false);
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
          {err && <div className="login-error">Province not registered or password incorrect</div>}
          <button className="btn btn-gold" style={{ width: "100%" }} type="submit" disabled={checking}>
            {checking ? "Checking Registration..." : "Enter Command Center"}
          </button>
        </form>
      </div>
    </div>
  );
}
