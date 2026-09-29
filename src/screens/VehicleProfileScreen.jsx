import { useState } from 'react';
import { conditionFactors, getEfficiencyUnitLabel } from '../data/mockVehicles';
import { useVehicle } from '../context/VehicleContext';
import StatCard from '../components/StatCard';
import AddVehicleModal from '../components/AddVehicleModal';
import FillUpModal from '../components/FillUpModal';
import FillUpLog from '../components/FillUpLog';

export default function VehicleProfileScreen() {
  const {
    vehicles,
    addVehicle,
    selectedVehicle,
    selectedVehicleId,
    setSelectedVehicleId,
    activeFactorIds,
    toggleFactor,
    adjustedEfficiency,
    realEfficiency,
    realEfficiencySummary,
    fillUps,
    recordFillUp,
    deleteFillUp,
  } = useVehicle();
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showFillUp, setShowFillUp] = useState(false);

  const isEv = selectedVehicle.fuelKind === 'ev';
  const unitLabel = getEfficiencyUnitLabel(selectedVehicle);
  const stickerEfficiency = isEv ? selectedVehicle.efficiencyMiPerKwh : selectedVehicle.combinedMpg;

  const totalPenaltyPct = conditionFactors
    .filter((f) => activeFactorIds.includes(f.id))
    .reduce((sum, f) => sum + f.mpgPenaltyPct, 0);

  return (
    <div className="screen">
      <div className="hero-card">
        <p className="hero-name">
          {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
        </p>
        <p className="hero-fuel">{selectedVehicle.fuelType}</p>
      </div>

      <div className="stats-row">
        <StatCard
          label={isEv ? 'Sticker efficiency' : 'Sticker MPG'}
          value={stickerEfficiency ?? '—'}
          sublabel={isEv ? `${unitLabel} — what the window sticker says` : 'what the window sticker says'}
        />
        <StatCard
          label={isEv ? 'Your real efficiency' : 'Your real MPG'}
          value={
            realEfficiency ? realEfficiency.toFixed(1) : adjustedEfficiency ? adjustedEfficiency.toFixed(1) : '—'
          }
          sublabel={realMpgSublabel({ realEfficiencySummary, totalPenaltyPct, isEv })}
        />
        <StatCard
          label={isEv ? 'Battery size' : 'Tank size'}
          value={(isEv ? selectedVehicle.batteryKwh : selectedVehicle.tankSizeGallons) ?? '—'}
          sublabel={isEv ? 'kWh' : 'gallons'}
        />
      </div>

      <span className="label section-spacing">Your vehicles</span>
      {vehicles.map((vehicle) => (
        <button
          key={vehicle.id}
          className={`vehicle-row ${vehicle.id === selectedVehicleId ? 'selected' : ''}`}
          onClick={() => setSelectedVehicleId(vehicle.id)}
        >
          <span className={`radio ${vehicle.id === selectedVehicleId ? 'checked' : ''}`} />
          <span className="vehicle-row-text">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </span>
          <span className="body-muted">
            {(vehicle.fuelKind === 'ev' ? vehicle.efficiencyMiPerKwh : vehicle.combinedMpg) ?? '—'}{' '}
            {getEfficiencyUnitLabel(vehicle)}
          </span>
        </button>
      ))}

      <button className="add-vehicle-button" onClick={() => setShowAddVehicle(true)}>
        + Add a vehicle
      </button>

      {showAddVehicle && (
        <AddVehicleModal onAdd={addVehicle} onClose={() => setShowAddVehicle(false)} />
      )}

      <span className="label section-spacing">Fill-up log</span>
      <p className="hint">
        Log the odometer and whether you filled it all the way. Three full tanks and GasGuide switches to
        your real {unitLabel} everywhere — including the &ldquo;Worth it?&rdquo; verdict.
      </p>
      <FillUpLog vehicle={selectedVehicle} fillUps={fillUps} onDelete={deleteFillUp} />
      <button className="add-vehicle-button" onClick={() => setShowFillUp(true)}>
        + Log a fill-up
      </button>

      {showFillUp && (
        <FillUpModal
          vehicle={selectedVehicle}
          existingFillUps={fillUps}
          onSave={recordFillUp}
          onClose={() => setShowFillUp(false)}
        />
      )}

      <span className="label section-spacing">Condition factors</span>
      <p className="hint">
        Manual, on purpose — you know about a bad alignment or underinflated tires long before any
        sensor would.
      </p>
      {conditionFactors.map((factor) => (
        <button key={factor.id} className="factor-row" onClick={() => toggleFactor(factor.id)}>
          <span className={`checkbox ${activeFactorIds.includes(factor.id) ? 'checked' : ''}`} />
          <span className="factor-row-text">{factor.label}</span>
          <span className="factor-penalty">-{factor.mpgPenaltyPct}%</span>
        </button>
      ))}
    </div>
  );
}

function realMpgSublabel({ realEfficiencySummary, totalPenaltyPct, isEv }) {
  const { efficiency, validIntervals, fullFillUpsNeeded } = realEfficiencySummary;
  if (efficiency) {
    return `measured over ${validIntervals.length} full ${isEv ? 'charges' : 'tanks'}`;
  }
  const waiting = `${fullFillUpsNeeded} more full ${isEv ? 'charge' : 'fill-up'}${fullFillUpsNeeded === 1 ? '' : 's'} to measure`;
  return totalPenaltyPct ? `-${totalPenaltyPct}% for what you flagged · ${waiting}` : `sticker estimate · ${waiting}`;
}
