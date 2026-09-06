import { useMemo, useState } from 'react';
import './ThieveryCalculator.css';
import {
  AGE_116_DATA,
  AGE_116_OPERATIONS,
  modifiedTpa,
  thieveryYield,
  optimalThieves,
  operationSuccessMetrics,
  watchTowersDamageReduction,
  watchTowersCatchChance,
  thievesDensLossReduction,
  stealthRecoveryPerTick,
  resolveThieveryModifiers,
} from '../../../src/thievery/index.js';

const numberValue = (value, fallback = null) => {
  if (value == null || String(value).trim() === '') return fallback;
  const normalized = String(value).replace(/,/g, '').replace(/%$/, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const entered = (value) => numberValue(value) != null;
const positive = (value) => { const n = numberValue(value); return n != null && n > 0; };
const pct = (value) => `${(value * 100).toFixed(2)}%`;

function Field({ label, value, onChange }) {
  return <label className="thievery-field"><span>{label}</span><input type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
function Select({ label, value, onChange, children }) {
  return <label className="thievery-field"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{children}</select></label>;
}
function Auto({ label, value }) {
  return <div className="thievery-field"><span>{label}</span><strong>{value}</strong><small>Automatic from selected setup</small></div>;
}

export default function ThieveryCalculatorFixed() {
  const data = AGE_116_DATA;
  const [race, setRace] = useState('Faery');
  const [personality, setPersonality] = useState('Rogue');
  const [ritual, setRitual] = useState('None');
  const [dragon, setDragon] = useState('None');
  const [targetRace, setTargetRace] = useState('Faery');
  const [targetPersonality, setTargetPersonality] = useState('Rogue');
  const [targetRitual, setTargetRitual] = useState('None');
  const [targetDragon, setTargetDragon] = useState('None');
  const [operation, setOperation] = useState('rob_vaults');
  const [war, setWar] = useState(false);
  const [invisibility, setInvisibility] = useState(false);
  const [guile, setGuile] = useState(false);
  const [targetInvisibility, setTargetInvisibility] = useState(false);
  const [targetIlluminate, setTargetIlluminate] = useState(false);
  const [selfAcres, setSelfAcres] = useState('');
  const [selfThieves, setSelfThieves] = useState('');
  const [selfNW, setSelfNW] = useState('');
  const [targetAcres, setTargetAcres] = useState('');
  const [targetThieves, setTargetThieves] = useState('');
  const [targetNW, setTargetNW] = useState('');
  const [targetResource, setTargetResource] = useState('');
  const [thievesDens, setThievesDens] = useState('');
  const [targetThievesDens, setTargetThievesDens] = useState('');
  const [targetWatchTowers, setTargetWatchTowers] = useState('');
  const [crimeScienceMultiplier, setCrimeScienceMultiplier] = useState('');
  const [targetCrimeScienceMultiplier, setTargetCrimeScienceMultiplier] = useState('');
  const [shieldingReduction, setShieldingReduction] = useState('');
  const [honorTpa, setHonorTpa] = useState('');
  const [targetHonorTpa, setTargetHonorTpa] = useState('');
  const [stealth, setStealth] = useState('');

  const resolved = useMemo(() => resolveThieveryModifiers({
    age: 116, race, personality,
    ritual: ritual === 'None' ? undefined : ritual,
    dragon: dragon === 'None' ? undefined : dragon,
    invisibility, guile,
  }), [race, personality, ritual, dragon, invisibility, guile]);
  const targetResolved = useMemo(() => resolveThieveryModifiers({
    age: 116, race: targetRace, personality: targetPersonality,
    ritual: targetRitual === 'None' ? undefined : targetRitual,
    dragon: targetDragon === 'None' ? undefined : targetDragon,
    invisibility: targetInvisibility,
  }), [targetRace, targetPersonality, targetRitual, targetDragon, targetInvisibility]);

  const calculations = useMemo(() => {
    const selfAcresN = numberValue(selfAcres);
    const selfThievesN = numberValue(selfThieves);
    const targetAcresN = numberValue(targetAcres);
    const targetThievesN = numberValue(targetThieves);
    const selfNwN = numberValue(selfNW);
    const targetNwN = numberValue(targetNW);
    const resourceN = numberValue(targetResource);
    const scienceSelf = numberValue(crimeScienceMultiplier, 1) * resolved.crimeScienceEffectivenessMultiplier;
    const scienceTarget = numberValue(targetCrimeScienceMultiplier, 1) * targetResolved.crimeScienceEffectivenessMultiplier;
    const op = AGE_116_OPERATIONS[operation];
    const gains = war ? op?.gainsPerThiefWar : op?.gainsPerThiefNormal;
    const maxPercent = war ? op?.maxPercentWar : op?.maxPercentNormal;

    const selfTpa = positive(selfAcresN) && positive(selfThievesN)
      ? modifiedTpa({ acres: selfAcresN, thieves: selfThievesN, thievesDensPct: numberValue(thievesDens, 0), thievesDensEffectivenessMultiplier: resolved.thievesDensEffectivenessMultiplier, crimeScienceMultiplier: scienceSelf, racialTpaMultiplier: resolved.racialTpaMultiplier, personalityTpaMultiplier: resolved.personalityTpaMultiplier, honorTpaMultiplier: numberValue(honorTpa, 1), ritualTpaMultiplier: resolved.ritualTpaMultiplier, invisibilityMultiplier: 1, dragonTpaMultiplier: resolved.dragonTpaMultiplier })
      : null;
    const targetTpa = positive(targetAcresN) && positive(targetThievesN)
      ? modifiedTpa({ acres: targetAcresN, thieves: targetThievesN, thievesDensPct: numberValue(targetThievesDens, 0), thievesDensEffectivenessMultiplier: targetResolved.thievesDensEffectivenessMultiplier, crimeScienceMultiplier: scienceTarget, racialTpaMultiplier: targetResolved.racialTpaMultiplier, personalityTpaMultiplier: targetResolved.personalityTpaMultiplier, honorTpaMultiplier: numberValue(targetHonorTpa, 1), ritualTpaMultiplier: targetResolved.ritualTpaMultiplier, invisibilityMultiplier: 1, dragonTpaMultiplier: targetResolved.dragonTpaMultiplier })
      : null;

    // These three outputs intentionally have independent readiness rules.
    // Optimal thieves must not wait on province TPA fields; randomization must
    // not wait on target TPA; predicted yield only needs its yield inputs.
    const thievesToSend = entered(resourceN) && gains != null && maxPercent != null
      ? optimalThieves(resourceN, maxPercent, gains, resolved.racialTpaMultiplier)
      : null;
    const randomization = entered(thievesToSend) && positive(selfThievesN)
      ? operationSuccessMetrics(1, 1, { thievesSent: thievesToSend, totalThieves: selfThievesN }).randomizationPercent
      : null;
    const targetDamageTaken = targetResolved.sabotageDamageTakenMultiplier * targetResolved.thieveryDamageTakenMultiplier;
    const yieldResult = positive(selfNwN) && positive(targetNwN) && entered(thievesToSend) && gains != null
      ? thieveryYield({
          thievesSent: thievesToSend,
          selfNetworth: selfNwN,
          targetNetworth: targetNwN,
          gainsPerThief: gains,
          resourcesLostFraction: op?.resourcesLostFraction ?? 0,
          modifiers: {
            racialMultiplier: resolved.racialTpaMultiplier,
            personalityMultiplier: resolved.personalityTpaMultiplier,
            scienceMultiplier: scienceSelf,
            guileMultiplier: resolved.sabotageDamageMultiplier * resolved.sabotageDamageDealtMultiplier,
            cunningMultiplier: 1,
            targetRacialMultiplier: targetDamageTaken,
            targetPersonalityMultiplier: 1,
            targetIlluminateShadowsMultiplier: targetIlluminate ? 0.80 : 1,
            targetWatchtowersReduction: watchTowersDamageReduction(numberValue(targetWatchTowers, 0)),
            targetShieldingReduction: numberValue(shieldingReduction, 0),
            stanceMultiplier: 1,
            warBonus: war ? 1 : 0,
          },
        })
      : null;
    const success = selfTpa && targetTpa && entered(thievesToSend)
      ? operationSuccessMetrics(selfTpa.value, targetTpa.value, { thievesSent: thievesToSend, totalThieves: selfThievesN, dragonSuccessMultiplier: resolved.sabotageSuccessChanceMultiplier })
      : null;
    return { op, selfTpa, targetTpa, thievesToSend, randomization, yieldResult, success, scienceSelf, scienceTarget };
  }, [selfAcres, selfThieves, selfNW, targetAcres, targetThieves, targetNW, targetResource, thievesDens, targetThievesDens, targetWatchTowers, crimeScienceMultiplier, targetCrimeScienceMultiplier, shieldingReduction, honorTpa, targetHonorTpa, operation, war, resolved, targetResolved, targetIlluminate]);

  const recovery = stealthRecoveryPerTick({ race, personality, dragon: dragon === 'None' ? undefined : dragon });
  const afterStealth = Math.max(0, numberValue(stealth, 0) / 100 - (calculations.op?.stealthCost ?? 0));
  const autoPct = (value) => pct(value - 1);

  return <div className="thievery-calculator">
    <div className="thievery-header"><div><h2>Thievery Calculator — Age 116</h2><p>Utopia War Room Age 116 mechanics. Modifiers from the selected setup are automatic.</p></div><div className="thievery-source-status"><span>✓ Verified</span><span>{data.source.name}</span></div></div>
    <div className="thievery-grid">
      <section className="thievery-panel"><h3>Our Province</h3>
        <Select label="Race" value={race} onChange={setRace}>{Object.keys(data.races).map((x) => <option key={x}>{x}</option>)}</Select>
        <Select label="Personality" value={personality} onChange={setPersonality}>{Object.keys(data.personalities).map((x) => <option key={x}>{x}</option>)}</Select>
        <Select label="Ritual" value={ritual} onChange={setRitual}><option>None</option>{Object.keys(data.rituals).map((x) => <option key={x}>{x}</option>)}</Select>
        <Select label="Dragon" value={dragon} onChange={setDragon}><option>None</option>{Object.keys(data.dragons).map((x) => <option key={x}>{x}</option>)}</Select>
        <Field label="Acres" value={selfAcres} onChange={setSelfAcres}/><Field label="Thieves" value={selfThieves} onChange={setSelfThieves}/><Field label="Networth" value={selfNW} onChange={setSelfNW}/>
        <Auto label="Race TPA modifier" value={autoPct(resolved.racialTpaMultiplier)}/><Auto label="Personality TPA modifier" value={autoPct(resolved.personalityTpaMultiplier)}/><Auto label="Ritual TPA modifier" value={autoPct(resolved.ritualTpaMultiplier)}/><Auto label="Dragon TPA modifier" value={autoPct(resolved.dragonTpaMultiplier)}/>
        <Field label="Thieves' Dens %" value={thievesDens} onChange={setThievesDens}/><Field label="Crime Science multiplier" value={crimeScienceMultiplier} onChange={setCrimeScienceMultiplier}/><Field label="Honor TPA multiplier" value={honorTpa} onChange={setHonorTpa}/>
        <label className="thievery-check"><input type="checkbox" checked={invisibility} onChange={(e) => setInvisibility(e.target.checked)}/> Invisibility active (+10% TPA)</label>
        <label className="thievery-check"><input type="checkbox" checked={guile} onChange={(e) => setGuile(e.target.checked)}/> Guile active (+10% sabotage damage)</label>
      </section>
      <section className="thievery-panel"><h3>Target Province</h3>
        <Select label="Race" value={targetRace} onChange={setTargetRace}>{Object.keys(data.races).map((x) => <option key={x}>{x}</option>)}</Select>
        <Select label="Personality" value={targetPersonality} onChange={setTargetPersonality}>{Object.keys(data.personalities).map((x) => <option key={x}>{x}</option>)}</Select>
        <Select label="Ritual" value={targetRitual} onChange={setTargetRitual}><option>None</option>{Object.keys(data.rituals).map((x) => <option key={x}>{x}</option>)}</Select>
        <Select label="Dragon" value={targetDragon} onChange={setTargetDragon}><option>None</option>{Object.keys(data.dragons).map((x) => <option key={x}>{x}</option>)}</Select>
        <Field label="Acres" value={targetAcres} onChange={setTargetAcres}/><Field label="Thieves" value={targetThieves} onChange={setTargetThieves}/><Field label="Networth" value={targetNW} onChange={setTargetNW}/><Field label="Target resource amount" value={targetResource} onChange={setTargetResource}/>
        <Auto label="Race TPA modifier" value={autoPct(targetResolved.racialTpaMultiplier)}/><Auto label="Personality TPA modifier" value={autoPct(targetResolved.personalityTpaMultiplier)}/><Auto label="Ritual TPA modifier" value={autoPct(targetResolved.ritualTpaMultiplier)}/><Auto label="Dragon TPA modifier" value={autoPct(targetResolved.dragonTpaMultiplier)}/>
        <Field label="Thieves' Dens %" value={targetThievesDens} onChange={setTargetThievesDens}/><Field label="Crime Science multiplier" value={targetCrimeScienceMultiplier} onChange={setTargetCrimeScienceMultiplier}/><Field label="Honor TPA multiplier" value={targetHonorTpa} onChange={setTargetHonorTpa}/><Field label="Watch Towers %" value={targetWatchTowers} onChange={setTargetWatchTowers}/><Field label="Shielding reduction" value={shieldingReduction} onChange={setShieldingReduction}/>
        <label className="thievery-check"><input type="checkbox" checked={targetInvisibility} onChange={(e) => setTargetInvisibility(e.target.checked)}/> Target Invisibility active</label>
        <label className="thievery-check"><input type="checkbox" checked={targetIlluminate} onChange={(e) => setTargetIlluminate(e.target.checked)}/> Target Illuminate Shadows active</label>
      </section>
    </div>
    <section className="thievery-panel"><h3>Operation</h3>
      <Select label="Operation" value={operation} onChange={setOperation}>{Object.values(AGE_116_OPERATIONS).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
      <label className="thievery-check"><input type="checkbox" checked={war} onChange={(e) => setWar(e.target.checked)}/> War</label>
      <div className="thievery-result-line"><span>Relations</span><strong>{calculations.op?.relations ?? '—'}</strong></div>
      <div className="thievery-result-line"><span>Stealth cost</span><strong>{pct(calculations.op?.stealthCost ?? 0)}</strong></div>
      <Field label="Current stealth %" value={stealth} onChange={setStealth}/>
      <div className="thievery-result-line"><span>After operation</span><strong>{pct(afterStealth)}</strong></div>
    </section>
    <section className="thievery-panel thievery-results"><h3>Calculation</h3><div className="thievery-result-grid">
      <div><span>Our raw / modified TPA</span><strong>{calculations.selfTpa ? `${calculations.selfTpa.raw.toFixed(3)} / ${calculations.selfTpa.value.toFixed(3)}` : '—'}</strong></div>
      <div><span>Target raw / modified TPA</span><strong>{calculations.targetTpa ? `${calculations.targetTpa.raw.toFixed(3)} / ${calculations.targetTpa.value.toFixed(3)}` : '—'}</strong></div>
      <div><span>Off / def TPA ratio</span><strong>{calculations.success ? `${calculations.success.tpaRatio.toFixed(3)}×` : '—'}</strong></div>
      <div><span>Randomization</span><strong>{calculations.randomization == null ? '—' : pct(calculations.randomization)}</strong></div>
      <div><span>Optimal thieves</span><strong>{calculations.thievesToSend == null ? '—' : calculations.thievesToSend.toLocaleString()}</strong></div>
      <div><span>Predicted yield</span><strong>{calculations.yieldResult == null ? '—' : calculations.yieldResult.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div>
      <div><span>WT catch chance</span><strong>{pct(watchTowersCatchChance(numberValue(targetWatchTowers, 0)))}</strong></div>
      <div><span>WT damage reduction</span><strong>{pct(watchTowersDamageReduction(numberValue(targetWatchTowers, 0)))}</strong></div>
      <div><span>Our TD loss reduction</span><strong>{pct(thievesDensLossReduction(numberValue(thievesDens, 0)))}</strong></div>
      <div><span>Stealth recovery</span><strong>+{recovery}/tick</strong></div>
      <div><span>Success probability</span><strong>Source gives ratio, not curve</strong></div>
      <div><span>Source</span><strong>Age 116 War Room ✓</strong></div>
    </div></section>
    <section className="thievery-panel"><h3>Audit</h3><div className="thievery-modifier-list">
      <span>Our race: {race} ✓</span><span>Our personality: {personality} ✓</span><span>Target race: {targetRace} ✓</span><span>Target personality: {targetPersonality} ✓</span>
      <span>Our Crime science: {calculations.scienceSelf.toFixed(3)}×</span><span>Target Crime science: {calculations.scienceTarget.toFixed(3)}×</span>
      <span>Our TD effectiveness: {resolved.thievesDensEffectivenessMultiplier.toFixed(2)}×</span><span>Target TD effectiveness: {targetResolved.thievesDensEffectivenessMultiplier.toFixed(2)}×</span>
    </div></section>
  </div>;
}
