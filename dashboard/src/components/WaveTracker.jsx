function WaveTracker() {
  return (
    <section className="panel">
      <h2>🌊 Wave Tracker</h2>

      <div className="wave-info">
        <p>Current Wave: <strong>None</strong></p>
        <p>Targets Assigned: <strong>0</strong></p>
        <p>Completed Hits: <strong>0</strong></p>
      </div>

      <div className="progress-container">
        <div className="progress-bar"></div>
      </div>

      <small>
        Waiting for wave assignments...
      </small>
    </section>
  );
}

export default WaveTracker;
