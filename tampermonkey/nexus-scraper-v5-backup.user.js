// ==UserScript==
// @name         Utopia Nexus Universal Intel Scraper
// @namespace    utopia-nexus
// @version      5.0
// @description  Universal Utopia intel collector with auto CSV send
// @match        https://intel.utopia.site/*
// @match        https://www.utopia-game.com/*
// @match        https://utopia-game.com/*
// @grant        GM_xmlhttpRequest
// @connect      utopia-nexus-production.up.railway.app
// @run-at       document-start
// ==/UserScript==

(function () {

"use strict";

const ENDPOINT = "https://utopia-nexus-production.up.railway.app/intel";
const KEY = "NikkoAce";
const MY_KD = "3:2";

let lastTab = "";
let sendTimeout = null;

function toast(message, good=true){
    let old=document.getElementById("nexus-toast");
    if(old) old.remove();
    let t=document.createElement("div");
    t.id="nexus-toast";
    t.textContent=message;
    t.style.cssText=
    "position:fixed;top:20px;right:20px;z-index:2147483647;" +
    "padding:12px 16px;border-radius:8px;font:bold 13px monospace;" +
    "color:white;background:"+(good?"#238636":"#da3633")+";";
    document.body.appendChild(t);
    setTimeout(()=>{ if(t.parentNode) t.remove(); },3000);
}

function setStatus(message, good=true){
    let bar=document.getElementById("nexus-status");
    if(!bar) return;
    bar.textContent="⚡ "+message;
    bar.style.background=good?"#1a472a":"#6e1a1a";
}

function getProvinceName(){
    let text=document.body.innerText;
    let patterns=[
        /The Province of\s+(.+?)\s*\(/i,
        /The Province of\s+(.+)/i,
        /Province Name\s*[:\t]\s*(.+)/i
    ];
    for(let p of patterns){
        let m=text.match(p);
        if(m) return m[1].trim().replace(/\s+/g," ");
    }
    return "Unknown";
}

function getKD(){
    let text=document.body.innerText;
    let m=text.match(/\b(\d+:\d+)\b/);
    return m?m[1]:MY_KD;
}

function getTab(){
    let url=location.href.toLowerCase();
    if(url.includes("throne")) return "throne";
    if(url.includes("council_science")||url.includes("science")) return "science";
    if(url.includes("council_internal")||url.includes("survey")||url.includes("build")) return "survey";
    if(url.includes("council_military")||url.includes("military")||url.includes("som")) return "military";
    if(url.includes("council_state")||url.includes("state")) return "state";
    if(url.includes("province_news")||url.includes("kingdom_news")||url.includes("province_logs")) return "news";

    let text=document.body.innerText;
    if(text.includes("Ambush")&&text.includes("RawOff")) return "armies";
    if(text.includes("Alchemy")&&text.includes("Bookkeeping")) return "science";
    if(text.includes("Standing Army")) return "military";
    if(text.includes("Training Grounds")||text.includes("Banks")) return "survey";
    return "overview";
}

function scrapeArmiesTable(){
    let tables=document.querySelectorAll("table");
    let armiesTable=null;
    tables.forEach(function(t){
        if(t.innerText.includes("Ambush")) armiesTable=t;
    });
    if(armiesTable){
        let rows=armiesTable.querySelectorAll("tr");
        let lines=[];
        rows.forEach(function(row){
            let cells=row.querySelectorAll("th, td");
            let cols=[];
            cells.forEach(function(cell){ cols.push(cell.innerText.trim()); });
            if(cols.length>0) lines.push(cols.join("\t"));
        });
        return lines.join("\n");
    }
    let fullText=document.body.innerText;
    let idx=fullText.indexOf("Ambush");
    if(idx===-1) return null;
    let start=Math.max(0,idx-200);
    return fullText.substring(start,start+12000);
}

function getPageText(){
    let tab=getTab();
    if(tab==="armies"){
        let tableText=scrapeArmiesTable();
        if(tableText) return tableText;
    }
    if(tab==="overview"&&location.hostname.includes("intel.utopia.site")){
        let fullText=document.body.innerText;
        let headerIdx=fullText.indexOf("#\tName");
        if(headerIdx===-1) headerIdx=fullText.indexOf("# \tName");
        if(headerIdx===-1) headerIdx=fullText.indexOf("#\t");
        if(headerIdx!==-1){
            setStatus("Table found ✓");
            return fullText.substring(headerIdx,headerIdx+15000);
        }
    }
    return document.body.innerText.substring(0,12000);
}

function sendCSVData(csv){
    let kd=getKD();
    let payload=[
        "key="+encodeURIComponent(KEY),
        "source=intel-site-csv",
        "kd="+encodeURIComponent(kd),
        "tab=overview",
        "prov=Unknown",
        "url="+encodeURIComponent(location.href),
        "data_simple="+encodeURIComponent(csv)
    ].join("&");

    setStatus("Sending CSV...");

    GM_xmlhttpRequest({
        method:"POST",
        url:ENDPOINT,
        headers:{"Content-Type":"application/x-www-form-urlencoded"},
        data:payload,
        onload:function(r){
            if(r.status===200){
                setStatus("CSV Saved ✓");
                toast("CSV Saved ✓",true);
            } else {
                setStatus("HTTP "+r.status,false);
                toast("HTTP "+r.status,false);
            }
        },
        onerror:function(){
            setStatus("Connection failed",false);
            toast("Connection failed",false);
        }
    });
}

function interceptCSV(){
    const origCreate = document.createElement.bind(document);
    document.createElement = function(tag){
        const el = origCreate(tag);
        if(tag.toLowerCase() === "a"){
            const origClick = el.click.bind(el);
            el.click = function(){
                if(el.href && el.href.startsWith("blob:")){
                    fetch(el.href)
                        .then(function(r){ return r.text(); })
                        .then(function(csv){
                            if(csv.includes("#,Name") || csv.includes("Name,Combo")){
                                setStatus("CSV intercepted ✓");
                                sendCSVData(csv);
                            }
                        })
                        .catch(function(e){ console.log("[CSV intercept error]",e); });
                }
                return origClick();
            };
        }
        return el;
    };
}

function clickCSVButton(){
    let all=document.querySelectorAll("div, span, a, button");
    for(let el of all){
        if(el.textContent.trim()==="CSV"){
            el.click();
            return true;
        }
    }
    return false;
}

function sendIntel(silent=false){
    if(location.hostname.includes("intel.utopia.site")){
        setStatus("Finding CSV...");
        let found=clickCSVButton();
        if(found){
            setStatus("CSV clicked...");
        } else {
            setStatus("CSV btn not found",false);
            if(!silent) toast("CSV button not found",false);
        }
        return;
    }

    let tab=getTab();
    let kd=getKD();
    let prov=getProvinceName();
    let data=getPageText();

    let payload=[
        "key="+encodeURIComponent(KEY),
        "source=intel-site",
        "kd="+encodeURIComponent(kd),
        "tab="+encodeURIComponent(tab),
        "prov="+encodeURIComponent(prov),
        "url="+encodeURIComponent(location.href),
        "data_simple="+encodeURIComponent(data)
    ].join("&");

    setStatus("Sending "+tab);

    GM_xmlhttpRequest({
        method:"POST",
        url:ENDPOINT,
        headers:{"Content-Type":"application/x-www-form-urlencoded"},
        data:payload,
        onload:function(r){
            if(r.status===200){
                setStatus("Saved "+tab+" ✓");
                if(!silent) toast("Saved "+tab,true);
            } else {
                setStatus("HTTP "+r.status,false);
                if(!silent) toast("HTTP "+r.status,false);
            }
        },
        onerror:function(){
            setStatus("Connection failed",false);
            if(!silent) toast("Connection failed",false);
        }
    });
}

function addNexusUI(){
    if(!document.body) return;

    if(!document.getElementById("nexus-status")){
        let bar=document.createElement("div");
        bar.id="nexus-status";
        bar.textContent="⚡ Nexus Ready";
        bar.style.cssText=
        "position:fixed;bottom:20px;left:20px;z-index:2147483647;" +
        "padding:8px 14px;border-radius:8px;font:bold 12px monospace;" +
        "color:#56d364;background:#1a472a;";
        document.body.appendChild(bar);
    }

    if(!document.getElementById("nexus-send-btn")){
        let btn=document.createElement("button");
        btn.id="nexus-send-btn";
        btn.textContent="⚡ Send Intel";
        btn.style.cssText=
        "position:fixed;bottom:20px;right:20px;z-index:2147483647;" +
        "padding:10px 16px;background:#7c3aed;color:white;" +
        "border:none;border-radius:8px;font:bold 14px monospace;cursor:pointer;";
        btn.onclick=function(){ sendIntel(false); };
        document.body.appendChild(btn);
    }
}

function watchPage(){
    let tab=getTab();
    if(tab!==lastTab){
        lastTab=tab;
        clearTimeout(sendTimeout);
        sendTimeout=setTimeout(function(){ sendIntel(true); },2000);
    }
}

function startNexus(){
    interceptCSV();
    addNexusUI();
    setTimeout(function(){ sendIntel(true); },3000);
    setInterval(function(){ addNexusUI(); },3000);
    setInterval(function(){ watchPage(); },3000);
    let observer=new MutationObserver(function(){ addNexusUI(); });
    if(document.body){
        observer.observe(document.body,{childList:true,subtree:true});
    } else {
        document.addEventListener("DOMContentLoaded",function(){
            addNexusUI();
            observer.observe(document.body,{childList:true,subtree:true});
        });
    }
}

startNexus();

})();
