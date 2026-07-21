import { conditionFactors, getEfficiencyUnitLabel } from '../data/mockVehicles';
import { useVehicle } from '../context/VehicleContext';
import StatCard from '../components/StatCard';

export default function VehicleProfileScreen() {
  const {
    vehicles,
    selectedVehicle,
    selectedVehicleId,
    setSelectedVehicleId,
    activeFactorIds,
    toggleFactor,
    adjustedEfficiency,
  } = useVehicle();

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
          value={adjustedEfficiency ? adjustedEfficiency.toFixed(1) : '—'}
          sublabel={totalPenaltyPct ? `-${totalPenaltyPct}% for what you flagged below` : 'nothing flagged yet'}
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

      <button
        className="add-vehicle-button"
        onClick={() =>
          alert(
            'This is where a real build calls the NHTSA vPIC API (decode a VIN, or search by year/make/model) to auto-fill specs instead of a hardcoded list. See CLAUDE.md.'
          )
        }
      >
        + Add a vehicle
      </button>

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
