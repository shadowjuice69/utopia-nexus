import { useState, useEffect } from "react";

// ── Utilities ────────────────────────────────────────────────────────
function raw(v){ return parseFloat(String(v||"0").replace(/,/g,""))||0; }
function fmt(n){ const s=n<0?"-":""; return s+Math.abs(Math.round(n)).toLocaleString("en-US"); }
function fmtDec(n){ return Number(n||0).toLocaleString("en-US",{maximumFractionDigits:2}); }

const C = {
  bg:"#0c0c0f", card:"#17171d", card2:"#202028", border:"#34343d",
  text:"#f4f4f5", muted:"#a1a1aa", gold:"#f5c542", green:"#22c55e",
  red:"#ef4444", blue:"#38bdf8", purple:"#a78bfa", orange:"#fb923c",
};

function Card({ title, children }){
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:14,marginBottom:12}}>
      <div style={{color:C.gold,fontSize:15,fontWeight:700,marginBottom:10}}>{title}</div>
      {children}
    </div>
  );
}

function Fields({ children, cols=2 }){
  return <div style={{display:"grid",gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`,gap:10}}>{children}</div>;
}

function Field({ label, id, value, onChange, note }){
  return (
    <div>
      <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:4,textTransform:"uppercase"}}>{label}</label>
      <input
        value={value}
        onChange={e=>onChange(e.target.value)}
        style={{width:"100%",background:"#0d0d12",color:"#fff",border:`1px solid #3f3f46`,borderRadius:10,padding:"9px 10px",fontSize:14,boxSizing:"border-box"}}
      />
      {note && <div style={{fontSize:10,color:C.muted,marginTop:3}}>{note}</div>}
    </div>
  );
}

function Row({ label, value, color, big }){
  return (
    <div style={{display:"flex",justifyContent:"space-between",padding:"8px 10px",background:C.card2,borderRadius:10,fontSize:big?16:13,marginBottom:4}}>
      <span style={{color:C.muted}}>{label}</span>
      <strong style={{color:color||C.text}}>{value}</strong>
    </div>
  );
}

function Toggle({ label, on, onToggle, onLabel, offLabel }){
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0"}}>
      <span style={{fontSize:13,color:C.muted}}>{label}</span>
      <button onClick={onToggle} style={{
        padding:"5px 14px",borderRadius:8,border:`1px solid ${on?"#22c55e":"#ef4444"}`,
        background:on?"#052e16":"#450a0a",color:on?"#22c55e":"#ef4444",
        cursor:"pointer",fontSize:12,fontWeight:600
      }}>{on?(onLabel||"✅ ON"):(offLabel||"❌ OFF")}</button>
    </div>
  );
}

