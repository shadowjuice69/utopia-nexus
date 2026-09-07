import { useMemo, useState } from "react";

const C={bg:"#0c0c0f",card:"#17171d",card2:"#202028",border:"#34343d",text:"#f4f4f5",muted:"#a1a1aa",gold:"#f5c542",green:"#22c55e",red:"#ef4444",blue:"#38bdf8"};
const n=v=>{const x=parseFloat(String(v??"").replace(/,/g,""));return Number.isFinite(x)?x:0};
const fmt=x=>Math.ceil(x||0).toLocaleString("en-US");
function Field({label,value,onChange,note}){return <div><label style={{display:"block",fontSize:11,color:C.muted,marginBottom:4,textTransform:"uppercase"}}>{label}</label><input inputMode="decimal" value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",boxSizing:"border-box",background:"#0d0d12",color:C.text,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 10px",fontSize:14}}/>{note&&<div style={{fontSize:10,color:C.muted,marginTop:3}}>{note}</div>}</div>}
function Card({title,children}){return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:14,marginBottom:12}}><div style={{color:C.gold,fontWeight:700,fontSize:15,marginBottom:10}}>{title}</div>{children}</div>}
function Row({label,value,color}){return <div style={{display:"flex",justifyContent:"space-between",gap:12,padding:"8px 10px",marginBottom:4,borderRadius:9,background:C.card2,fontSize:13}}><span style={{color:C.muted}}>{label}</span><strong style={{color:color||C.text}}>{value}</strong></div>}
export default function AmbushCalculator(){
 const [enemy,setEnemy]=useState({acres:"297",soldiers:"0",offSpecs:"4057",elites:"5308",generals:"1",dme:"100",soldierOff:"3",specDef:"10",eliteDef:"16"});
 const [att,setAtt]=useState({soldiers:"0",offSpecs:"0",elites:"0",horses:"0",generals:"1",ome:"100",soldierOff:"3",specOff:"12",eliteOff:"16",horseOff:"1"});
 const [flags,setFlags]=useState({anonymous:false,spoils:false,already:false});
 const setE=(k,v)=>setEnemy(p=>({...p,[k]:v})); const setA=(k,v)=>setAtt(p=>({...p,[k]:v}));
 const calc=useMemo(()=>{
   const eS=n(enemy.soldiers),eO=n(enemy.offSpecs),eE=n(enemy.elites),dme=n(enemy.dme)/100;
   // Ambush: horses do not defend; soldiers defend at offensive value; one general counts.
   const rawDef=eS*n(enemy.soldierOff)+eO*n(enemy.specDef)+eE*n(enemy.eliteDef);
   const modDef=Math.max(rawDef*dme,n(enemy.acres));
   const required=modDef*.80;
   const generalBonus=1+Math.max(0,n(att.generals)-1)*.05;
   const unitOff=eS=>0;
   const perSoldier=n(att.soldierOff)*n(att.ome)/100*generalBonus;
   const perSpec=n(att.specOff)*n(att.ome)/100*generalBonus;
   const perElite=n(att.eliteOff)*n(att.ome)/100*generalBonus;
   const perHorse=n(att.horseOff)*n(att.ome)/100*generalBonus;
   const available=n(att.soldiers)*perSoldier+n(att.offSpecs)*perSpec+n(att.elites)*perElite+n(att.horses)*perHorse;
   // "Amount to Send" is solved as the smallest whole attacking army from the selected send mix.
   // If the user supplies an existing mix, solve by total-unit average offense; otherwise solve soldiers.
   const mix=[n(att.soldiers),n(att.offSpecs),n(att.elites),n(att.horses)]; const total=mix.reduce((a,b)=>a+b,0);
   const avg=total>0?available/total:perSoldier;
   const amount=avg>0?Math.ceil(required/avg):0;
   const qualified=available>=required;
   const blocked=flags.anonymous||flags.spoils||flags.already;
   return {rawDef,modDef,required,available,avg,amount,qualified,blocked};
 },[enemy,att,flags]);
 const eligible=!calc.blocked;
 return <div style={{padding:4}}>
   <Card title="⚔️ Ambush — Amount to Send">
     <div style={{fontSize:12,color:C.muted,lineHeight:1.5,marginBottom:10}}>Enter the enemy's SoM and your attacking military setup. Ambush requires your Mod Offense to reach at least 80% of the enemy's applicable Ambush defense.</div>
     <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
       <Card title="Enemy SoM"><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:9}}>
         <Field label="Enemy Acres" value={enemy.acres} onChange={v=>setE("acres",v)}/><Field label="Soldiers" value={enemy.soldiers} onChange={v=>setE("soldiers",v)}/><Field label="Off Specs" value={enemy.offSpecs} onChange={v=>setE("offSpecs",v)}/><Field label="Elites" value={enemy.elites} onChange={v=>setE("elites",v)}/><Field label="Generals" value={enemy.generals} onChange={v=>setE("generals",v)}/><Field label="Enemy DME %" value={enemy.dme} onChange={v=>setE("dme",v)}/>
         <Field label="Soldier Off Value" value={enemy.soldierOff} onChange={v=>setE("soldierOff",v)}/><Field label="Spec Def Value" value={enemy.specDef} onChange={v=>setE("specDef",v)}/><Field label="Elite Def Value" value={enemy.eliteDef} onChange={v=>setE("eliteDef",v)}/>
       </div></Card>
       <Card title="Your Ambush Army"><div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:9}}>
         <Field label="Soldiers to Mix" value={att.soldiers} onChange={v=>setA("soldiers",v)}/><Field label="Off Specs to Mix" value={att.offSpecs} onChange={v=>setA("offSpecs",v)}/><Field label="Elites to Mix" value={att.elites} onChange={v=>setA("elites",v)}/><Field label="Horses to Mix" value={att.horses} onChange={v=>setA("horses",v)}/><Field label="Generals" value={att.generals} onChange={v=>setA("generals",v)}/><Field label="OME %" value={att.ome} onChange={v=>setA("ome",v)}/><Field label="Soldier Off" value={att.soldierOff} onChange={v=>setA("soldierOff",v)}/><Field label="Spec Attack" value={att.specOff} onChange={v=>setA("specOff",v)}/><Field label="Elite Attack" value={att.eliteOff} onChange={v=>setA("eliteOff",v)}/><Field label="Horse Attack" value={att.horseOff} onChange={v=>setA("horseOff",v)}/>
       </div></Card>
     </div>
   </Card>
   <Card title="Ambush Eligibility"><Row label="Anonymity" value={flags.anonymous?"BLOCKED":"Allowed"} color={flags.anonymous?C.red:C.green}/><Row label="War Spoils" value={flags.spoils?"BLOCKED":"Allowed"} color={flags.spoils?C.red:C.green}/><Row label="Army already ambushed" value={flags.already?"BLOCKED":"Allowed"} color={flags.already?C.red:C.green}/><div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>{[["anonymous","Anonymity"],["spoils","War Spoils"],["already","Already Ambushed"]].map(([k,l])=><button key={k} onClick={()=>setFlags(p=>({...p,[k]:!p[k]}))} style={{padding:"7px 10px",borderRadius:8,border:`1px solid ${flags[k]?C.red:C.border}`,background:flags[k]?"#450a0a":C.card2,color:flags[k]?C.red:C.muted}}>{l}: {flags[k]?"ON":"OFF"}</button>)}</div></Card>
   <Card title="📊 Result"><Row label="Raw Ambush Defense" value={fmt(calc.rawDef)}/><Row label="Modified Ambush Defense" value={fmt(calc.modDef)}/><Row label="80% Break Requirement" value={fmt(calc.required)}/><Row label="Your Current Mod Offense" value={fmt(calc.available)}/><Row label="Estimated Amount to Send" value={eligible&&calc.amount?fmt(calc.amount):"—"} color={eligible?(calc.qualified?C.green:C.red):C.red}/><Row label="Ambush Status" value={!eligible?"BLOCKED":calc.qualified?"QUALIFIED":"NOT ENOUGH OFFENSE"} color={!eligible||!calc.qualified?C.red:C.green}/></Card>
   <Card title="Ambush Outcome"><Row label="Acres Returned" value={`${fmt(n(enemy.acres)*.5)} (50%)`}/><Row label="Offensive Military Casualties" value="+15%"/><Row label="Hostile Meter" value="+1.5"/></Card>
   <div style={{fontSize:10,color:C.muted,padding:"2px 6px 12px"}}>The displayed send requirement is solved from the entered attacking unit mix. Military unit values, OME and DME are explicit inputs so the calculator does not silently assume a race, personality, age, or science setup.</div>
 </div>;
}
