import { useEffect, useState } from "react";
import { supabase } from "../services/supabase";

const TICK_START_UTC = 19;

function getCurrentTick() {
  const now = new Date();
  return ((now.getUTCHours() - TICK_START_UTC) % 24 + 24) % 24 + 1;
}

function tickToUTCHour(tick) {
  return ((TICK_START_UTC + tick - 1) % 24);
}

function formatUTCHour(h) {
  return `${h.toString().padStart(2, "0")}:00`;
}

export default function AlertPanel() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTick, setCurrentTick] = useState(getCurrentTick());

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(() => setCurrentTick(getCurrentTick()), 10000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAlerts() {
    const { data } = await supabase
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false });
    setAlerts(data || []);
    setLoading(false);
  }

  if (loading) return <div className="loading">⏳ Loading Alerts...</div>;

  const active = alerts.filter(a => a.active);
  const inactive = alerts.filter(a => !a.active);

  return (
    <div className="alert-panel">

      {/* Status Bar */}
      <div className="alert-status-bar">
        <div className="alert-status-item">
          <span className="ast-label">CURRENT TICK</span>
          <span className="ast-value" style={{ color: "#38bdf8" }}>{currentTick}</span>
        </div>
        <div className="alert-status-item">
          <span className="ast-label">ACTIVE ALERTS</span>
          <span className="ast-value" style={{ color: active.length > 0 ? "#4ade80" : "#475569" }}>{active.length}</span>
        </div>
        <div className="alert-status-item">
          <span className="ast-label">MONITOR</span>
          <span className="ast-value" style={{ color: "#4ade80" }}>● ONLINE</span>
        </div>
      </div>

      {/* Active Alerts */}
      <div className="panel">
        <h2>🔔 Active Alerts ({active.length})</h2>
        {active.length === 0 ? (
          <p className="empty">No active alerts configured. Use /admin setalert in Discord.</p>
        ) : (
          <div className="alert-list">
            {active.map(alert => {
              const firesNext = alert.ticks?.find(t => t > currentTick) || alert.ticks?.[0];
              const nextUTC = firesNext ? formatUTCHour(tickToUTCHour(firesNext)) : "—";
              const firesThisTick = alert.ticks?.includes(currentTick);
              return (
                <div key={alert.id} className={`alert-card ${firesThisTick ? "firing" : ""}`}>
                  <div className="alert-card-header">
                    <span className="alert-card-label">{firesThisTick ? "🔴" : "🟡"} {alert.label}</span>
                    <span className="alert-card-next">Next: Tick {firesNext} ({nextUTC} UTC)</span>
                  </div>
                  <div className="alert-card-message">{alert.message}</div>
                  <div className="alert-card-footer">
                    <span className="alert-ticks-label">Fires at ticks:</span>
                    <div className="alert-tick-chips">
                      {alert.ticks?.map(t => (
                        <span
                          key={t}
                          className={`tick-chip ${t === currentTick ? "now" : ""}`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    {alert.ping_role && (
                      <span className="alert-ping">🔔 Pings role</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 24h Alert Timeline */}
      <div className="panel">
        <h2>📅 Alert Timeline — All 24 Ticks</h2>
        <div className="timeline">
          {Array.from({ length: 24 }, (_, i) => i + 1).map(tick => {
            const tickAlerts = active.filter(a => a.ticks?.includes(tick));
            const isCurrent = tick === currentTick;
            return (
              <div key={tick} className={`timeline-tick ${isCurrent ? "current" : ""} ${tickAlerts.length > 0 ? "has-alerts" : ""}`}>
                <div className="tl-tick-num">{tick}</div>
                <div className="tl-utc">{formatUTCHour(tickToUTCHour(tick))}</div>
                <div className="tl-alerts">
                  {tickAlerts.map(a => (
                    <div key={a.id} className="tl-alert-dot" title={a.label}>
                      {a.label.slice(0, 6)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Inactive Alerts */}
      {inactive.length > 0 && (
        <div className="panel">
          <h2>⏸️ Inactive Alerts ({inactive.length})</h2>
          <div className="alert-list">
            {inactive.map(alert => (
              <div key={alert.id} className="alert-card inactive">
                <div className="alert-card-header">
                  <span className="alert-card-label">⚫ {alert.label}</span>
                  <span className="alert-card-next" style={{ color: "#334155" }}>Disabled</span>
                </div>
                <div className="alert-card-message" style={{ color: "#334155" }}>{alert.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
