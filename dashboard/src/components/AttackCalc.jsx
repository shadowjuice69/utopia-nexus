import { useState } from "react";

// Age 116 Avian/War Hero unit stats
const MY_UNITS = {
  soldiers: { off: 3, def: 0, label: "Soldiers (3/0)" },
  off_specs: { off: 12, def: 0, label: "Off Specs (12/0)" },
  elites: { off: 16, def: 2, label: "Elites (16/2)" },
  mercs: { off: 8, def: 0, label: "Mercs (8/0)" },
  prisoners: { off: 8, def: 0, label: "Prisoners (8/0)" },
};

function calcOffense(units, generals, ome, bloodlust, diveBomb) {
  const specOff = diveBomb ? 14 : 12; // Dive Bomb: +2 off spec in war
  const raw =
    (units.soldiers || 0) * 3 +
    (units.off_specs || 0) * specOff +
    (units.elites || 0) * 16 +
    (units.mercs || 0) * 8 +
    (units.prisoners || 0) * 8;

  const genBonus = 1 + (Math.max(generals, 1) - 1) * 0.05;
  const blBonus = bloodlust ? 1.1 : 1.0;
  const omeMulti = ome / 100;

  return Math.round(raw * genBonus * omeMulti * blBonus);
}

function successChance(myOff, theirDef) {
  if (theirDef === 0) return 100;
  const ratio = myOff / theirDef;
  if (ratio >= 1.0) return Math.min(100, Math.round(75 + (ratio - 1.0) * 50));
  if (ratio >= 0.75) return Math.round((ratio - 0.75) / 0.25 * 75);
  return 0;
}

function acresGained(myNW, theirNW, theirAcres, traditional) {
  if (!theirAcres) return null;
  const nwRatio = myNW / theirNW;
  const baseGain = traditional ? 0.08 : 0.05;
  const nwMod = nwRatio > 1 ? Math.max(0.5, 1 - (nwRatio - 1) * 0.5) : 1 + (1 - nwRatio) * 0.5;
  return Math.round(theirAcres * baseGain * nwMod);
}

function InputRow({ label, value, onChange, min = 0, max, step = 1, suffix = "" }) {
  return (
    <div className="calc-row">
      <label className="calc-label">{label}</label>
      <div className="calc-input-wrap">
        <input
          type="number"
          className="calc-input"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
        />
        {suffix && <span className="calc-suffix">{suffix}</span>}
      </div>
    </div>
  );
}

