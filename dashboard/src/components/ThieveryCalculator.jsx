import { useMemo, useState } from 'react';
import { AGE_116_DATA } from '../../../src/thievery/age-data/116.js';

const ages = { '116': AGE_116_DATA };

function ModifierText({ thievery }) {
  const items = Object.entries(thievery || {});
  if (!items.length) return <span className="thievery-neutral">No direct thievery modifier</span>;
  return items.map(([key, value]) => (
    <span key={key} className="thievery-modifier">{key}: {String(value)}</span>
  ));
}

function VerifiedList({ title, entries, selected, onSelect }) {
  return (
    <section className="thievery-selector-section">
      <h3>{title}</h3>
      <div className="thievery-option-grid">
        {Object.values(entries).map((entry) => {
          const active = selected === entry.name;
          return (
            <button
              type="button"
              key={entry.name}
              className={`thievery-option ${active ? 'selected' : ''}`}
              onClick={() => onSelect(entry.name)}
            >
              <span className="thievery-option-name">{entry.name}</span>
              <span className="thievery-verified" title={entry.verified ? 'Verified for this age' : 'Not verified'}>
                {entry.verified ? '✓' : '!' }
              </span>
              <span className="thievery-option-modifiers"><ModifierText thievery={entry.thievery} /></span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function ThieveryCalculator() {
  const [age, setAge] = useState('116');
  const data = ages[age];
  const [race, setRace] = useState('Faery');
  const [personality, setPersonality] = useState('Rogue');

  const selected = useMemo(() => ({
    race: data.races[race],
    personality: data.personalities[personality],
  }), [data, race, personality]);

  return (
    <div className="thievery-calculator">
      <div className="thievery-header">
        <div>
          <h2>Thievery Calculator</h2>
          <p>Age-specific race and personality data. Bonuses are applied only when verified.</p>
        </div>
        <label>
          Age
          <select value={age} onChange={(event) => setAge(event.target.value)}>
            {Object.keys(ages).map((value) => <option key={value} value={value}>Age {value}</option>)}
          </select>
        </label>
      </div>

      <div className="thievery-source-status">
        <span>{data.source.verified ? '✓' : '!'} Source verified</span>
        <span>{data.source.name}</span>
      </div>

      <VerifiedList title="Race" entries={data.races} selected={race} onSelect={setRace} />
      <VerifiedList title="Personality" entries={data.personalities} selected={personality} onSelect={setPersonality} />

      <section className="thievery-selection-summary">
        <h3>Selected modifiers</h3>
        <div><strong>{race}</strong> <span className="thievery-verified">✓</span> <ModifierText thievery={selected.race.thievery} /></div>
        <div><strong>{personality}</strong> <span className="thievery-verified">✓</span> <ModifierText thievery={selected.personality.thievery} /></div>
      </section>
    </div>
  );
}
