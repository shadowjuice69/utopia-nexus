from pathlib import Path
import re

p=Path("dashboard/src/components/AIBuildManager.jsx")
s=p.read_text()
new=r'''function parseBuild(text){
  const out={buildings:{},military:{},science:{},spells:{},thievery:{},priorities:[],warnings:[]};
  let section="";
  const scienceSections=new Set(["science_economy","science_military","science_arcane","science"]);
  const metricRe=/(epa\s*\/\s*(?:dspa|ospa)|ppa|tpa|wpa|dspa|ospa|epa)/i;
  const saveMilitary=(label,value,metric,source)=>{
    const cleanMetric=String(metric).toLowerCase().replace(/\s+/g,"");
    const key=label?cleanKey(label):cleanKey(cleanMetric);
    if(key)out.military[key]={value:Number(value),metric:cleanMetric,minimum:/at least|minimum|first|fill|\+/i.test(source),source};
  };
  const saveScience=(name,value,kind,category)=>{
    const cleanName=String(name).replace(/\s*\(.*?\)\s*$/,'').trim();
    const key=cleanKey(cleanName);
    if(!key)return;
    out.science[key]=kind==="books"?{books:Number(value),category}:{value:Number(value),metric:"%",category};
  };
  const saveBuilding=(name,value)=>{
    const key=normalizeBuilding(String(name).replace(/\s*\(.*?\)\s*$/,''));
    if(!key||/^(build|buildings|military|science|allocation|economy|arcane|plan)$/.test(key))return false;
    out.buildings[key]={value:Number(value),metric:"%",kind:"target"};
    return true;
  };
  for(const [index,raw] of String(text||"").split(/\r?\n/).entries()){
    let line=cleanLine(raw).replace(/^[🎖🏗📌#>*\s]+/,"").trim();
    if(!line)continue;
    const upper=line.toUpperCase().replace(/[:：]+$/,'').trim();
    if(/^(ECONOMY|ECONOMY SCIENCE)$/.test(upper)){section="science_economy";continue}
    if(/^(MILITARY|MILITARY SCIENCE)$/.test(upper)){section="science_military";continue}
    if(/^(ARCANE|ARCANE SCIENCE)$/.test(upper)){section="science_arcane";continue}
    if(/^SCIENCE( ALLOCATION)?$/.test(upper)){section="science";continue}
    if(/^(MILITARY PLAN|MILITARY TARGETS?|MIL PLAN)$/.test(upper)){section="military";continue}
    if(/^(BUILD|BUILDING|BUILDINGS|BUILD PLAN)$/.test(upper)){section="buildings";continue}
    if(/^UPDATED SCI PLACEMENT$|^THIS MEANS HOW MANY BOOKS|^LIVE PIN\b|^RENDERED\b|^\.UNPIN\b/i.test(line))continue;

    let m=line.match(/^([0-9]+(?:\.[0-9]+)?)\s*x\s+(.+?)\s*$/i);
    if(m&&scienceSections.has(section)){saveScience(m[2],m[1],"books",section.replace("science_",""));continue}
    m=line.match(/^([0-9]+(?:\.[0-9]+)?)\s*%\s+(.+?)\s*$/i);
    if(m&&scienceSections.has(section)){saveScience(m[2],m[1],"percent",section.replace("science_",""));continue}
    m=line.match(/^(.+?)\s*[—-]\s*([0-9]+(?:\.[0-9]+)?)\s*books?\b/i);
    if(m){saveScience(m[1],m[2],"books",section.startsWith("science_")?section.replace("science_",""):"unknown");continue}

    m=line.match(new RegExp("^(.+?)\\s*[—-]\\s*([0-9]+(?:\\.[0-9]+)?)\\s*\\+?\\s*("+metricRe.source+")\\s*$","i"));
    if(m&&section==="military"){saveMilitary(m[1],m[2],m[3],line);continue}
    m=line.match(new RegExp("^(.+?)\\s+([0-9]+(?:\\.[0-9]+)?)\\s*\\+?\\s*("+metricRe.source+")\\s*$","i"));
    if(m&&section==="military"){saveMilitary(m[1],m[2],m[3],line);continue}
    m=line.match(new RegExp("^([0-9]+(?:\\.[0-9]+)?)\\s*\\+?\\s*("+metricRe.source+")\\s*$","i"));
    if(m){saveMilitary("",m[1],m[2],line);continue}

    m=line.match(/^(.+?)\s*[—-]\s*([0-9]+(?:\.[0-9]+)?)\s*%\s*$/);
    if(m&&saveBuilding(m[1],m[2]))continue;
    m=line.match(/^(.+?)\s+([0-9]+(?:\.[0-9]+)?)\s*%\s*$/);
    if(m&&saveBuilding(m[1],m[2]))continue;
    if(/^(peasants\/acre|thieves\/acre|wizards\/acre|off specs\/acre|def specs\/acre|elites\/acre)$/i.test(line))continue;
    out.warnings.push({line:index+1,text:line});
  }
  return out;
}'''
pat=r'function parseBuild\(text\)\{.*?\nfunction typeLabel'
s2,n=re.subn(pat,lambda _:new+'\nfunction typeLabel',s,count=1,flags=re.S)
if n!=1:raise SystemExit('parseBuild function not found')
p.write_text(s2)
print('rewrote universal full-build parser')
