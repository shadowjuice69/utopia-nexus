import { useEffect, useState } from "react";

import {
  getAlerts,
  subscribeToAlerts
} from "../services/alertService";

function AlertTimeline() {
  const [alerts, setAlerts] = useState([]);

  async function loadAlerts() {
    const data = await getAlerts();
    setAlerts(data);
  }

  useEffect(() => {
    loadAlerts();

    const subscription = subscribeToAlerts(() => {
      loadAlerts();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <section className="panel">
      <h2>🚨 Alert Timeline</h2>

      {alerts.length === 0 && (
        <p>No active alerts</p>
      )}

      {alerts.map((alert, index) => (
        <div className="alert-item" key={index}>
          <strong>
            {alert.label || "Alert"}
          </strong>

          <p>
            Tick: {alert.ticks || "N/A"}
          </p>

          <small>
            {alert.message || "No message"}
          </small>
        </div>
      ))}
    </section>
  );
}

export default AlertTimeline;
