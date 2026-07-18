import { useState } from "react";

const CORRECT_PASSWORD = import.meta.env.VITE_DASHBOARD_PASSWORD;

export default function Login({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit() {
    if (password === CORRECT_PASSWORD) {
      localStorage.setItem("nexus_auth", "true");
      onLogin();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">⚔️</div>
        <h1 className="login-title">UTOPIA NEXUS</h1>
        <p className="login-sub">Kingdom Command Center</p>
        <input
          className={`login-input ${error ? "error" : ""}`}
          type="password"
          placeholder="Enter access code..."
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSubmit()}
          autoFocus
        />
        {error && <p className="login-error">❌ Invalid access code</p>}
        <button className="login-btn" onClick={handleSubmit}>
          ACCESS NEXUS
        </button>
      </div>
    </div>
  );
}
