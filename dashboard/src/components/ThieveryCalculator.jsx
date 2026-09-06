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

const ages = { '116': AGE_116_DATA };
const pct = (value) => `${(value * 100).toFixed(2)}%`;
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function Field({ label, value, onChange, step = '1', min = '0' }) {
  return <label className="thievery-field"><span>{label}</span><input type="number" min={min} step={step} value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
function Select({ label, value, onChange, children }) {
  return <label className="thievery-field"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{children}</select></label>;
}

export default function ThieveryCalculator() {
  const data = ages['116'];
  const [race, setRace] = useState('Faery');
  const [personality, setPersonality] = useState('Rogue');
  const [ritual, setRitual] = useState('None');
  const [dragon, setDragon] = useState('None');
  const [operation, setOperation] = useState('rob_vaults');
  const [war, setWar] = useState(false);
  const [selfAcres, setSelfAcres] = useState('1000');
  const [selfThieves, setSelfThieves] = useState('1500');
  const [selfNW, setSelfNW] = useState('100000');
  const [targetAcres, setTargetAcres] = useState('1000');
  const [targetThieves, setTargetThieves] = useState('1500');
  const [targetNW, setTargetNW] = useState('100000');
  const [targetResource, setTargetResource] = useState('100000');
  const [thievesDens, setThievesDens] = useState('20');
  const [targetWatchTowers, setTargetWatchTowers] = useState('10');
  const [crimeScienceMultiplier, setCrimeScienceMultiplier] = useState('1');
  const [shieldingReduction, setShieldingReduction] = useState('0');
  const [honorTpa, setHonorTpa] = useState('1');
  const [stealth, setStealth] = useState('100');
  const [invisibility, setInvisibility] = useState(false);
  const [guile, setGuile] = useState(false);

  const op = AGE_116_OPERATIONS[operation];
  const resolved = useMemo(() => resolveThieveryModifiers({ age: 116, race, personality, ritual: ritual === 'None' ? undefined : ritual, dragon: dragon === 'None' ? undefined : dragon, invisibility, guile }), [race, personality, ritual, dragon, invisibility, guile]);

  const calculations = useMemo(() => {
    const selfTpa = modifiedTpa({ acres: num(selfAcres, 1), thieves: num(selfThieves), thievesDensPct: num(thievesDens), thievesDensEffectivenessMultiplier: resolved.thievesDensEffectivenessMultiplier, crimeScienceMultiplier: num(crimeScienceMultiplier, 1), racialTpaMultiplier: resolved.racialTpaMultiplier, personalityTpaMultiplier: resolved.personalityTpaMultiplier, honorTpaMultiplier: num(honorTpa, 1), ritualTpaMultiplier: resolved.ritualTpaMultiplier, invisibilityMultiplier: invisibility ? 1.10 : 1, dragonTpaMultiplier: resolved.dragonTpaMultiplier });
    const targetTpa = modifiedTpa({ acres: num(targetAcres, 1), thieves: num(targetThieves), thievesDensPct: 0, crimeScienceMultiplier: 1, racialTpaMultiplier: 1, personalityTpaMultiplier: 1, honorTpaMultiplier: 1, ritualTpaMultiplier: 1, invisibilityMultiplier: 1, dragonTpaMultiplier: 1 });
    const gains = war ? op?.gainsPerThiefWar : op?.gainsPerThiefNormal;
    const maxPercent = war ? op?.maxPercentWar : op?.maxPercentNormal;
    const thievesToSend = gains && maxPercent ? optimalThieves(num(targetResource), maxPercent, gains, resolved.racialTpaMultiplier) : null;
    const yieldResult = gains && maxPercent ? thieveryYield({ thievesSent: thievesToSend, selfNetworth: num(selfNW, 1), targetNetworth: num(targetNW, 1), gainsPerThief: gains, resourcesLostFraction: op?.resourcesLostFraction ?? 0, modifiers: { racialMultiplier: resolved.racialTpaMultiplier, personalityMultiplier: resolved.personalityTpaMultiplier, scienceMultiplier: num(crimeScienceMultiplier, 1), guileMultiplier: guile ? 1.10 : 1, cunningMultiplier: 1, targetRacialMultiplier: resolved.sabotageDamageTakenMultiplier, targetPersonalityMultiplier: 1, targetIlluminateShadowsMultiplier: 1, targetWatchtowersReduction: watchTowersDamageReduction(num(targetWatchTowers)), targetShieldingReduction: num(shieldingReduction), stanceMultiplier: 1, warBonus: war ? 1 : 0 } }) : null;
    const success = operationSuccessMetrics(selfTpa.value, targetTpa.value, { thievesSent: thievesToSend || 0, totalThieves: num(selfThieves), dragonSuccessMultiplier: resolved.sabotageSuccessChanceMultiplier });
    return { selfTpa, targetTpa, gains, maxPercent, yieldResult, thievesToSend, success };
  }, [selfAcres, selfThieves, selfNW, targetAcres, targetThieves, targetNW, targetResource, thievesDens, targetWatchTowers, crimeScienceMultiplier, shieldingReduction, honorTpa, operation, war, resolved, invisibility, guile, op]);

  const recovery = stealthRecoveryPerTick({ race, personality, dragon: dragon === 'None' ? undefined : dragon });
  const afterStealth = Math.max(0, num(stealth) / 100 - (op?.stealthCost ?? 0));

  return <div className="thievery-calculator">
    <div className="thievery-header"><div><h2>Thievery Calculator — Age 116</h2><p>Age 116 War Room mechanics. All displayed modifiers are data-driven and auditable.</p></div><div className="thievery-source-status"><span>✓ Verified</span><span>{data.source.name}</span></div></div>
    <div className="thievery-grid">
      <section className="thievery-panel"><h3>Province</h3>
        <Select label="Race" value={race} onChange={setRace}>{Object.keys(data.races).map((x) => <option key={x}>{x}</option>)}</Select>
        <Select label="Personality" value={personality} onChange={setPersonality}>{Object.keys(data.personalities).map((x) => <option key={x}>{x}</option>)}</Select>
        <Select label="Ritual" value={ritual} onChange={setRitual}><option>None</option>{Object.keys(data.rituals).map((x) => <option key={x}>{x}</option>)}</Select>
        <Select label="Dragon" value={dragon} onChange={setDragon}><option>None</option>{Object.keys(data.dragons).map((x) => <option key={x}>{x}</option>)}</Select>
        <Field label="Acres" value={selfAcres} onChange={setSelfAcres}/><Field label="Thieves" value={selfThieves} onChange={setSelfThieves}/><Field label="Networth" value={selfNW} onChange={setSelfNW}/><Field label="Thieves' Dens %" value={thievesDens} onChange={setThievesDens} step="0.1"/><Field label="Crime Science multiplier" value={crimeScienceMultiplier} onChange={setCrimeScienceMultiplier} step="0.01"/><Field label="Honor TPA multiplier" value={honorTpa} onChange={setHonorTpa} step="0.01"/>
        <label className="thievery-check"><input type="checkbox" checked={invisibility} onChange={(e) => setInvisibility(e.target.checked)}/> Invisibility active (+10% TPA)</label><label className="thievery-check"><input type="checkbox" checked={guile} onChange={(e) => setGuile(e.target.checked)}/> Guile active (+10% sabotage damage)</label>
      </section>
      <section className="thievery-panel"><h3>Target & Operation</h3>
        <Select label="Operation" value={operation} onChange={setOperation}>{Object.values(AGE_116_OPERATIONS).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select><label className="thievery-check"><input type="checkbox" checked={war} onChange={(e) => setWar(e.target.checked)}/> War</label>
        <Field label="Target acres" value={targetAcres} onChange={setTargetAcres}/><Field label="Target thieves" value={targetThieves} onChange={setTargetThieves}/><Field label="Target networth" value={targetNW} onChange={setTargetNW}/><Field label="Target resource amount" value={targetResource} onChange={setTargetResource}/><Field label="Target Watch Towers %" value={targetWatchTowers} onChange={setTargetWatchTowers} step="0.1"/><Field label="Target Shielding reduction" value={shieldingReduction} onChange={setShieldingReduction} step="0.01"/><Field label="Current stealth %" value={stealth} onChange={setStealth} step="1"/>
        <div className="thievery-result-line"><span>Relations</span><strong>{op?.relations ?? '—'}</strong></div><div className="thievery-result-line"><span>Stealth cost</span><strong>{pct(op?.stealthCost ?? 0)}</strong></div><div className="thievery-result-line"><span>After operation</span><strong>{pct(afterStealth)}</strong></div>
      </section>
    </div>
    <section className="thievery-panel thievery-results"><h3>Calculation</h3><div className="thievery-result-grid">
      <div><span>Raw / modified TPA</span><strong>{calculations.selfTpa.raw.toFixed(3)} / {calculations.selfTpa.value.toFixed(3)}</strong></div><div><span>Target modified TPA</span><strong>{calculations.targetTpa.value.toFixed(3)}</strong></div><div><span>Off / def TPA ratio</span><strong>{calculations.success.tpaRatio.toFixed(3)}×</strong></div><div><span>Randomization</span><strong>{calculations.success.randomizationPercent == null ? '—' : pct(calculations.success.randomizationPercent)}</strong></div><div><span>Optimal thieves</span><strong>{calculations.thievesToSend == null ? 'Not fixed-yield' : calculations.thievesToSend.toLocaleString()}</strong></div><div><span>Predicted yield</span><strong>{calculations.yieldResult == null ? 'Not fixed-yield' : calculations.yieldResult.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div><div><span>WT catch chance</span><strong>{pct(watchTowersCatchChance(num(targetWatchTowers)))}</strong></div><div><span>WT damage reduction</span><strong>{pct(watchTowersDamageReduction(num(targetWatchTowers)))}</strong></div><div><span>TD thief-loss reduction</span><strong>{pct(thievesDensLossReduction(num(thievesDens)))}</strong></div><div><span>Stealth recovery</span><strong>+{recovery}/tick</strong></div><div><span>Success probability</span><strong>Source gives ratio, not curve</strong></div><div><span>Source</span><strong>Age 116 War Room ✓</strong></div>
    </div></section>
    <section className="thievery-panel"><h3>Selected Age 116 modifiers</h3><div className="thievery-modifier-list"><span>Race: {race} ✓</span><span>Personality: {personality} ✓</span><span>Ritual: {ritual} ✓</span><span>Dragon: {dragon} ✓</span><span>TD effectiveness: {resolved.thievesDensEffectivenessMultiplier.toFixed(2)}×</span><span>Sabotage damage: {resolved.sabotageDamageMultiplier.toFixed(3)}×</span><span>Sabotage success: {resolved.sabotageSuccessChanceMultiplier.toFixed(3)}×</span></div></section>
    <div className="thievery-source-note">Source: Utopia War Room — Age 116. Success probability is intentionally not guessed where the source only specifies the TPA-ratio relationship.</div>
  </div>;
}
