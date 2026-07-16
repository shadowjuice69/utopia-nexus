import { useEffect, useState } from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

import {
  getAttacks,
  subscribeToAttacks
} from "../services/attackService";

function AttackChart() {
  const [data, setData] = useState([]);

  async function loadData() {
    const attacks = await getAttacks();

    const formatted = attacks.map((attack, index) => ({
      time: index + 1,
      attacks: 1,
      success: attack.success ? 1 : 0,
      failed: attack.success ? 0 : 1
    }));

    setData(formatted.reverse());
  }

  useEffect(() => {
    loadData();

    const subscription = subscribeToAttacks(() => {
      loadData();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <section className="panel chart-panel">
      <h2>⚔️ War Activity Monitor</h2>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <XAxis dataKey="time" />
          <YAxis />

          <Tooltip />
          <Legend />

          <Line
            dataKey="attacks"
            name="Attacks"
            strokeWidth={3}
          />

          <Line
            dataKey="success"
            name="Successful"
            strokeWidth={3}
          />

          <Line
            dataKey="failed"
            name="Failed"
            strokeWidth={3}
          />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

export default AttackChart;
