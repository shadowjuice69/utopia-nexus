import { useEffect, useState } from "react";

import {
  getProvinces,
  subscribeToProvinces
} from "../services/provinceService";

function ProvinceIntel() {
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

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const active = provinces.filter(
    province => province.active !== false
  ).length;

  return (
    <section className="panel">
      <h2>🏰 Province Intelligence</h2>

      <div className="intel-grid">

        <div>
          <span>Total Provinces</span>
          <strong>{provinces.length}</strong>
        </div>

        <div>
          <span>Active</span>
          <strong>{active}</strong>
        </div>

        <div>
          <span>Status</span>
          <strong>ONLINE</strong>
        </div>

      </div>

    </section>
  );
}

export default ProvinceIntel;
