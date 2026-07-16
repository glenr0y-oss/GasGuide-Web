import { conditionFactors } from '../data/mockVehicles';
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
    adjustedMpg,
  } = useVehicle();

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
        <StatCard label="Rated MPG" value={selectedVehicle.combinedMpg ?? '—'} sublabel="EPA combined" />
        <StatCard
          label="Adjusted MPG"
          value={adjustedMpg ? adjustedMpg.toFixed(1) : '—'}
          sublabel={totalPenaltyPct ? `-${totalPenaltyPct}% applied` : 'no factors active'}
        />
        <StatCard label="Tank size" value={selectedVehicle.tankSizeGallons ?? '—'} sublabel="gallons" />
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
          <span className="body-muted">{vehicle.combinedMpg ?? '—'} mpg</span>
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
