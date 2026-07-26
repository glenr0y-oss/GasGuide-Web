import { useState } from 'react';
import { decodeVin, findEpaEfficiency } from '../data/vehicleApi';

export default function AddVehicleModal({ onAdd, onClose }) {
  const [vin, setVin] = useState('');
  const [step, setStep] = useState('input'); // input | loading | error | result
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);

  async function handleLookup() {
    setStep('loading');
    try {
      const decoded = await decodeVin(vin);
      const epa = await findEpaEfficiency(decoded).catch(() => null);
      setDraft({
        id: `vin-${vin.trim().toUpperCase()}`,
        make: decoded.make,
        model: decoded.model,
        year: decoded.year,
        fuelKind: epa?.fuelKind ?? (decoded.isEvGuess ? 'ev' : 'gas'),
        fuelType: epa?.fuelType ?? decoded.fuelType,
        combinedMpg: epa?.combinedMpg ?? null,
        efficiencyMiPerKwh: epa?.efficiencyMiPerKwh ?? null,
        tankSizeGallons: null,
        batteryKwh: null,
        epaMatched: Boolean(epa),
      });
      setStep('result');
    } catch (e) {
      setError(e.message || 'Something went wrong looking that up.');
      setStep('error');
    }
  }

  function handleAdd() {
    onAdd(draft);
    onClose();
  }

  const vinReady = vin.trim().length === 17;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {step === 'input' && (
          <>
            <p className="modal-title">Add a vehicle by VIN</p>
            <p className="modal-subtext">
              We'll decode its year, make, and model with NHTSA, then pull its EPA fuel economy rating
              from fueleconomy.gov.
            </p>
            <input
              className="text-input"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              placeholder="17-character VIN"
              maxLength={17}
              autoFocus
            />
            <div className="modal-actions">
              <button className="modal-skip-button" onClick={onClose}>
                Cancel
              </button>
              <button className="modal-save-button" disabled={!vinReady} onClick={handleLookup}>
                Look up
              </button>
            </div>
          </>
        )}

        {step === 'loading' && <p className="modal-title">Looking up your vehicle…</p>}

        {step === 'error' && (
          <>
            <p className="modal-title">{error}</p>
            <div className="modal-actions">
              <button className="modal-skip-button" onClick={onClose}>
                Cancel
              </button>
              <button className="modal-save-button" onClick={() => setStep('input')}>
                Try again
              </button>
            </div>
          </>
        )}

        {step === 'result' && draft && (
          <>
            <p className="modal-title">
              {draft.year} {draft.make} {draft.model}
            </p>
            <p className="modal-subtext">
              {draft.epaMatched
                ? `${
                    draft.fuelKind === 'ev' ? `${draft.efficiencyMiPerKwh} mi/kWh` : `${draft.combinedMpg} mpg`
                  } combined, per EPA fueleconomy.gov`
                : "Couldn't find an EPA fuel economy match — you can still add it, and logging a fill-up will give it a real MPG."}
            </p>
            <div className="modal-actions">
              <button className="modal-skip-button" onClick={onClose}>
                Cancel
              </button>
              <button className="modal-save-button" onClick={handleAdd}>
                Add vehicle
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
