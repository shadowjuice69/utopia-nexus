import { useEffect, useState } from "react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

import {
  getWaves,
  subscribeToWaves
} from "../services/waveService";

function WaveChart() {
  const [data, setData] = useState([]);

  async function loadWaves() {
    const waves = await getWaves();

    const formatted = waves.map((wave, index) => ({
      wave: wave.wave || `Wave ${index + 1}`,
      assigned: wave.assigned || 0,
      completed: wave.completed || 0
    }));

    setData(formatted);
  }

  useEffect(() => {
    loadWaves();

    const subscription = subscribeToWaves(() => {
      loadWaves();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <section className="panel chart-panel">
      <h2>🌊 Wave Command</h2>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data}>
          <XAxis dataKey="wave" />
          <YAxis />
          <Tooltip />

          <Bar dataKey="assigned" name="Targets" />
          <Bar dataKey="completed" name="Completed" />
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

export default WaveChart;
