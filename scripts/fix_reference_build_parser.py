from pathlib import Path
import re

p = Path("dashboard/src/components/AIBuildManager.jsx")
s = p.read_text()
new = r'''function parseBuild(text){
  const out={buildings:{},military:{},science:{},spells:{},thievery:{},priorities:[],notes:[],warnings:[]};
  let section="";
  const scienceSections=new Set(["science_economy","science_military","science_arcane","science"]);
  const normalizeMetric=v=>v.toLowerCase().replace(/\s+/g,"");
  const saveMilitary=(label,value,metric,source,minimum=false)=>{
    const cleanMetric=normalizeMetric(metric);
    const key=label?cleanKey(label):cleanKey(cleanMetric);
    if(!key)return;
    out.military[key]={value:Number(value),metric:cleanMetric,minimum:Boolean(minimum),source};
  };
  const saveScience=(name,value,kind,category)=>{
    const cleanName=name.replace(/\s*\(.*?\)\s*$/,'').trim();
    if(!cleanName)return;
    if(kind==="books")out.science[cleanKey(cleanName)]={books:Number(value),category};
    else out.science[cleanKey(cleanName)]={value:Number(value),metric:"%",category};
  };
  for(const [index,raw] of text.split(/\r?\n/).entries()){
    const line=cleanLine(raw); if(!line) continue;
    const upper=line.toUpperCase().trim();
    if(/^(ECONOMY|ECONOMY SCIENCE)$/.test(upper)){section="science_economy";continue}
    if(/^(MILITARY|MILITARY SCIENCE)$/.test(upper)){section="science_military";continue}
    if(/^(ARCANE|ARCANE SCIENCE)$/.test(upper)){section="science_arcane";continue}
    if(/^SCIENCE ALLOCATION$/.test(upper)){section="science";continue}
    if(/^MILITARY PLAN$/.test(upper)){section="military";continue}
    if(/^(BUILD|BUILDINGS)$/.test(upper)){section="buildings";continue}
    let m=line.match(/^(\d+(?:\.\d+)?)\s*x\s+(.+?)\s*$/i);
    if(m && scienceSections.has(section)){saveScience(m[2],m[1],"books",section.replace("science_",""));continue}
    m=line.match(/^(\d+(?:\.\d+)?)\s*%\s+(.+?)\s*$/i);
    if(m && scienceSections.has(section)){saveScience(m[2],m[1],"percent",section.replace("science_",""));continue}
    m=line.match(/^(.+?)\s*[—-]\s*(\d+(?:\.\d+)?)\s*books?\b/i);
    if(m){saveScience(m[1],m[2],"books",section||"unknown");continue}
    m=line.match(/^(.+?)\s*[—-]\s*(\d+(?:\.\d+)?)\s*(ppa|tpa|wpa|dspa|ospa|epa\s*\/\s*dspa|epa\s*\/\s*ospa)\s*$/i);
    if(m){saveMilitary(m[1].trim(),m[2],m[3],line,/at least|minimum|first|fill|\+/i.test(m[1]));continue}
    m=line.match(/^(\d+(?:\.\d+)?)\s*(ppa|tpa|wpa|dspa|ospa|epa\s*\/\s*dspa|epa\s*\/\s*ospa)\s*$/i);
    if(m){saveMilitary("",m[1],m[2],line,false);continue}
    m=line.match(/^(.+?)\s*[—-]\s*(\d+(?:\.\d+)?)\s*%\s*$/);
    if(m){const key=normalizeBuilding(m[1]);if(key&&!/set_by|build|military|science|allocation/.test(key)){out.buildings[key]={value:Number(m[2]),metric:"%",kind:"target"};continue}}
    m=line.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*%\s*$/);
    if(m){const key=normalizeBuilding(m[1].replace(/\s*\(.*?\)\s*$/,''));if(key&&!/set_by|build|military|science|allocation/.test(key)){out.buildings[key]={value:Number(m[2]),metric:"%",kind:"target"};continue}}
    if(/^(🏗|🎖|—)?\s*(HALFLING|PLAN|SPELL|THIEV)/i.test(line))continue;
    if(/^(peasants|thieves|wizards|off specs|elites\/acre|this means how many books|economy science|military science|arcane science|science allocation)/i.test(line))continue;
    if(/^(🏗|🎖|—|SCIENCE|ECONOMY|MILITARY|ARCANE)/i.test(line))continue;
    out.warnings.push({line:index+1,text:line});
  }
  return out;
}'''
pat=r'function parseBuild\(text\)\{.*?\n?function typeLabel'
s2,n=re.subn(pat,lambda _m: new+'\nfunction typeLabel',s,count=1,flags=re.S)
if n!=1: raise SystemExit('parseBuild function not found')
p.write_text(s2)
print('patched universal military/build/science parser',p)
