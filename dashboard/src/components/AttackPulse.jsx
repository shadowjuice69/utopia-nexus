function AttackPulse() {
  return (
    <section className="panel">
      <h2>⚔️ Attack Pulse</h2>

      <div className="stats">
        <div>
          <span>Attacks</span>
          <strong>0</strong>
        </div>

        <div>
          <span>Success</span>
          <strong>0%</strong>
        </div>

        <div>
          <span>Failures</span>
          <strong>0</strong>
        </div>
      </div>

      <div className="graph-placeholder">
        Battle activity graph loading...
      </div>
    </section>
  );
}

export default AttackPulse;
