// ==UserScript==
// @name         Utopia Nexus Universal Intel Scraper
// @namespace    utopia-nexus
// @version      6.8.1
// @updateURL    https://raw.githubusercontent.com/shadowjuice69/utopia-nexus/main/tampermonkey/nexus-scraper.user.js
// @downloadURL  https://raw.githubusercontent.com/shadowjuice69/utopia-nexus/main/tampermonkey/nexus-scraper.user.js
// @description  Universal Utopia intel collector with kingdom cycler and AI analysis trigger
// @match        https://intel.utopia.site/*
// @match        https://www.utopia-game.com/*
// @match        https://utopia-game.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      utopia-nexus.onrender.com
// @run-at       document-start
// ==/UserScript==

(function () {
"use strict";

const ENDPOINT = "https://utopia-nexus.onrender.com/intel";
const KEY = "NikkoAce";
const MY_KD = "6:9";

// Cycler state (persisted via GM_setValue)
let cyclerRunning = false;
let cyclerTotal = 0;
let cyclerCurrent = 0;
let cyclerMode = ""; // "kingdom" or "intel-site"

// ─── TOAST & STATUS ───────────────────────────────────────────────────────────

function toast(message, good = true) {
  let old = document.getElementById("nexus-toast");
  if (old) old.remove();
  let t = document.createElement("div");
  t.id = "nexus-toast";
  t.textContent = message;
  t.style.cssText =
    "position:fixed;top:20px;right:20px;z-index:2147483647;" +
    "padding:12px 16px;border-radius:8px;font:bold 13px monospace;" +
    "color:white;background:" + (good ? "#238636" : "#da3633") + ";";
  document.body.appendChild(t);
  setTimeout(() => { if (t.parentNode) t.remove(); }, 3000);
}

function setStatus(message, good = true) {
  let bar = document.getElementById("nexus-status");
  if (!bar) return;
  bar.textContent = "⚡ " + message;
  bar.style.background = good ? "#1a472a" : "#6e1a1a";
}

function updatePanel() {
  let panel = document.getElementById("nexus-panel");
  if (!panel) return;
  let running = GM_getValue("cycler_running", false);
  let current = GM_getValue("cycler_current", 0);
  let total = GM_getValue("cycler_total", 0);
  let mode = GM_getValue("cycler_mode", "");
  let done = GM_getValue("cycler_done", false);

  if (done) {
    panel.innerHTML = `
      <div style="font:bold 14px monospace;color:#56d364;margin-bottom:8px;">✅ Nexus Cycler Complete</div>
      <div style="font:12px monospace;color:#ccc;margin-bottom:4px;">${total}/${total} kingdoms scraped</div>
      <div style="font:12px monospace;color:#aaa;margin-bottom:12px;">AI analysis running...</div>
      <div style="display:flex;gap:8px;">
        <button id="nexus-view-btn" style="flex:1;padding:8px;background:#1f6feb;color:white;border:none;border-radius:6px;font:bold 12px monospace;cursor:pointer;">📊 View Dashboard</button>
        <button id="nexus-reset-btn" style="flex:1;padding:8px;background:#444;color:white;border:none;border-radius:6px;font:bold 12px monospace;cursor:pointer;">🔄 Run Again</button>
      </div>`;
    document.getElementById("nexus-view-btn").onclick = () => {
      window.open("https://dashboard-gold-six-11.vercel.app", "_blank");
    };
    document.getElementById("nexus-reset-btn").onclick = () => {
      GM_setValue("cycler_running", false);
      GM_setValue("cycler_done", false);
      GM_setValue("cycler_current", 0);
      GM_setValue("cycler_total", 0);
      updatePanel();
    };
    return;
  }

  if (running) {
    let pct = total > 0 ? Math.round((current / total) * 100) : 0;
    let filled = Math.round(pct / 5);
    let bar = "█".repeat(filled) + "░".repeat(20 - filled);
    panel.innerHTML = `
      <div style="font:bold 14px monospace;color:#56d364;margin-bottom:6px;">⚡ Nexus Cycler</div>
      <div style="font:12px monospace;color:#ccc;margin-bottom:2px;">Mode: ${mode || "kingdom"}</div>
      <div style="font:12px monospace;color:#ccc;margin-bottom:6px;">Progress: ${current} / ${total} kingdoms</div>
      <div style="font:11px monospace;color:#56d364;margin-bottom:8px;letter-spacing:0;">${bar} ${pct}%</div>
      <div style="display:flex;gap:8px;">
        <button id="nexus-pause-btn" style="flex:1;padding:8px;background:#6e3a00;color:white;border:none;border-radius:6px;font:bold 12px monospace;cursor:pointer;">⏸ Pause</button>
        <button id="nexus-stop-btn" style="flex:1;padding:8px;background:#6e1a1a;color:white;border:none;border-radius:6px;font:bold 12px monospace;cursor:pointer;">⏹ Stop</button>
      </div>`;
    document.getElementById("nexus-pause-btn").onclick = () => {
      GM_setValue("cycler_running", false);
      updatePanel();
    };
    document.getElementById("nexus-stop-btn").onclick = () => {
      GM_setValue("cycler_running", false);
      GM_setValue("cycler_done", false);
      GM_setValue("cycler_current", 0);
      GM_setValue("cycler_total", 0);
      updatePanel();
    };
  } else {
    let minimized = GM_getValue("panel_minimized", false);
    if (minimized) {
      panel.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font:bold 12px monospace;color:#56d364;">⚡ Nexus</div>
          <button id="nexus-expand-btn" style="padding:2px 8px;background:#238636;color:white;border:none;border-radius:4px;font:bold 11px monospace;cursor:pointer;">▼</button>
        </div>`;
      panel.style.width = "120px";
      panel.style.padding = "8px 12px";
      document.getElementById("nexus-expand-btn").onclick = () => {
        GM_setValue("panel_minimized", false);
        panel.style.width = "220px";
        panel.style.padding = "16px";
        updatePanel();
      };
    } else {
      panel.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <div style="font:bold 14px monospace;color:#56d364;">⚡ Nexus Cycler</div>
          <button id="nexus-min-btn" style="padding:2px 8px;background:#333;color:#aaa;border:none;border-radius:4px;font:bold 11px monospace;cursor:pointer;">—</button>
        </div>
        <div style="font:12px monospace;color:#aaa;margin-bottom:12px;">Auto-scrape enemy kingdoms</div>
        <button id="nexus-start-btn" style="width:100%;padding:10px;background:#238636;color:white;border:none;border-radius:6px;font:bold 13px monospace;cursor:pointer;">▶ Start Cycling</button>`;
      document.getElementById("nexus-start-btn").onclick = startCycler;
      document.getElementById("nexus-min-btn").onclick = () => {
        GM_setValue("panel_minimized", true);
        panel.style.width = "120px";
        panel.style.padding = "8px 12px";
        updatePanel();
      };
    }
  }
}

function startCycler() {
  GM_setValue("cycler_running", true);
  GM_setValue("cycler_done", false);
  GM_setValue("cycler_current", 0);
  GM_setValue("cycler_total", 76);
  GM_setValue("cycler_mode", location.hostname.includes("intel") ? "intel-site" : "kingdom");
  updatePanel();
  toast("Cycler started!", true);
  setTimeout(() => { scrapeAndAdvance(); }, 2000);
}

function scrapeAndAdvance() {
  if (!GM_getValue("cycler_running", false)) return;
  let current = GM_getValue("cycler_current", 0);
  let total = GM_getValue("cycler_total", 76);
  if (current >= total) {
    GM_setValue("cycler_running", false);
    GM_setValue("cycler_done", true);
    updatePanel();
    triggerAIAnalysis();
    return;
  }
  if (location.hostname.includes("intel.utopia.site")) {
    sendIntel(true, () => {
      GM_setValue("cycler_current", current + 1);
      updatePanel();
      setTimeout(() => { clickNextKingdom(); }, 3000);
    });
  } else {
    scrapeKingdomPage(() => {
      GM_setValue("cycler_current", current + 1);
      updatePanel();
      setTimeout(() => { clickNext(); }, 4000);
    });
  }
}

function clickNext() {
  let buttons = document.querySelectorAll("input[type=button], button, a");
  for (let btn of buttons) {
    let txt = btn.value || btn.textContent || "";
    if (txt.trim().toLowerCase().includes("next")) { btn.click(); return; }
  }
  let all = document.querySelectorAll("*");
  for (let el of all) {
    if (el.childNodes.length === 1 && el.textContent.trim() === "Next >") { el.click(); return; }
  }
  setStatus("Next button not found", false);
}

function clickNextKingdom() {
  let select = document.querySelector("select");
  if (select) {
    let current = select.selectedIndex;
    if (current < select.options.length - 1) {
      select.selectedIndex = current + 1;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      setTimeout(() => scrapeAndAdvance(), 3000);
    } else {
      GM_setValue("cycler_running", false);
      GM_setValue("cycler_done", true);
      updatePanel();
      triggerAIAnalysis();
    }
  }
}

function triggerAIAnalysis() {
  GM_xmlhttpRequest({
    method: "POST",
    url: "https://utopia-nexus.onrender.com/ai/analyze",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    data: "key=" + encodeURIComponent(KEY) + "&trigger=cycler_complete",
    onload: function (r) { if (r.status === 200) { toast("✅ AI analysis started!", true); setStatus("AI analyzing..."); } },
    onerror: function () { toast("AI trigger failed", false); }
  });
}

function scrapeKingdomPage(callback) {
  if (!document.body) { if (callback) callback(); return; }
  let text = document.body.innerText;
  let kdName = "Unknown";
  let kdNamePatterns = [
    /(?:The\s+)?kingdom\s+of\s+([^\n\r(]+?)(?:\s*\(\d+:\d+\))?\s*$/im,
    /kingdom\s+name\s*[:\-]\s*([^\n\r]+)/i,
    /kingdom\s*[:\-]\s*([^\n\r]+)/i
  ];
  for (let ptn of kdNamePatterns) {
    let m = text.match(ptn);
    if (m && m[1]) {
      let candidate = m[1].trim().replace(/\s+/g, " ");
      if (candidate && !/^details?$/i.test(candidate) && !/^kingdom$/i.test(candidate)) { kdName = candidate; break; }
    }
  }
  let kdCode = getKD();
  if (!kdCode || kdCode === MY_KD) {
    let urlMatch = location.href.match(/(?:kingdom_details|kingdom)[\/\-_](\d+)[\/\-_](\d+)/i);
    if (urlMatch) kdCode = urlMatch[1] + ":" + urlMatch[2];
  }
  let totalNW = extractStat(text, /Total Networth\s+([\d,]+)/i);
  let totalLand = extractStat(text, /Total Land\s+([\d,]+)/i);
  let totalProvinces = extractStat(text, /Total Provinces\s+(\d+)/i);
  if (!totalNW) totalNW = extractStat(text, /Total Networth[^\d]*([\d,]+)/i);
  if (!totalLand) totalLand = extractStat(text, /Total Land[^\d]*([\d,]+)/i);
  let stance = (text.match(/Stance\s+(\w+)/i) || [])[1] || "";
  let nwRank = (text.match(/Net Worth Rank\s+(\d+)\s+of\s+(\d+)/i) || [])[1] || "";
  let landRank = (text.match(/Land Rank\s+(\d+)\s+of\s+(\d+)/i) || [])[1] || "";
  let provinces = scrapeProvinceTable();
  let payload = { key: KEY, source: "kingdom-page", kd: kdCode || MY_KD, kd_name: kdName, tab: "kingdom", prov: "Unknown", url: location.href, data_simple: JSON.stringify({ kd_name: kdName, kd_code: kdCode, total_nw: totalNW, total_land: totalLand, total_provinces: totalProvinces, stance: stance, nw_rank: nwRank, land_rank: landRank, provinces: provinces }) };
  let encoded = Object.entries(payload).map(([k,v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
  setStatus("Sending kingdom page...");
  GM_xmlhttpRequest({ method:"POST", url:ENDPOINT, headers:{"Content-Type":"application/x-www-form-urlencoded"}, data:encoded, onload:function(r){ if(r.status===200){setStatus("Kingdom saved ✓");toast("Kingdom saved: "+kdName,true);}else setStatus("HTTP "+r.status,false);if(callback)callback(); }, onerror:function(){setStatus("Connection failed",false);if(callback)callback();} });
}
function extractStat(text, regex) { let m = text.match(regex); return m ? m[1].replace(/,/g, "") : null; }
function scrapeProvinceTable() { let provinces=[]; let tables=document.querySelectorAll("table"); for(let table of tables){let headers=table.querySelectorAll("th");let headerText=Array.from(headers).map(h=>h.textContent.trim().toLowerCase()).join(",");if(!headerText.includes("province")&&!headerText.includes("race"))continue;let rows=table.querySelectorAll("tr");let colMap={};let headerRow=rows[0];if(headerRow){let ths=headerRow.querySelectorAll("th,td");ths.forEach((th,i)=>{let t=th.textContent.trim().toLowerCase();if(t.includes("province"))colMap.name=i;else if(t==="race")colMap.race=i;else if(t==="land")colMap.land=i;else if(t==="net worth")colMap.nw=i;else if(t.includes("net worth/acre")||t.includes("nwpa")||t.includes("nw/acre"))colMap.nwpa=i;else if(t.includes("nobility"))colMap.nobility=i;else if(t.includes("gains"))colMap.gains=i;});}for(let i=1;i<rows.length;i++){let cells=rows[i].querySelectorAll("td");if(cells.length<3)continue;let name=colMap.name!==undefined?cells[colMap.name]?.textContent.trim():"";if(!name||name==="-")continue;name=name.replace(/\s*\([MS]\)\s*/g,"").replace(/\*/g,"").trim();let province={name};if(colMap.race!==undefined)province.race=cells[colMap.race]?.textContent.trim()||"";if(colMap.land!==undefined)province.land=cells[colMap.land]?.textContent.trim().replace(/[^0-9]/g,"")||"";if(colMap.nw!==undefined)province.nw=cells[colMap.nw]?.textContent.trim().replace(/[^0-9]/g,"")||"";if(colMap.nwpa!==undefined)province.nwpa=cells[colMap.nwpa]?.textContent.trim().replace(/[^0-9]/g,"")||"";if(colMap.nobility!==undefined)province.nobility=cells[colMap.nobility]?.textContent.trim()||"";if(colMap.gains!==undefined)province.gains=cells[colMap.gains]?.textContent.trim()||"";provinces.push(province);}if(provinces.length>0)break;}return provinces;}
function getProvinceName(){let text=document.body.innerText;let patterns=[/The Province of\s+(.+?)\s*\(/i,/The Province of\s+(.+)/i,/Province Name\s*[:\t]\s*(.+)/i];for(let p of patterns){let m=text.match(p);if(m)return m[1].trim().replace(/\s+/g," ");}let som=text.match(/^([^,\n]+),\s*we have \d+ generals? available/im);if(som)return som[1].trim().replace(/\s+/g," ");return "Unknown";}
function getKD(){let urlParams=new URLSearchParams(location.search);let kdParam=urlParams.get("kd");if(kdParam&&kdParam!==MY_KD)return kdParam;let dropdown=document.querySelector('select[name="kd"], select[name="kingdom"], #kd_select');if(dropdown&&dropdown.value&&dropdown.value!==MY_KD)return dropdown.value;let pathMatch=location.href.match(/\/(\d+)\/(\d+)\//);if(pathMatch){let kdFromPath=pathMatch[1]+":"+pathMatch[2];if(kdFromPath!==MY_KD)return kdFromPath;}let ownPages=["throne","council_military","council_internal","council_science","council_state","province_news","province_logs","kingdom_news"];if(ownPages.some(p=>location.href.includes(p)))return MY_KD;let text=document.body?document.body.innerText:"";let matches=[...text.matchAll(/\b(\d+:\d+)\b/g)].map(m=>m[1]);let foreign=matches.find(k=>k!==MY_KD);if(foreign)return foreign;return MY_KD;}
function getTab(){let url=location.href.toLowerCase();if(url.includes("throne"))return"throne";if(url.includes("council_science")||url.includes("science"))return"science";if(url.includes("council_internal")||url.includes("survey")||url.includes("build"))return"survey";if(url.includes("council_military")||url.includes("military")||url.includes("som"))return"military";if(url.includes("council_state")||url.includes("state"))return"state";if(url.includes("province_news")||url.includes("kingdom_news")||url.includes("province_logs"))return"news";if(url.includes("kingdom_details"))return"kingdom";let text=document.body.innerText;if(text.includes("Ambush")&&text.includes("RawOff"))return"armies";if(text.includes("Alchemy")&&text.includes("Bookkeeping"))return"science";if(text.includes("Standing Army"))return"military";if(text.includes("Training Grounds")||text.includes("Banks"))return"survey";return"overview";}
function scrapeArmiesTable(){let tables=document.querySelectorAll("table");let armiesTable=null;tables.forEach(function(t){if(t.innerText.includes("Ambush"))armiesTable=t;});if(armiesTable){let rows=armiesTable.querySelectorAll("tr");let lines=[];rows.forEach(function(row){let cells=row.querySelectorAll("th,td");let cols=[];cells.forEach(function(cell){cols.push(cell.innerText.trim());});if(cols.length>0)lines.push(cols.join("\t"));});return lines.join("\n");}let fullText=document.body.innerText;let idx=fullText.indexOf("Ambush");if(idx===-1)return null;let start=Math.max(0,idx-200);return fullText.substring(start,start+12000);}
function getPageText(){let tab=getTab();if(tab==="armies"){let tableText=scrapeArmiesTable();if(tableText)return tableText;}if(tab==="overview"&&location.hostname.includes("intel.utopia.site")){let fullText=document.body.innerText;let headerIdx=fullText.indexOf("#\tName");if(headerIdx===-1)headerIdx=fullText.indexOf("# \tName");if(headerIdx===-1)headerIdx=fullText.indexOf("#\t");if(headerIdx!==-1){setStatus("Table found ✓");return fullText.substring(headerIdx,headerIdx+15000);}}return document.body.innerText.substring(0,12000);}
function sendCSVData(csv){let kd=getKD();let payload=["key="+encodeURIComponent(KEY),"source=intel-site-csv","kd="+encodeURIComponent(kd),"tab=overview","prov="+encodeURIComponent(getProvinceName()),"url="+encodeURIComponent(location.href),"data_simple="+encodeURIComponent(csv)].join("&");setStatus("Sending CSV...");GM_xmlhttpRequest({method:"POST",url:ENDPOINT,headers:{"Content-Type":"application/x-www-form-urlencoded"},data:payload,onload:function(r){if(r.status===200){setStatus("CSV Saved ✓");toast("CSV Saved ✓",true);if(GM_getValue("cycler_running",false)){let current=GM_getValue("cycler_current",0);GM_setValue("cycler_current",current+1);updatePanel();setTimeout(()=>clickNextKingdom(),2000);}}else{setStatus("HTTP "+r.status,false);toast("HTTP "+r.status,false);}},onerror:function(){setStatus("Connection failed",false);toast("Connection failed",false);}});}
function interceptCSV(){const origCreate=document.createElement.bind(document);document.createElement=function(tag){const el=origCreate(tag);if(tag.toLowerCase()==="a"){const origClick=el.click.bind(el);el.click=function(){if(el.href&&el.href.startsWith("blob:")){fetch(el.href).then(r=>r.text()).then(csv=>{if(csv.includes("#,Name")||csv.includes("Name,Combo")){setStatus("CSV intercepted ✓");sendCSVData(csv);}}).catch(e=>console.log("[CSV intercept error]",e));}return origClick();};}return el;};}
function clickCSVButton(){let all=document.querySelectorAll("div, span, a, button");for(let el of all){if(el.textContent.trim()==="CSV"){el.click();return true;}}return false;}
function sendIntel(silent=false,callback=null){if(location.hostname.includes("intel.utopia.site")){setStatus("Finding CSV...");let found=clickCSVButton();if(found)setStatus("CSV clicked...");else{setStatus("CSV btn not found",false);if(!silent)toast("CSV button not found",false);if(callback)setTimeout(callback,1000);}return;}let tab=getTab();if(tab==="kingdom"){scrapeKingdomPage(callback);return;}let kd=getKD();let prov=getProvinceName();let data=getPageText();let payload=["key="+encodeURIComponent(KEY),"source=intel-site","kd="+encodeURIComponent(kd),"tab="+encodeURIComponent(tab),"prov="+encodeURIComponent(prov),"url="+encodeURIComponent(location.href),"data_simple="+encodeURIComponent(data)].join("&");setStatus("Sending "+tab);GM_xmlhttpRequest({method:"POST",url:ENDPOINT,headers:{"Content-Type":"application/x-www-form-urlencoded"},data:payload,onload:function(r){if(r.status===200){setStatus("Saved "+tab+" ✓");if(!silent)toast("Saved "+tab,true);}else{setStatus("HTTP "+r.status,false);if(!silent)toast("HTTP "+r.status,false);}if(callback)callback();},onerror:function(){setStatus("Connection failed",false);if(!silent)toast("Connection failed",false);if(callback)callback();}});}
function addNexusUI(){if(!document.body)return;if(!document.getElementById("nexus-status")){let bar=document.createElement("div");bar.id="nexus-status";bar.textContent="⚡ Nexus Ready";bar.style.cssText="position:fixed;bottom:20px;left:20px;z-index:2147483647;padding:8px 14px;border-radius:8px;font:bold 12px monospace;color:#56d364;background:#1a472a;";document.body.appendChild(bar);}if(!document.getElementById("nexus-send-btn")){let btn=document.createElement("button");btn.id="nexus-send-btn";btn.textContent="⚡ Send Intel";btn.style.cssText="position:fixed;bottom:20px;right:20px;z-index:2147483647;padding:10px 16px;background:#7c3aed;color:white;border:none;border-radius:8px;font:bold 14px monospace;cursor:pointer;";btn.onclick=function(){sendIntel(false);};document.body.appendChild(btn);}let isKingdomPage=location.href.includes("kingdom_details");let isIntelSite=location.hostname.includes("intel.utopia.site");if((isKingdomPage||isIntelSite)&&!document.getElementById("nexus-panel")){let panel=document.createElement("div");panel.id="nexus-panel";panel.style.cssText="position:fixed;top:20px;left:20px;z-index:2147483647;padding:16px;background:#0d1117;border:1px solid #30363d;border-radius:10px;width:220px;box-shadow:0 4px 20px rgba(0,0,0,0.5);cursor:move;";document.body.appendChild(panel);updatePanel();}}
let lastTab="";let sendTimeout=null;function watchPage(){let tab=getTab();if(tab!==lastTab){lastTab=tab;clearTimeout(sendTimeout);sendTimeout=setTimeout(function(){sendIntel(true);},2000);}}
function isOwnPage(){let tab=getTab();let ownTabs=["throne","science","survey","military","armies","state"];if(!ownTabs.includes(tab))return false;let kd=getKD();return kd===MY_KD;}
function getAdvisorPanel(){return document.getElementById("nexus-advisor");}
function showAdvisor(content){let panel=getAdvisorPanel();if(!panel)return;panel.querySelector("#advisor-body").innerHTML=content;}
function fetchAdvice(){let tab=getTab();let prov=getProvinceName();let data=getPageText();showAdvisor("<div style='color:#aaa;font:12px monospace;'>⏳ Analyzing...</div>");let payload=["key="+encodeURIComponent(KEY),"tab="+encodeURIComponent(tab),"prov="+encodeURIComponent(prov),"data_simple="+encodeURIComponent(data)].join("&");GM_xmlhttpRequest({method:"POST",url:"https://utopia-nexus.onrender.com/advisor",headers:{"Content-Type":"application/x-www-form-urlencoded"},data:payload,onload:function(r){if(r.status===200){let text=r.responseText.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/\n/g,"<br>");showAdvisor("<div style='font:11px monospace;color:#ccc;line-height:1.5;'>"+text+"</div>");}else showAdvisor("<div style='color:#da3633;font:11px monospace;'>Error: "+r.status+"</div>");},onerror:function(){showAdvisor("<div style='color:#da3633;font:11px monospace;'>Connection failed</div>");}});}
function addAdvisorPanel(){if(!isOwnPage())return;if(getAdvisorPanel())return;let panel=document.createElement("div");panel.id="nexus-advisor";panel.style.cssText="position:fixed;top:20px;right:20px;z-index:2147483647;padding:16px;background:#0d1117;border:1px solid #7c3aed;border-radius:10px;width:260px;max-height:80vh;overflow-y:auto;box-shadow:0 4px 20px rgba(0,0,0,0.5);";panel.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><div style="font:bold 13px monospace;color:#a78bfa;">🧠 Dwarf Sage Advisor</div><button id="advisor-close" style="background:none;border:none;color:#aaa;font:bold 14px monospace;cursor:pointer;">✕</button></div><div id="advisor-body" style="font:11px monospace;color:#aaa;">Press Analyze to get advice.</div><button id="advisor-btn" style="margin-top:10px;width:100%;padding:8px;background:#7c3aed;color:white;border:none;border-radius:6px;font:bold 12px monospace;cursor:pointer;">⚡ Analyze This Page</button>`;document.body.appendChild(panel);document.getElementById("advisor-btn").onclick=fetchAdvice;document.getElementById("advisor-close").onclick=()=>panel.remove();setTimeout(fetchAdvice,2000);}
function startNexus(){interceptCSV();addNexusUI();addAdvisorPanel();function doAutoSend(){if(GM_getValue("cycler_running",false)){setTimeout(()=>scrapeAndAdvance(),1000);}else{sendIntel(true);}}if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",function(){addNexusUI();addAdvisorPanel();setTimeout(doAutoSend,1000);});}else{setTimeout(doAutoSend,3000);}setInterval(function(){addNexusUI();addAdvisorPanel();},3000);setInterval(function(){watchPage();},3000);let observer=new MutationObserver(function(){addNexusUI();});if(document.body){observer.observe(document.body,{childList:true,subtree:true});}else{document.addEventListener("DOMContentLoaded",function(){addNexusUI();observer.observe(document.body,{childList:true,subtree:true});});}}
startNexus();
})();