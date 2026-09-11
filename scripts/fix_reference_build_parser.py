from pathlib import Path
import re

p = Path("dashboard/src/components/AIBuildManager.jsx")
s = p.read_text()
new = r'''function parseBuild(text){
  const out={buildings:{},military:{},science:{},spells:{},thievery:{},priorities:[],warnings:[]};
  let section="";
  const scienceSections=new Set(["science_economy","science_military","science_arcane","science"]);
  for(const [index,raw] of text.split(/\r?\n/).entries()){
    const line=cleanLine(raw); if(!line) continue;
    const upper=line.toUpperCase().trim();
    if(/^(ECONOMY|ECONOMY SCIENCE)$/.test(upper)){section="science_economy";continue}
    if(/^(MILITARY|MILITARY SCIENCE)$/.test(upper)){section="science_military";continue}
    if(/^(ARCANE|ARCANE SCIENCE)$/.test(upper)){section="science_arcane";continue}
    if(/^SCIENCE ALLOCATION$/.test(upper)){section="science";continue}
    if(/^(🏗|🎖|—)?\s*(HALFLING|BUILD|BUILDINGS|MILITARY PLAN|SCIENCE ALLOCATION|SPELL|THIEV|PLAN)/i.test(line)){
      if(/BUILD/i.test(line)) section="buildings";
      else if(/MILITARY PLAN/i.test(line)) section="military";
      continue;
    }
    let m=line.match(/^(\d+(?:\.\d+)?)\s*x\s+(.+?)\s*$/i);
    if(m && scienceSections.has(section)){
      const name=m[2].replace(/\s*\(.*?\)\s*$/,'').trim();
      if(name) out.science[cleanKey(name)]={books:Number(m[1]),category:section.replace("science_","")};
      continue;
    }
    m=line.match(/^(\d+(?:\.\d+)?)\s*%\s+(.+?)\s*$/i);
    if(m && scienceSections.has(section)){
      const name=m[2].replace(/\s*\(.*?\)\s*$/,'').trim();
      if(name) out.science[cleanKey(name)]={value:Number(m[1]),metric:"%",category:section.replace("science_","")};
      continue;
    }
    m=line.match(/^(.+?)\s*[—-]\s*(\d+(?:\.\d+)?)\s*%\s*$/);
    if(m){const key=normalizeBuilding(m[1]);if(key&&!/set_by|build|military|science|allocation/.test(key)){out.buildings[key]={value:Number(m[2]),metric:"%",kind:"target"};continue}}
    m=line.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*%\s*$/);
    if(m){const key=normalizeBuilding(m[1].replace(/\s*\(.*?\)\s*$/,''));if(key&&!/set_by|build|military|science|allocation/.test(key)){out.buildings[key]={value:Number(m[2]),metric:"%",kind:"target"};continue}}
    m=line.match(/^(.+?)\s*[—-]\s*(\d+(?:\.\d+)?\+?)\s*(ppa|tpa|wpa|ospa|epa\/dspa)\b/i);
    if(m){const label=m[1].trim();out.military[cleanKey(label)]={value:Number(m[2].replace("+","")),minimum:m[2].includes("+")||/at least|minimum|first|fill/i.test(label),metric:m[3].toLowerCase(),source:line};continue}
    m=line.match(/^(.+?)\s*[—-]\s*(\d+)\s*books?\b/i);
    if(m){out.science[cleanKey(m[1])]={books:Number(m[2]),category:section||"unknown"};continue}
    if(/^(peasants|thieves|wizards|off specs|elites\/acre|this means how many books|economy science|military science|arcane science|science allocation)/i.test(line))continue;
    if(/^barren\s*[—-]\s*\d+%$/i.test(line)){out.buildings.barren_lands={value:0,metric:"%",kind:"target"};continue}
    if(/^(🏗|🎖|—|SCIENCE|ECONOMY|MILITARY|ARCANE)/i.test(line))continue;
    out.warnings.push({line:index+1,text:line});
  }
  for(const x of text.matchAll(/^\s*(peasants|thieves|wizards|off specs|elites\/acre[^—-]*)\s*[—-]\s*([\d+.]+)\s*(ppa|tpa|wpa|ospa|epa\/dspa)\b.*$/gim)){const label=x[1].trim();out.military[cleanKey(label)]={value:Number(x[2]),metric:x[3].toLowerCase(),minimum:/at least|first/i.test(label),source:x[0].trim()}}
  return out;
}'''
pat=r'function parseBuild\(text\)\{.*?\n?function typeLabel'
s2,n=re.subn(pat,new+'\nfunction typeLabel',s,count=1,flags=re.S)
if n!=1: raise SystemExit('parseBuild function not found')
p.write_text(s2)
print('patched',p)

# Trigger the workflow after the parser patch is committed.
