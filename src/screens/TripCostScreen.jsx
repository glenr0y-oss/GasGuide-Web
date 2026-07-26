import { useState } from 'react';
import { conditionFactors, getEfficiencyUnitLabel } from '../data/mockVehicles';
import { getBestPrice, getPriceUnitLabel } from '../data/mockStations';
import { useVehicle } from '../context/VehicleContext';
import DestinationPicker from '../components/DestinationPicker';
import FillUpModal from '../components/FillUpModal';
import PriceBadge from '../components/PriceBadge';

export default function TripCostScreen() {
  const {
    vehicles,
    selectedVehicle,
    selectedVehicleId,
    setSelectedVehicleId,
    activeFactorIds,
    toggleFactor,
    realEfficiency,
    effectiveEfficiency,
    recordFillUp,
  } = useVehicle();

  const bestPrice = getBestPrice(selectedVehicle.fuelKind);
  const priceUnitLabel = getPriceUnitLabel(selectedVehicle.fuelKind);
  const efficiencyUnitLabel = getEfficiencyUnitLabel(selectedVehicle);

  const [distanceMiles, setDistanceMiles] = useState(0);
  const [showFillUp, setShowFillUp] = useState(false);

  const unitsNeeded = effectiveEfficiency ? distanceMiles / effectiveEfficiency : 0;
  const estimatedCost = bestPrice ? unitsNeeded * bestPrice.price : 0;

  return (
    <div className="screen">
      <div className="hero-cost-card">
        <span className="label">This trip will cost about</span>
        <div className="hero-cost-row">
          <span className="hero-cost">${estimatedCost.toFixed(2)}</span>
          <span className="hero-cost-gallons">{unitsNeeded.toFixed(1)} {priceUnitLabel}</span>
        </div>
        <span className="hero-cost-caption">
          {distanceMiles.toFixed(1)} mi
          {realEfficiency ? ` · using your real ${efficiencyUnitLabel}` : ''}
        </span>
        {bestPrice && (
          <div className="price-row">
            <PriceBadge price={bestPrice.price} label={`per ${priceUnitLabel} at ${bestPrice.name}`} />
          </div>
        )}
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
          onSave={recordFillUp}
          onClose={() => setShowFillUp(false)}
        />
      )}
    </div>
  );
}
