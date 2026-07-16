import "./App.css";

import Header from "./components/Header";
import AttackPulse from "./components/AttackPulse";
import AttackChart from "./components/AttackChart";
import WaveTracker from "./components/WaveTracker";
import WaveChart from "./components/WaveChart";
import AlertPanel from "./components/AlertPanel";
import AlertTimeline from "./components/AlertTimeline";
import ProvinceIntel from "./components/ProvinceIntel";
import ActivityChart from "./components/ActivityChart";

function App() {
  return (
    <div className="nexus">
      <Header />

      <main className="dashboard-grid">
        <AttackPulse />
        <AttackChart />

        <WaveTracker />
        <WaveChart />

        <AlertPanel />
        <AlertTimeline />

        <ProvinceIntel />
        <ActivityChart />
      </main>
    </div>
  );
}

export default App;
