import { useState } from "react";
import { getKingdomLabel } from "../services/nexusConfig";

const PASSWORD = "NikkoAce";

export default function Login({ onAuth }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState(false);
  const kingdomLabel = getKingdomLabel();

  function submit(e) {
    e.preventDefault();
    if (val === PASSWORD) onAuth();
    else { setErr(true); setTimeout(() => setErr(false), 2000); }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">⚔</div>
        <div className="login-title">NEXUS</div>
        <div className="login-sub">{kingdomLabel}</div>
        <form onSubmit={submit}>
          <input className="login-input" type="password" placeholder="••••••••" value={val} onChange={e => setVal(e.target.value)} autoFocus />
          {err && <div className="login-error">Access denied</div>}
          <button className="btn btn-gold" style={{ width: "100%" }} type="submit">Enter Command Center</button>
        </form>
      </div>
    </div>
  );
}
