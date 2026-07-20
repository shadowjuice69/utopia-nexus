import { useEffect, useState } from "react";
import {
  getProvinces,
  subscribeToProvinces
} from "../services/provinceService";
import ProvinceModal from "./ProvinceModal";

function BuildingIntel() {
  const [provinces, setProvinces] = useState([]);
  const [selected, setSelected] = useState(null);

  async function loadProvinces() {
    const data = await getProvinces();

    const filtered = data.filter(
      province =>
        province.nw &&
        province.acres &&
        province.buildings
    );

    setProvinces(filtered);
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

      <div className="building-grid">
        {provinces.map((province) => (
          <button
            key={province.id}
            className="building-card"
            onClick={() => setSelected(province)}
          >
            <h3>{province.name}</h3>
            <p>
              NW: {Number(province.nw).toLocaleString()}
            </p>
            <p>
              Acres: {Number(province.acres).toLocaleString()}
            </p>
            <span>Click to view intelligence</span>
          </button>
        ))}
      </div>

      {selected && (
        <ProvinceModal
          province={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

export default BuildingIntel;
