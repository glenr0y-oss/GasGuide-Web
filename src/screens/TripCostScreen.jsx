import { useState } from 'react';
import { conditionFactors } from '../data/mockVehicles';
import { getBestPrice } from '../data/mockStations';
import { useVehicle } from '../context/VehicleContext';
import StatCard from '../components/StatCard';
import PriceBadge from '../components/PriceBadge';

// NEXT INTEGRATION: replace the plain-number distance field below with a
// destination text input wired to a Directions API (Google Maps Platform or
// Mapbox), which returns real distance + ETA for a route. See CLAUDE.md.

export default function TripCostScreen() {
  const bestPrice = getBestPrice();
  const {
    vehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    activeFactorIds,
    toggleFactor,
    adjustedMpg,
  } = useVehicle();

  const [distanceInput, setDistanceInput] = useState('42');
  const distanceMiles = parseFloat(distanceInput) || 0;

  const gallonsNeeded = adjustedMpg ? distanceMiles / adjustedMpg : 0;
  const estimatedCost = bestPrice ? gallonsNeeded * bestPrice.price : 0;

  return (
    <div className="screen">
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

      <span className="label section-spacing">2. Trip distance (miles)</span>
      <input
        className="text-input"
        value={distanceInput}
        onChange={(e) => setDistanceInput(e.target.value)}
        inputMode="decimal"
        placeholder="e.g. 42"
      />

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

      <div className="divider" />

      <div className="price-row">
        <span className="label">Using nearby price</span>
        {bestPrice ? <PriceBadge price={bestPrice.price} label={bestPrice.name} /> : null}
      </div>

      <div className="stats-row">
        <StatCard
          label="Gallons needed"
          value={gallonsNeeded.toFixed(1)}
          sublabel={adjustedMpg ? `at ${adjustedMpg.toFixed(1)} mpg` : 'select a vehicle'}
        />
        <StatCard
          label="Estimated cost"
          value={`$${estimatedCost.toFixed(2)}`}
          sublabel={`for ${distanceMiles || 0} mi`}
        />
      </div>
    </div>
  );
}
