import { useState } from 'react';
import { processFillUpReport } from '../data/mockStations';

export default function FillUpModal({ vehicle, distanceMiles, onSave, onClose }) {
  const [step, setStep] = useState('input');
  const [pricePerGallon, setPricePerGallon] = useState('');
  const [gallonsPurchased, setGallonsPurchased] = useState('');
  const [result, setResult] = useState(null);

  function handleSave() {
    const report = processFillUpReport({
      pricePerGallon: parseFloat(pricePerGallon) || 0,
      milesSinceLastFillUp: distanceMiles,
      gallonsPurchased: parseFloat(gallonsPurchased) || 0,
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
            <p className="modal-title">What&apos;d you pay per gallon?</p>
            <p className="modal-subtext">
              Your answer keeps prices accurate for drivers near you — and updates your car&apos;s
              real MPG.
            </p>
            <input
              className="text-input"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={pricePerGallon}
              onChange={(e) => setPricePerGallon(e.target.value)}
              placeholder="Price per gallon"
              autoFocus
            />
            <input
              className="text-input section-spacing"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={gallonsPurchased}
              onChange={(e) => setGallonsPurchased(e.target.value)}
              placeholder="Gallons purchased"
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
            {result?.realMpg ? (
              <p className="modal-title">
                Your {vehicle.model} is getting {result.realMpg} mpg — rated {vehicle.combinedMpg}
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
