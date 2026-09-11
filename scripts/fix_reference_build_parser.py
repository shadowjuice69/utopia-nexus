from pathlib import Path
import re

TARGET = Path("dashboard/src/components/AIBuildManager.jsx")

PARSER = r'''function parseBuild(text){
  const out={buildings:{},military:{},science:{},spells:{},thievery:{},priorities:[],warnings:[]};
  let section="";
  const scienceSections=new Set(["science_economy","science_military","science_arcane","science"]);
  const numberPattern=r"\\d+(?:\\.\\d+)?";
  const normalizeMetric=v=>String(v||"").toLowerCase().replace(/\\s+/g,"");
  const saveMilitary=(label,value,metric,source,minimum=false)=>{
    const cleanMetric=normalizeMetric(metric);
    const key=label ? cleanKey(label) : cleanKey(cleanMetric);
    if(!key)return;
    out.military[key]={value:Number(value),metric:cleanMetric,minimum:Boolean(minimum),source};
  };
  const saveScience=(name,value,kind,category)=>{
    const cleanName=String(name||"").replace(/\\s*\\(.*?\\)\\s*$/,'').trim();
    if(!cleanName)return;
    const key=cleanKey(cleanName);
    if(!key)return;
    if(kind==="books") out.science[key]={books:Number(value),category};
    else out.science[key]={value:Number(value),metric:"%",category};
  };
  const saveBuilding=(name,value)=>{
    const key=normalizeBuilding(String(name||"").replace(/\\s*\\(.*?\\)\\s*$/,''));
    if(!key || /^(set_by|build|buildings|military|military_plan|science|science_allocation|economy|arcane|plan)$/.test(key)) return false;
    out.buildings[key]={value:Number(value),metric:"%",kind:"target"};
    return true;
  };
  const militaryMetric=/(epa\\s*\\/\\s*(?:dspa|ospa)|ppa|tpa|wpa|dspa|ospa|epa)/i;
  for(const [index,raw] of String(text||"").split(/\\r?\\n/).entries()){
    let line=cleanLine(raw);
    if(!line)continue;
    line=line.replace(/^[🎖🏗📌#>*\\s]+/,"").trim();
    const upper=line.toUpperCase().replace(/[:：]+$/,'').trim();

    // Section headers are handled before any generic value parser.
    if(/^(?:ECONOMY|ECONOMY SCIENCE|ECONOMY SCIENCE ALLOCATION)$/.test(upper)){section="science_economy";continue;}
    if(/^(?:MILITARY|MILITARY SCIENCE|MILITARY SCIENCE ALLOCATION)$/.test(upper)){section="science_military";continue;}
    if(/^(?:ARCANE|ARCANE SCIENCE|ARCANE SCIENCE ALLOCATION)$/.test(upper)){section="science_arcane";continue;}
    if(/^(?:SCIENCE|SCIENCE ALLOCATION)$/.test(upper)){section="science";continue;}
    if(/^(?:MILITARY PLAN|MILITARY TARGETS?|MIL PLAN)$/.test(upper)){section="military";continue;}
    if(/^(?:BUILD|BUILDING|BUILDINGS|BUILD PLAN)$/.test(upper)){section="buildings";continue;}

    // Discord/Markdown decorations and explanatory lines are not data.
    if(/^UPDATED SCI PLACEMENT$/i.test(line))continue;
    if(/^THIS MEANS HOW MANY BOOKS/i.test(line))continue;
    if(/^LIVE PIN\\b/i.test(line))continue;
    if(/^RENDERED\\b/i.test(line))continue;
    if(/^\\.UNPIN\\b/i.test(line))continue;

    // Science books: "4x Alchemy", "15x Channeling", including zero and decimals.
    let m=line.match(new RegExp("^(["+numberPattern+"])\\\\s*x\\\\s+(.+?)\\\\s*$","i"));
    if(m && scienceSections.has(section)){
      saveScience(m[2],m[1],"books",section.replace("science_",""));
      continue;
    }
    // Science percentage: "4.2% Artisan (actual % needed)".
    m=line.match(new RegExp("^(["+numberPattern+"])\\\\s*%\\\\s+(.+?)\\\\s*$","i"));
    if(m && scienceSections.has(section)){
      saveScience(m[2],m[1],"percent",section.replace("science_",""));
      continue;
    }
    // Alternate science forms: "Alchemy — 4 books" / "Alchemy - 4 books".
    m=line.match(new RegExp("^(.+?)\\\\s*[—-]\\\\s*("+numberPattern+")\\\\s*books?\\\\b","i"));
    if(m){saveScience(m[1],m[2],"books",section.startsWith("science_")?section.replace("science_",""):"unknown");continue;}

    // Military compact: "5.5ppa", "3+wpa", "11+epa/ospa" and spaced variants.
    m=line.match(new RegExp("^(?:.+?\\\\s*[—-]\\\\s*)?("+numberPattern+")\\\\s*\\\\+?\\\\s*("+militaryMetric.source+")\\\\s*$","i"));
    if(m && section==="military"){
      const prefix=line.match(/^(.+?)\\s*[—-]\\s*/);
      const label=prefix?prefix[1].trim():"";
      const metric=m[2];
      saveMilitary(label,m[1],metric,line,/at least|minimum|first|fill|\\+/i.test(line));
      continue;
    }
    // Military labeled form without a dash: "wizards/acre (at least) 3+wpa".
    m=line.match(new RegExp("^(.+?)\\\\s+("+numberPattern+")\\\\s*\\\\+?\\\\s*("+militaryMetric.source+")\\\\s*$","i"));
    if(m && section==="military"){
      saveMilitary(m[1].trim(),m[2],m[3],line,/at least|minimum|first|fill|\\+/i.test(m[1]));
      continue;
    }

    // Buildings, always after science/military so those values cannot leak into buildings.
    m=line.match(new RegExp("^(.+?)\\\\s*[—-]\\\\s*("+numberPattern+")\\\\s*%\\\\s*$"));
    if(m && saveBuilding(m[1],m[2]))continue;
    m=line.match(new RegExp("^(.+?)\\\\s+("+numberPattern+")\\\\s*%\\\\s*$"));
    if(m && saveBuilding(m[1],m[2]))continue;

    // Compact military can also appear outside the explicit header; only accept an exact metric line.
    m=line.match(new RegExp("^("+numberPattern+")\\\\s*\\\\+?\\\\s*("+militaryMetric.source+")\\\\s*$","i"));
    if(m){saveMilitary("",m[1],m[2],line,/\\+/.test(line));continue;}

    // Known prose/formatting from Savage's Discord posts.
    if(/^(?:peasants\\/acre|thieves\\/acre|wizards\\/acre|off specs\\/acre|def specs\\/acre|elites\\/acre|economy science|military science|arcane science|science allocation)$/i.test(line))continue;
    if(/^(?:build|buildings|military plan|military|economy|arcane|science)$/i.test(line))continue;

    out.warnings.push({line:index+1,text:line});
  }
  return out;
}'''

s=TARGET.read_text()
pattern=r"function parseBuild\\(text\\)\\{.*?\\nfunction typeLabel"
s2,n=re.subn(pattern,lambda _m:PARSER+"\nfunction typeLabel",s,count=1,flags=re.S)
if n!=1:
    raise SystemExit("parseBuild function not found")
TARGET.write_text(s2)
print(f"rewrote universal full-build parser in {TARGET}")
