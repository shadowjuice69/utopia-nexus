function AlertPanel() {
  return (
    <section className="panel">
      <h2>🚨 Alert System</h2>

      <div className="alert-box">
        <div className="alert-item">
          <span>No active alerts</span>
          <small>Waiting for Nexus alert feed...</small>
        </div>
      </div>

      <div className="alert-status">
        ALERT MONITOR ONLINE
      </div>
    </section>
  );
}

export default AlertPanel;
