import { useState } from 'react';
import { processFillUpReport } from '../data/mockStations';
import { getEfficiencyUnitLabel } from '../data/mockVehicles';

export default function FillUpModal({ vehicle, distanceMiles, onSave, onClose }) {
  const isEv = vehicle?.fuelKind === 'ev';
  const unitLabel = getEfficiencyUnitLabel(vehicle);
  const unitNoun = isEv ? 'kWh' : 'gallon';

  const [step, setStep] = useState('input');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [unitsPurchased, setUnitsPurchased] = useState('');
  const [result, setResult] = useState(null);

  function handleSave() {
    const report = processFillUpReport({
      pricePerUnit: parseFloat(pricePerUnit) || 0,
      milesSinceLastFillUp: distanceMiles,
      unitsPurchased: parseFloat(unitsPurchased) || 0,
    });
    setResult(report);
    onSave(report);
    setStep('result');
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {step === 'input' ? (
          <>
            <p className="modal-title">What&apos;d you pay per {unitNoun}?</p>
            <p className="modal-subtext">
              Your answer keeps prices accurate for drivers near you — and updates your car&apos;s
              real {unitLabel}.
            </p>
            <input
              className="text-input"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              placeholder={`Price per ${unitNoun}`}
              autoFocus
            />
            <input
              className="text-input section-spacing"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={unitsPurchased}
              onChange={(e) => setUnitsPurchased(e.target.value)}
              placeholder={isEv ? 'kWh added' : 'Gallons purchased'}
            />
            <div className="modal-actions">
              <button className="modal-skip-button" onClick={onClose}>
                Skip
              </button>
              <button className="modal-save-button" onClick={handleSave}>
                Save
              </button>
            </div>
          </>
        ) : (
          <>
            {result?.realEfficiency ? (
              <p className="modal-title">
                Your {vehicle.model} is getting {result.realEfficiency} {unitLabel} — rated{' '}
                {isEv ? vehicle.efficiencyMiPerKwh : vehicle.combinedMpg} {unitLabel}
              </p>
            ) : (
              <p className="modal-title">Thanks — that helps keep prices accurate nearby.</p>
            )}
            <div className="modal-actions">
              <button className="modal-save-button" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
