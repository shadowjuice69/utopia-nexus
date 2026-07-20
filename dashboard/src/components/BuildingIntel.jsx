import { useEffect, useState } from "react";
import {
  getProvinces,
  subscribeToProvinces
} from "../services/provinceService";

function BuildingIntel() {
  const [provinces, setProvinces] = useState([]);

  async function loadProvinces() {
    const data = await getProvinces();
    setProvinces(data);
  }

  useEffect(() => {
    loadProvinces();

    const subscription = subscribeToProvinces(() => {
      loadProvinces();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <section className="panel">
      <h2>🏗️ Building Intelligence</h2>

      {provinces.map((province) => (
        <div key={province.id} className="building-card">
          <h3>{province.name || "Unknown Province"}</h3>

          <p>
            NW: {province.nw?.toLocaleString()} | Acres: {province.acres}
          </p>

          {province.buildings &&
            Object.entries(province.buildings).map(([name, data]) => (
              <div key={name}>
                {name.replaceAll("_", " ")}: {data.qty} ({data.pct}%)
              </div>
            ))}
        </div>
      ))}
    </section>
  );
}

export default BuildingIntel;
