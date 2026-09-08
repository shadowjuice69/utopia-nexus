import { useState, useEffect } from "react";
import "./App.css";
import { loadNexusConfig, getKingdomLabel } from "./services/nexusConfig";
import { getDashboardRegistration } from "./services/auth";
import { getTickState, syncNetworkClock } from "./services/tick";
import KingdomOverview from "./components/KingdomOverview";
import NewsPanel from "./components/NewsPanel";
import BuildingIntel from "./components/BuildingIntel";
import ScienceIntel from "./components/ScienceIntel";
import { KDMilitaryIntel, KDScienceIntel, KDGainsIntel } from "./components/KDStatsIntel";
import ScienceCalculator from './components/ScienceCalculator';
import MembersPanel from "./components/MembersPanel";
import WarRoom from "./components/WarRoom";
import WaveTracker from "./components/WaveTracker";
import AttackLog from "./components/AttackLog";
import AttackSummary from "./components/AttackSummary";
import EnemyKingdoms from "./components/EnemyKingdoms";
import IntelQueue from "./components/IntelQueue";
import OpsIntel from "./components/OpsIntel";
import SpellTracker from "./components/SpellTracker";
import Intel7 from "./components/Intel7";
import IntelDataVault from "./components/IntelDataVault";
import AlertPanel from "./components/AlertPanel";
import AttackCalc from "./components/AttackCalc";
import ThieveryCalculator from "./components/ThieveryCalculatorFixed";
import AmbushCalculator from "./components/AmbushCalculator";
import AIWarReport from "./components/AIWarReport";
import AITargets from "./components/AITargets";
import AIAssistant from "./components/AIAssistant";
import AdvisorLog from "./components/AdvisorLog";
import AIBuildManager from "./components/AIBuildManager";
import DataSteward from "./components/DataSteward";
import RepoTools from "./components/RepoTools";
import GameStateIntel from "./components/GameStateIntel";
import Login from "./components/Login";
const LOGIN_TTL_MS=24*60*60*1000;
const GROUPS = [
  { id: "kingdom", label: "KINGDOM", color: "#fbbf24", tabs: [
    { id: "overview", label: "Overview", component: KingdomOverview }, { id: "game-state", label: "Game State", component: GameStateIntel }, { id: "news", label: "News", component: NewsPanel },
    { id: "buildings", label: "Buildings", component: BuildingIntel }, { id: "science", label: "Science", component: ScienceIntel },
    { id: "kd-military", label: "KD Military", component: KDMilitaryIntel }, { id: "kd-science", label: "KD Science", component: KDScienceIntel },
    { id: "kd-gains", label: "KD Gains", component: KDGainsIntel }, { id: "science-calc", label: 'Sci Calc', component: ScienceCalculator },
    { id: "members", label: "Members", component: MembersPanel },
  ] },
  { id: "war", label: "WAR", color: "#f87171", tabs: [
    { id: "warroom", label: "War Room", component: WarRoom }, { id: "waves", label: "Waves", component: WaveTracker },
    { id: "attacks", label: "Attack Log", component: AttackLog }, { id: "summary", label: "Summary", component: AttackSummary },
    { id: "enemies", label: "Enemy Kingdoms", component: EnemyKingdoms }, { id: "queue", label: "Intel Queue", component: IntelQueue },
  ] },
  { id: "ops", label: "OPS", color: "#a78bfa", tabs: [
    { id: "intel7", label: "Intel 7", component: Intel7 }, { id: "vault", label: "Complete Vault", component: IntelDataVault },
    { id: "hostileops", label: "Hostile Ops", component: OpsIntel }, { id: "spells", label: "Spells", component: SpellTracker },
    { id: "alerts", label: "Alerts", component: AlertPanel }, { id: "calc", label: "Calculator", component: AttackCalc },
    { id: "thievery", label: "Thievery", component: ThieveryCalculator }, { id: "ambush", label: "Ambush", component: AmbushCalculator },
  ] },
  { id: "ai", label: "AI", color: "#34d399", tabs: [
    { id: "warreport", label: "War Report", component: AIWarReport }, { id: "targets", label: "Targets", component: AITargets },
    { id: "ask", label: "Ask", component: AIAssistant }, { id: "advisorlog", label: "Advisor Log", component: AdvisorLog },
    { id: "builds", label: "Reference Builds", component: AIBuildManager }, { id: "steward", label: "Data Steward", component: DataSteward },
  ] },
  { id: "tools", label: "TOOLS", color: "#60a5fa", tabs: [{ id: "repo-tools", label: "Repo Toolkit", component: RepoTools }] },
];
function hasValidLogin(){const loggedAt=Number(localStorage.getItem("nexus_login_at")||0);const savedProvince=localStorage.getItem("nexus_province")||sessionStorage.getItem("nexus_province")||"";return localStorage.getItem("nexus_auth")==="true"&&!!savedProvince&&loggedAt>0&&Date.now()-loggedAt<LOGIN_TTL_MS;}
function restoreLoginSession(){const savedProvince=localStorage.getItem("nexus_province")||"";if(savedProvince)sessionStorage.setItem("nexus_province",savedProvince);sessionStorage.setItem("nexus_auth","true");}
function clearLoginSession(){sessionStorage.removeItem("nexus_auth");sessionStorage.removeItem("nexus_province");localStorage.removeItem("nexus_auth");localStorage.removeItem("nexus_province");localStorage.removeItem("nexus_login_at");}
export default function App(){
 const[authed,setAuthed]=useState(hasValidLogin()),[authReady,setAuthReady]=useState(false),[activeGroup,setActiveGroup]=useState("kingdom"),[activeTab,setActiveTab]=useState("overview"),[tick,setTick]=useState(null),[configReady,setConfigReady]=useState(false);
 useEffect(()=>{let cancelled=false;async function restoreAuthorization(){if(!hasValidLogin()){clearLoginSession();if(!cancelled)setAuthReady(true);return;}restoreLoginSession();const registration=await getDashboardRegistration();const allowed=registration.registered||registration.owner;if(!cancelled){if(allowed)setAuthed(true);else{clearLoginSession();setAuthed(false);}setAuthReady(true);}}restoreAuthorization().catch(()=>{if(!cancelled){clearLoginSession();setAuthed(false);setAuthReady(true);}});return()=>{cancelled=true;};},[]);
 useEffect(()=>{if(!authed)return undefined;let cancelled=false;loadNexusConfig(true).finally(()=>{if(!cancelled)setConfigReady(true);});return()=>{cancelled=true;};},[authed]);
 useEffect(()=>{let cancelled=false;function calcTick(){if(!cancelled)setTick(getTickState());}calcTick();syncNetworkClock().then(state=>{if(!cancelled)setTick(state);}).catch(()=>{});const iv=setInterval(calcTick,1000);const syncIv=setInterval(()=>{syncNetworkClock().then(state=>{if(!cancelled)setTick(state);}).catch(()=>{});},5*60*1000);return()=>{cancelled=true;clearInterval(iv);clearInterval(syncIv);};},[]);
 if(!authReady)return <div className="loading">Checking Nexus authorization...</div>;
 if(!authed)return <Login onAuth={result=>{sessionStorage.setItem("nexus_auth","true");localStorage.setItem("nexus_auth","true");localStorage.setItem("nexus_login_at",String(Date.now()));if(result?.province?.name){sessionStorage.setItem("nexus_province",result.province.name);localStorage.setItem("nexus_province",result.province.name);}setAuthed(true);}}/>;
 if(!configReady)return <div className="loading">Loading current kingdom context...</div>;
 const currentGroup=GROUPS.find(g=>g.id===activeGroup),currentTab=currentGroup?.tabs.find(t=>t.id===activeTab),TabComponent=currentTab?.component;
 function switchGroup(gid){setActiveGroup(gid);const grp=GROUPS.find(g=>g.id===gid);if(grp)setActiveTab(grp.tabs[0].id);}
 return <div className="app"><header className="header"><div className="header-left"><span className="header-logo">⚔</span><div><div className="header-title">NEXUS</div><div className="header-sub">{getKingdomLabel()}</div></div></div><div className="header-tick">{tick&&<><span className="tick-label">{tick.label}</span><span className="tick-num">TICK {tick.current}</span><span className="tick-time">{String(tick.minLeft).padStart(2,"0")}:{String(tick.secLeft).padStart(2,"0")}</span></>}</div></header><nav className="group-nav">{GROUPS.map(g=><button key={g.id} className={`group-btn ${activeGroup===g.id?"group-btn-active":""}`} style={activeGroup===g.id?{borderColor:g.color,color:g.color}:{}} onClick={()=>switchGroup(g.id)}>{g.label}</button>)}</nav><nav className="tab-nav">{currentGroup?.tabs.map(t=><button key={t.id} className={`tab-btn ${activeTab===t.id?"tab-btn-active":""}`} style={activeTab===t.id?{color:currentGroup.color,borderBottomColor:currentGroup.color}:{}} onClick={()=>setActiveTab(t.id)}>{t.label}</button>)}</nav><main className="content">{TabComponent&&<TabComponent/>}</main></div>;
}