export default function AttackCalc() {
  const [units, setUnits] = useState({ soldiers: 0, off_specs: 0, elites: 0, mercs: 0, prisoners: 0 });
  const [generals, setGenerals] = useState(1);
  const [ome, setOme] = useState(100);
  const [bloodlust, setBloodlust] = useState(false);
  const [diveBomb, setDiveBomb] = useState(false);
  const [theirDef, setTheirDef] = useState(0);
  const [theirAcres, setTheirAcres] = useState(0);
  const [myNW, setMyNW] = useState(0);
  const [theirNW, setTheirNW] = useState(0);
  const [traditional, setTraditional] = useState(true);

  const myOff = calcOffense(units, generals, ome, bloodlust, diveBomb);
  const myOffNoBL = calcOffense(units, generals, ome, false, diveBomb);
  const chance = successChance(myOff, theirDef);
  const acres = acresGained(myNW, theirNW, theirAcres, traditional);

  const generalAuthority = generals >= 2;
  const chanceColor = chance >= 80 ? "#4ade80" : chance >= 50 ? "#facc15" : "#f87171";

  const specLabel = diveBomb ? "Off Specs (14/0 ⚡ Dive Bomb)" : "Off Specs (12/0)";

  function setUnit(key, val) {
    setUnits(u => ({ ...u, [key]: Math.max(0, val) }));
  }

  return (
    <div className="calc-panel">
      <div className="calc-grid">

        {/* My Forces */}
        <div className="panel">
          <h2>⚔️ My Forces</h2>

          <div className="calc-section-label">Units Sent</div>

          <InputRow label="Soldiers (3/0)" value={units.soldiers} onChange={v => setUnit("soldiers", v)} />
          <InputRow label={specLabel} value={units.off_specs} onChange={v => setUnit("off_specs", v)} />
          <InputRow label="Elites (16/2)" value={units.elites} onChange={v => setUnit("elites", v)} />
          <InputRow label="Mercs (8/0)" value={units.mercs} onChange={v => setUnit("mercs", v)} />
          <InputRow label="Prisoners (8/0)" value={units.prisoners} onChange={v => setUnit("prisoners", v)} />

          <div className="calc-divider" />

          <InputRow label="Generals" value={generals} onChange={setGenerals} min={1} max={5} />
          <InputRow label="OME%" value={ome} onChange={setOme} min={50} max={150} suffix="%" />

          <div className="calc-toggle-row">
            <label className="calc-label">Bloodlust</label>
            <button
              className={`toggle-btn ${bloodlust ? "on" : "off"}`}
              onClick={() => setBloodlust(b => !b)}
            >
              {bloodlust ? "✅ ON" : "❌ OFF"}
            </button>
          </div>

          <div className="calc-toggle-row">
            <label className="calc-label">Dive Bomb (War)</label>
            <button
              className={`toggle-btn ${diveBomb ? "on" : "off"}`}
              onClick={() => setDiveBomb(d => !d)}
            >
              {diveBomb ? "✅ ON (+2 spec off)" : "❌ OFF"}
            </button>
          </div>

          <div className="calc-toggle-row">
            <label className="calc-label">Attack Type</label>
            <button
              className={`toggle-btn ${traditional ? "on" : "off"}`}
              onClick={() => setTraditional(t => !t)}
            >
              {traditional ? "⚔️ Traditional" : "🏹 Ambush"}
            </button>
          </div>

          <div className="calc-divider" />
          <div className="calc-result-row">
            <span className="calc-result-label">Raw Offense</span>
            <span className="calc-result-value" style={{ color: "#38bdf8" }}>
              {myOff.toLocaleString()}
            </span>
          </div>
          {bloodlust && (
            <div className="calc-result-row">
              <span className="calc-result-label">Without BL</span>
              <span className="calc-result-value" style={{ color: "#64748b" }}>
                {myOffNoBL.toLocaleString()}
              </span>
            </div>
          )}
          {generalAuthority && (
            <div className="calc-note">
              ✅ General's Authority active (+15% kills)
            </div>
          )}
          {diveBomb && (
            <div className="calc-note" style={{ color: "#38bdf8" }}>
              ⚡ Dive Bomb active — Off Specs +2 offense (war only)
            </div>
          )}
        </div>

        {/* Target */}
        <div className="panel">
          <h2>🎯 Target</h2>

          <div className="calc-section-label">Target Stats</div>
          <InputRow label="Their Defense" value={theirDef} onChange={setTheirDef} />
          <InputRow label="Their Acres" value={theirAcres} onChange={setTheirAcres} />
          <InputRow label="Their NW" value={theirNW} onChange={setTheirNW} />
          <InputRow label="My NW" value={myNW} onChange={setMyNW} />

          <div className="calc-divider" />

          {/* Results */}
          <div className="calc-section-label">Results</div>

          <div className="calc-result-big">
            <span className="calc-result-label">Success Chance</span>
            <span className="calc-result-big-value" style={{ color: chanceColor }}>
              {chance}%
            </span>
            <div className="chance-bar-bg">
              <div className="chance-bar-fill" style={{ width: `${chance}%`, background: chanceColor }} />
            </div>
          </div>

          {acres !== null && (
            <div className="calc-result-row">
              <span className="calc-result-label">Acres Gained</span>
              <span className="calc-result-value" style={{ color: "#4ade80" }}>~{acres}</span>
            </div>
          )}

          <div className="calc-result-row">
            <span className="calc-result-label">Off vs Def</span>
            <span className="calc-result-value" style={{ color: "#94a3b8" }}>
              {myOff.toLocaleString()} vs {theirDef.toLocaleString()}
            </span>
          </div>

          <div className="calc-result-row">
            <span className="calc-result-label">Ratio</span>
            <span className="calc-result-value" style={{ color: chanceColor }}>
              {theirDef > 0 ? (myOff / theirDef).toFixed(2) : "∞"}x
            </span>
          </div>

          {bloodlust && (
            <div className="calc-result-row">
              <span className="calc-result-label">BL Kill Bonus</span>
              <span className="calc-result-value" style={{ color: "#fb923c" }}>+15% kills</span>
            </div>
          )}

          {generalAuthority && (
            <div className="calc-result-row">
              <span className="calc-result-label">GA Kill Bonus</span>
              <span className="calc-result-value" style={{ color: "#a78bfa" }}>+15% kills</span>
            </div>
          )}

          <div className="calc-divider" />

          {/* Recommendation */}
          <div className={`calc-recommendation ${chance >= 80 ? "go" : chance >= 50 ? "risky" : "no"}`}>
            {chance >= 80 ? "✅ GO — High confidence attack" :
             chance >= 65 ? "⚠️ RISKY — Add 3% troops for safety" :
             chance >= 50 ? "⚠️ BORDERLINE — Consider more troops" :
             "❌ DO NOT ATTACK — Insufficient offense"}
          </div>
        </div>

      </div>
    </div>
  );
}
