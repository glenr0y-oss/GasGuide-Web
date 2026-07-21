import { useState } from 'react';
import { conditionFactors } from '../data/mockVehicles';
import { getBestPrice } from '../data/mockStations';
import { useVehicle } from '../context/VehicleContext';
import DestinationPicker from '../components/DestinationPicker';
import FillUpModal from '../components/FillUpModal';

export default function TripCostScreen() {
  const bestPrice = getBestPrice();
  const {
    vehicles,
    selectedVehicle,
    selectedVehicleId,
    setSelectedVehicleId,
    activeFactorIds,
    toggleFactor,
    adjustedMpg,
  } = useVehicle();

  const [distanceMiles, setDistanceMiles] = useState(0);
  const [showFillUp, setShowFillUp] = useState(false);
  // Replace with a real backend call once one exists — see CLAUDE.md
  // "The price + real-MPG loop".
  const [fillUpReports, setFillUpReports] = useState([]);

  const gallonsNeeded = adjustedMpg ? distanceMiles / adjustedMpg : 0;
  const estimatedCost = bestPrice ? gallonsNeeded * bestPrice.price : 0;

  return (
    <div className="screen">
      <div className="hero-cost-card">
        <span className="label">This trip will cost about</span>
        <div className="hero-cost-row">
          <span className="hero-cost">${estimatedCost.toFixed(2)}</span>
          <span className="hero-cost-gallons">{gallonsNeeded.toFixed(1)} gal</span>
        </div>
        <span className="hero-cost-caption">
          {distanceMiles.toFixed(1)} mi
          {bestPrice ? ` · $${bestPrice.price.toFixed(2)}/gal at ${bestPrice.name}` : ''}
        </span>
      </div>

      <div className="divider" />

      <span className="label">1. Vehicle</span>
      <div className="chip-row">
        {vehicles.map((vehicle) => (
          <button
            key={vehicle.id}
            className={`chip ${vehicle.id === selectedVehicleId ? 'selected' : ''}`}
            onClick={() => setSelectedVehicleId(vehicle.id)}
          >
            {vehicle.year} {vehicle.make} {vehicle.model}
          </button>
        ))}
      </div>

      <span className="label section-spacing">2. Where are you headed?</span>
      <p className="hint">Search an address, then drag the pin to the exact spot.</p>
      <DestinationPicker onDistanceChange={setDistanceMiles} />

      <span className="label section-spacing">3. Anything affecting mileage?</span>
      <p className="hint">Optional — you know your car best.</p>
      <div className="factor-wrap">
        {conditionFactors.map((factor) => (
          <button
            key={factor.id}
            className={`factor-chip ${activeFactorIds.includes(factor.id) ? 'active' : ''}`}
            onClick={() => toggleFactor(factor.id)}
          >
            {factor.label}
          </button>
        ))}
      </div>

      <button className="add-vehicle-button section-spacing" onClick={() => setShowFillUp(true)}>
        + Log a fill-up
      </button>

      {showFillUp && (
        <FillUpModal
          vehicle={selectedVehicle}
          distanceMiles={distanceMiles}
          onSave={(report) => setFillUpReports((reports) => [...reports, report])}
          onClose={() => setShowFillUp(false)}
        />
      )}
    </div>
  );
}
