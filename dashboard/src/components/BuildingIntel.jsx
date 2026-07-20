import { useEffect, useState } from "react";
import {
  getProvinces,
  subscribeToProvinces
} from "../services/provinceService";

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
            <span>Click to view buildings</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="modal">
          <div className="modal-content">
            <button onClick={() => setSelected(null)}>
              ✖ Close
            </button>

            <h2>🏰 {selected.name}</h2>

            <p>
              NW: {Number(selected.nw).toLocaleString()}
            </p>

            <p>
              Acres: {Number(selected.acres).toLocaleString()}
            </p>

            <h3>Buildings</h3>

            {Object.entries(selected.buildings).map(
              ([name, data]) => (
                <div key={name}>
                  {name.replaceAll("_", " ")}:
                  {" "}
                  {data.qty} ({data.pct}%)
                </div>
              )
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default BuildingIntel;