function SelectField({ label, value, onChange, options }){
  return (
    <div>
      <label style={{fontSize:11,color:C.muted,display:"block",marginBottom:4,textTransform:"uppercase"}}>{label}</label>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{width:"100%",background:"#0d0d12",color:"#fff",border:`1px solid #3f3f46`,borderRadius:10,padding:"9px 10px",fontSize:13}}>
        {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

const TABS2 = ["📦 Province Planner","⚔️ Attack Calc","🐉 Dragon Cost"];

const DRAGON_MODS = { sapphire:2, topaz:2, emerald:2.4, ruby:2.4, amethyst:2 };
const DRAGON_HP   = { sapphire:7.0125, topaz:7.0125, emerald:8.415, ruby:8.415, amethyst:7.0125 };
const DRAGON_FX   = {
  sapphire:"On Arrival: -40% Spell/Thievery Success, -35% WPA/TPA, -1 Mana/Stealth Recovery, 30% runes destroyed. Every 3 ticks: 25% current runes destroyed.",
  topaz:"On Arrival: -25% Building Efficiency, -25% Income, 10% buildings destroyed. Every 6 ticks: 10% buildings + 20% current gold destroyed.",
  emerald:"On Arrival: +25% Military Casualties, -25% Combat Gains, 3.5% troops destroyed. Every 6 ticks: 1.5% troops lost, Build/Spec Credits -40%.",
  ruby:"On Arrival: -12.5% Military Effectiveness, +20% Wages, 3.5% Off+Def Specs destroyed. Every 6 ticks: 2.5% troops at home desert.",
  amethyst:"On Arrival: -40% Spell Success, -40% Thievery Sab Success, all self-spells removed. Every 6 ticks: self-spells removed, 5% wizards + 5% thieves killed.",
};

export default function AttackCalc(){
  const [innerTab, setInnerTab] = useState(0);

  // ── Province Planner state ──
  const [p, setP] = useState({
    acres:"1500", gc:"8500000", soldiers:"15000", goldReserve:"0",
    curElites:"15500", curOffSpecs:"4800", curDefSpecs:"10650", curThieves:"5250",
    targetEpa:"12", targetOspa:"4", targetDspa:"8", targetTpa:"4",
    eliteCost:"750", offSpecCost:"0", defSpecCost:"0", thiefCost:"500", mercCost:"0", mercs:"0",
    specCredits:"4200", buildCredits:"8500",
    buildAcres:"300", buildCost:"800", razeAcres:"0", razeCost:"350",
  });
  const sp = (k,v) => setP(prev=>({...prev,[k]:v}));
  const pv = k => raw(p[k]);

  // ── Attack Calc state ──
  const [a, setA] = useState({ soldiers:"0", specs:"0", elites:"0", mercs:"0", prisoners:"0", generals:"1", ome:"100", mynw:"0", theirnw:"0", def:"0", acres:"0" });
  const sa = (k,v) => setA(prev=>({...prev,[k]:v}));
  const av = k => raw(a[k]);
  const [bl, setBl] = useState(false);
  const [db, setDb] = useState(false);
  const [traditional, setTraditional] = useState(true);

  // ── Dragon state ──
  const [dragonType, setDragonType] = useState("sapphire");
  const [dWar, setDWar] = useState(false);
  const [dKdNW, setDKdNW] = useState("5000000");
  const [dMyKdNW, setDMyKdNW] = useState("5000000");
  const [dRel, setDRel] = useState("0.5");

  // ── Province Planner calc ──
  const acres=pv("acres"), gc=pv("gc"), soldiers=pv("soldiers");
  const curE=pv("curElites"), curO=pv("curOffSpecs"), curD=pv("curDefSpecs"), curT=pv("curThieves");
  const targetE=pv("targetEpa")*acres, targetO=pv("targetOspa")*acres, targetD=pv("targetDspa")*acres, targetT=pv("targetTpa")*acres;
  const needE=Math.max(0,targetE-curE), needOBase=Math.max(0,targetO-curO), needDBase=Math.max(0,targetD-curD), needT=Math.max(0,targetT-curT);
  let sc=pv("specCredits");
  const dCr=Math.min(sc,needDBase); sc-=dCr;
  const oCr=Math.min(sc,needOBase); sc-=oCr;
  const needDPaid=needDBase-dCr, needOPaid=needOBase-oCr;
  const eliteCostTotal=needE*pv("eliteCost"), offCostTotal=needOPaid*pv("offSpecCost");
  const defCostTotal=needDPaid*pv("defSpecCost"), thiefCostTotal=needT*pv("thiefCost");
  const mercCostTotal=pv("mercs")*pv("mercCost");
  const trainingCost=eliteCostTotal+offCostTotal+defCostTotal+thiefCostTotal+mercCostTotal;
  let bc=pv("buildCredits");
  const bCr=Math.min(bc,pv("buildAcres")); bc-=bCr;
  const rCr=Math.min(bc,pv("razeAcres")); bc-=rCr;
  const buildCostTotal=(pv("buildAcres")-bCr)*pv("buildCost");
  const razeCostTotal=(pv("razeAcres")-rCr)*pv("razeCost");
  const reserve=pv("goldReserve")*acres;
  const totalCost=trainingCost+buildCostTotal+razeCostTotal+reserve;
  const gcLeft=gc-totalCost, solLeft=soldiers-(needE+needOBase+needDBase+needT);

  // ── Attack calc ──
  const specOff=db?14:12;
  const rawOff=(av("soldiers")*3)+(av("specs")*specOff)+(av("elites")*16)+(av("mercs")*8)+(av("prisoners")*8);
  const genBonus=1+(Math.max(av("generals"),1)-1)*0.05;
  const myOff=Math.round(rawOff*genBonus*(av("ome")/100)*(bl?1.1:1.0));
  const myOffNoBL=Math.round(rawOff*genBonus*(av("ome")/100));
  const theirDef=av("def");
  let chance=0;
  if(theirDef===0) chance=100;
  else { const r=myOff/theirDef; if(r>=1) chance=Math.min(100,Math.round(75+(r-1)*50)); else if(r>=0.75) chance=Math.round((r-0.75)/0.25*75); }
  let estAcres=null;
  const tA=av("acres"), mNW=av("mynw"), tNW=av("theirnw");
  if(tA>0&&mNW>0&&tNW>0){ const nwr=mNW/tNW; const base=traditional?0.08:0.05; const mod=nwr>1?Math.max(0.5,1-(nwr-1)*0.5):1+(1-nwr)*0.5; estAcres=Math.round(tA*base*mod); }
  const cc=chance>=80?"#4ade80":chance>=50?"#facc15":"#f87171";
  const ga=av("generals")>=2;

  // ── Dragon calc ──
  const dKdNWv=raw(dKdNW), dMyKdNWv=raw(dMyKdNW), relMod=parseFloat(dRel)||0.5;
  const costMod=DRAGON_MODS[dragonType], hpMod=DRAGON_HP[dragonType];
  const oowMod=dWar?1:1.15;
  const dGold=Math.round(costMod*dKdNWv*0.656*oowMod);
  const dFood=Math.round(dGold*0.2);
  const dHP=Math.round(hpMod*relMod*(dKdNWv/132));

  const divider = <div style={{borderTop:`1px solid ${C.border}`,margin:"10px 0"}}/>;

  return (
    <div style={{padding:4}}>
      {/* Inner tab bar */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        {TABS2.map((t,i)=>(
          <button key={i} onClick={()=>setInnerTab(i)} style={{
            padding:"7px 16px",borderRadius:10,border:`1px solid ${innerTab===i?C.blue:C.border}`,
            background:innerTab===i?"#1e293b":C.card,color:innerTab===i?C.blue:C.muted,
            cursor:"pointer",fontSize:13,fontWeight:600
          }}>{t}</button>
        ))}
      </div>

      {/* ── PROVINCE PLANNER ── */}
      {innerTab===0 && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
            <Card title="🏰 Province Info">
              <Fields>
                <Field label="Acres" value={p.acres} onChange={v=>sp("acres",v)}/>
                <Field label="Gold (gc)" value={p.gc} onChange={v=>sp("gc",v)}/>
                <Field label="Soldiers" value={p.soldiers} onChange={v=>sp("soldiers",v)}/>
                <Field label="Gold Reserve / Acre" value={p.goldReserve} onChange={v=>sp("goldReserve",v)} note="Manual reserve buffer per acre (e.g. dragon fund)"/>
              </Fields>
            </Card>
            <Card title="⚔️ Current Units">
              <Fields>
                <Field label="Elites" value={p.curElites} onChange={v=>sp("curElites",v)}/>
                <Field label="Off Specs" value={p.curOffSpecs} onChange={v=>sp("curOffSpecs",v)}/>
                <Field label="Def Specs" value={p.curDefSpecs} onChange={v=>sp("curDefSpecs",v)}/>
                <Field label="Thieves" value={p.curThieves} onChange={v=>sp("curThieves",v)}/>
              </Fields>
            </Card>
            <Card title="🎯 Target Per Acre">
              <Fields>
                <Field label="Target EPA" value={p.targetEpa} onChange={v=>sp("targetEpa",v)}/>
                <Field label="Target OSPA" value={p.targetOspa} onChange={v=>sp("targetOspa",v)}/>
                <Field label="Target DSPA" value={p.targetDspa} onChange={v=>sp("targetDspa",v)}/>
                <Field label="Target TPA" value={p.targetTpa} onChange={v=>sp("targetTpa",v)}/>
              </Fields>
            </Card>
            <Card title="💰 Unit Costs & Credits">
              <Fields>
                <Field label="Elite Cost (gc)" value={p.eliteCost} onChange={v=>sp("eliteCost",v)}/>
                <Field label="Off Spec Cost" value={p.offSpecCost} onChange={v=>sp("offSpecCost",v)}/>
                <Field label="Def Spec Cost" value={p.defSpecCost} onChange={v=>sp("defSpecCost",v)}/>
                <Field label="Thief Cost" value={p.thiefCost} onChange={v=>sp("thiefCost",v)}/>
                <Field label="Merc Cost" value={p.mercCost} onChange={v=>sp("mercCost",v)} note="Human Civil Admin: -40% merc cost"/>
                <Field label="Mercs Sending" value={p.mercs} onChange={v=>sp("mercs",v)}/>
                <Field label="Spec Credits" value={p.specCredits} onChange={v=>sp("specCredits",v)}/>
                <Field label="Build Credits" value={p.buildCredits} onChange={v=>sp("buildCredits",v)}/>
              </Fields>
            </Card>
            <Card title="🏗️ Building & Raze">
              <Fields>
                <Field label="Acres To Build" value={p.buildAcres} onChange={v=>sp("buildAcres",v)}/>
                <Field label="Build Cost / Acre" value={p.buildCost} onChange={v=>sp("buildCost",v)}/>
                <Field label="Acres To Raze" value={p.razeAcres} onChange={v=>sp("razeAcres",v)}/>
                <Field label="Raze Cost / Acre" value={p.razeCost} onChange={v=>sp("razeCost",v)} note="Formula: (300 + 0.05×Land) × modifiers. Dwarf: +20% raze dmg dealt."/>
              </Fields>
              <div style={{fontSize:10,color:C.muted,marginTop:8}}>Build credits cover building first, leftover covers raze.</div>
            </Card>
            <Card title="📊 Target Status">
              {[["EPA",targetE-curE,acres],["OSPA",targetO-curO,acres],["DSPA",targetD-curD,acres],["TPA",targetT-curT,acres]].map(([k,miss,ac])=>(
                <Row key={k} label={k}
                  value={miss>0?`Missing ${fmtDec(miss/ac)} (${fmt(miss)} units)`:`✓ Met +${fmt(Math.abs(miss))}`}
                  color={miss>0?C.red:C.green}/>
              ))}
            </Card>
          </div>

          <Card title="🏋️ Training Needed">
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:4}}>
              <Row label="Elites Needed" value={fmt(needE)}/>
              <Row label="Off Specs Needed" value={fmt(needOBase)}/>
              <Row label="Def Specs Needed" value={fmt(needDBase)}/>
              <Row label="Thieves Needed" value={fmt(needT)}/>
              <Row label="Mercs Sending" value={fmt(pv("mercs"))}/>
              <Row label="Spec Credits Used" value={fmt(dCr+oCr)} color={C.blue}/>
              <Row label="Off Specs Paid (after credits)" value={fmt(needOPaid)}/>
              <Row label="Def Specs Paid (after credits)" value={fmt(needDPaid)}/>
            </div>
          </Card>

          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
            <Card title="💰 Gold Status">
              <Row label="Gold Available" value={fmt(gc)}/>
              <Row label="Total Cost + Reserve" value={fmt(totalCost)}/>
              <div style={{textAlign:"center",padding:12,background:C.card2,borderRadius:12,marginTop:8}}>
                <div style={{fontSize:22,fontWeight:800,color:gcLeft>=0?C.green:C.red}}>{gcLeft>=0?"SURPLUS":"SHORT"}: {gcLeft>=0?"+":""}{fmt(gcLeft)}</div>
              </div>
            </Card>
            <Card title="🪖 Soldier Status">
              <Row label="Soldiers Available" value={fmt(soldiers)}/>
              <Row label="Soldiers Needed" value={fmt(needE+needOBase+needDBase+needT)}/>
              <div style={{textAlign:"center",padding:12,background:C.card2,borderRadius:12,marginTop:8}}>
                <div style={{fontSize:22,fontWeight:800,color:solLeft>=0?C.green:C.red}}>{solLeft>=0?"SURPLUS":"SHORT"}: {solLeft>=0?"+":""}{fmt(solLeft)}</div>
              </div>
            </Card>
          </div>

          <Card title="📋 Full Cost Breakdown">
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:4}}>
              <Row label="Elite Training" value={fmt(eliteCostTotal)} color={C.gold}/>
              <Row label="Off Spec Training" value={fmt(offCostTotal)}/>
              <Row label="Def Spec Training" value={fmt(defCostTotal)}/>
              <Row label="Thief Training" value={fmt(thiefCostTotal)}/>
              <Row label="Merc Cost" value={fmt(mercCostTotal)}/>
              <Row label="Build Credits Used (Build)" value={fmt(bCr)} color={C.blue}/>
              <Row label="Build Credits Used (Raze)" value={fmt(rCr)} color={C.blue}/>
              <Row label="Building Cost" value={fmt(buildCostTotal)}/>
              <Row label="Raze Cost" value={fmt(razeCostTotal)}/>
              <Row label="Gold Reserve" value={fmt(reserve)} color={C.orange}/>
              <Row label="TOTAL COST" value={fmt(totalCost)} color={C.red} big/>
              <Row label="GOLD LEFT" value={fmt(gcLeft)} color={gcLeft>=0?C.green:C.red} big/>
            </div>
          </Card>
        </div>
      )}

      {/* ── ATTACK CALC ── */}
      {innerTab===1 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
          <Card title="⚔️ My Forces">
            <Fields>
              <Field label="Soldiers (3/0)" value={a.soldiers} onChange={v=>sa("soldiers",v)}/>
              <Field label={db?"Off Specs (14/0 ⚡)":"Off Specs (12/0)"} value={a.specs} onChange={v=>sa("specs",v)}/>
              <Field label="Elites (16/2)" value={a.elites} onChange={v=>sa("elites",v)}/>
              <Field label="Mercs (8/0)" value={a.mercs} onChange={v=>sa("mercs",v)}/>
              <Field label="Prisoners (8/0)" value={a.prisoners} onChange={v=>sa("prisoners",v)}/>
              <Field label="Generals" value={a.generals} onChange={v=>sa("generals",v)}/>
              <Field label="OME %" value={a.ome} onChange={v=>sa("ome",v)}/>
            </Fields>
            {divider}
            <Toggle label="Bloodlust (+10% OME, +15% kills)" on={bl} onToggle={()=>setBl(b=>!b)} onLabel="✅ Bloodlust ON" offLabel="❌ OFF"/>
            <Toggle label="Dive Bomb — War Only (Off Specs +2 off)" on={db} onToggle={()=>setDb(d=>!d)} onLabel="✅ Dive Bomb ON" offLabel="❌ OFF"/>
            <Toggle label="Attack Type" on={traditional} onToggle={()=>setTraditional(t=>!t)} onLabel="⚔️ Traditional" offLabel="🏹 Ambush"/>
            {divider}
            <Row label="Raw Offense" value={fmt(myOff)} color={C.blue}/>
            {bl && <Row label="Without BL" value={fmt(myOffNoBL)} color={C.muted}/>}
            {ga && <Row label="General's Authority" value="+15% kills" color={C.purple}/>}
            {db && <Row label="Dive Bomb Active" value="Off Specs +2 off (war)" color={C.blue}/>}
          </Card>

          <Card title="🎯 Target">
            <Fields>
              <Field label="Their Defense" value={a.def} onChange={v=>sa("def",v)}/>
              <Field label="Their Acres" value={a.acres} onChange={v=>sa("acres",v)}/>
              <Field label="Their NW" value={a.theirnw} onChange={v=>sa("theirnw",v)}/>
              <Field label="My NW" value={a.mynw} onChange={v=>sa("mynw",v)}/>
            </Fields>
            {divider}
            <div style={{textAlign:"center",padding:14,background:C.card2,borderRadius:12,marginBottom:8}}>
              <div style={{color:C.muted,fontSize:11,textTransform:"uppercase",marginBottom:4}}>Success Chance</div>
              <div style={{fontSize:36,fontWeight:800,color:cc}}>{chance}%</div>
              <div style={{height:8,background:"#1a1a1a",borderRadius:4,marginTop:8,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${chance}%`,background:cc,borderRadius:4,transition:"width .3s"}}/>
              </div>
            </div>
            <Row label="Off vs Def" value={`${fmt(myOff)} vs ${fmt(theirDef)}`} color={C.muted}/>
            {theirDef>0 && <Row label="Ratio" value={`${(myOff/theirDef).toFixed(2)}x`} color={cc}/>}
            {estAcres!==null && <Row label="~Acres Gained" value={fmt(estAcres)} color={C.green}/>}
            {bl && <Row label="BL Kill Bonus" value="+15% kills" color={C.orange}/>}
            {ga && <Row label="GA Kill Bonus" value="+15% kills" color={C.purple}/>}
            {divider}
            <div style={{padding:12,borderRadius:12,textAlign:"center",fontWeight:700,fontSize:14,
              background:chance>=80?"#052e16":chance>=50?"#1a1200":"#450a0a",
              color:chance>=80?C.green:chance>=50?C.gold:C.red,
              border:`1px solid ${chance>=80?C.green:chance>=50?C.gold:C.red}`}}>
              {chance>=80?"✅ GO — High confidence attack":chance>=65?"⚠️ RISKY — Add 3% more troops":chance>=50?"⚠️ BORDERLINE — Consider more troops":"❌ DO NOT ATTACK"}
            </div>
          </Card>
        </div>
      )}

      {/* ── DRAGON COST ── */}
      {innerTab===2 && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
            <Card title="🐉 Dragon Settings">
              <SelectField label="Dragon Type" value={dragonType} onChange={setDragonType} options={[
                {value:"sapphire",label:"Sapphire — WPA/TPA/Runes (2x cost)"},
                {value:"topaz",label:"Topaz — Buildings/Income/Gold (2x cost)"},
                {value:"emerald",label:"Emerald — Casualties/Gains/Troops (2.4x cost)"},
                {value:"ruby",label:"Ruby — ME/Wages/Specs (2.4x cost)"},
                {value:"amethyst",label:"Amethyst — Spells/Thievery/Wizards (2x cost)"},
              ]}/>
              <div style={{marginTop:10}}>
                <Field label="Target KD Total NW" value={dKdNW} onChange={setDKdNW}/>
              </div>
              {divider}
              <Toggle label="In War? (OOW costs +15% more)" on={dWar} onToggle={()=>setDWar(d=>!d)} onLabel="✅ In War" offLabel="❌ Out of War"/>
              {divider}
              <div style={{fontSize:12,color:C.muted,lineHeight:1.8,marginTop:4}}>{DRAGON_FX[dragonType]}</div>
            </Card>

            <Card title="💰 Dragon Cost">
              <Row label="Dragon Type" value={dragonType.charAt(0).toUpperCase()+dragonType.slice(1)} color={C.blue}/>
              <Row label="Cost Modifier" value={costMod+"x"}/>
              <Row label="War Status" value={dWar?"In War (base cost)":"Out of War (+15%)"} color={dWar?C.green:C.orange}/>
              <Row label="Gold Cost" value={fmt(dGold)+" gc"} color={C.gold} big/>
              <Row label="Food Cost" value={fmt(dFood)+" bushels"} color={C.green}/>
              {divider}
              <SelectField label="Relations (for HP)" value={dRel} onChange={setDRel} options={[
                {value:"0.5",label:"Normal / Unfriendly (0.5x HP)"},
                {value:"0.75",label:"Hostile (0.75x HP)"},
                {value:"1.0",label:"War (1.0x HP)"},
              ]}/>
              <div style={{marginTop:10}}>
                <Field label="Your KD Total NW" value={dMyKdNW} onChange={setDMyKdNW}/>
              </div>
              <div style={{marginTop:8}}>
                <Row label="HP Modifier" value={hpMod}/>
                <Row label="Relations Modifier" value={relMod+"x"}/>
                <Row label="Estimated Dragon HP" value={fmt(dHP)} color={C.red} big/>
              </div>
              <div style={{fontSize:10,color:C.muted,marginTop:8}}>Valor Science increases dragon slaying strength. Send range: ±20-25% KD NW. Auto-cancelled on EoWCF/Ceasefire.</div>
            </Card>
          </div>

          <Card title="🐉 All Dragon Types — Age 116 Quick Reference">
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10}}>
              {Object.entries(DRAGON_FX).map(([type,fx])=>(
                <div key={type} style={{background:C.card2,borderRadius:10,padding:10}}>
                  <div style={{fontWeight:700,color:C.gold,fontSize:12,marginBottom:4,textTransform:"capitalize"}}>{type} Dragon · {DRAGON_MODS[type]}x · HP mod {DRAGON_HP[type]}</div>
                  <div style={{fontSize:11,color:C.muted,lineHeight:1.7}}>{fx}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
