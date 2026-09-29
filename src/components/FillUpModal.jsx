import { useState } from 'react';
import { getEfficiencyUnitLabel } from '../data/mockVehicles';
import { computeRealEfficiency, describeExclusion, todayISO, validateFillUp } from '../lib/fillUps';

// Logs one fill-up. Validation and all math live in src/lib/fillUps.js;
// this component only collects input and shows what the library says.
export default function FillUpModal({ vehicle, existingFillUps = [], onSave, onClose }) {
  const isEv = vehicle?.fuelKind === 'ev';
  const unitLabel = getEfficiencyUnitLabel(vehicle);
  const unitNoun = isEv ? 'kWh' : 'gallon';
  const today = todayISO();

  const [step, setStep] = useState('input');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [units, setUnits] = useState('');
  const [odometer, setOdometer] = useState('');
  const [fullTank, setFullTank] = useState(true);
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState({});
  const [pendingWarning, setPendingWarning] = useState(null);
  const [outcome, setOutcome] = useState(null);

  function handleSave() {
    const result = validateFillUp({ date, odometer, units, pricePerUnit, fullTank }, existingFillUps, vehicle);
    setErrors(result.errors);
    if (!result.ok) {
      setPendingWarning(null);
      return;
    }
    // A long gap between fill-ups is usually a typo or a missed log. Say so
    // once; a second tap saves it anyway (it's then left out of real MPG).
    const rangeWarning = result.warnings.find((w) => w.kind === 'range');
    if (rangeWarning && !pendingWarning) {
      setPendingWarning(rangeWarning);
      return;
    }
    const saved = onSave(result.entry) ?? { id: 'pending', ...result.entry };
    const summary = computeRealEfficiency([...existingFillUps, saved], vehicle);
    const excludedHere = summary.excludedIntervals.find((i) => i.toId === saved.id);
    setOutcome({ entry: result.entry, summary, excludedHere });
    setStep('result');
  }

  function clearFieldError(field) {
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    if (field === 'odometer' || field === 'date') setPendingWarning(null);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-label="Log a fill-up" onClick={(e) => e.stopPropagation()}>
        {step === 'input' ? (
          <>
            <p className="modal-title">What&apos;d you pay per {unitNoun}?</p>
            <p className="modal-subtext">
              Your answer keeps prices accurate for drivers near you — and measures your car&apos;s real{' '}
              {unitLabel}.
            </p>

            <Field label={`Price per ${unitNoun}`} error={errors.pricePerUnit}>
              <input
                className="text-input"
                type="text"
                inputMode="decimal"
                value={pricePerUnit}
                onChange={(e) => {
                  setPricePerUnit(e.target.value);
                  clearFieldError('pricePerUnit');
                }}
                placeholder={isEv ? '0.42' : '3.29'}
                aria-label={`Price per ${unitNoun}`}
                autoFocus
              />
            </Field>

            <Field label={isEv ? 'kWh added' : 'Gallons'} error={errors.units}>
              <input
                className="text-input"
                type="text"
                inputMode="decimal"
                value={units}
                onChange={(e) => {
                  setUnits(e.target.value);
                  clearFieldError('units');
                }}
                placeholder={isEv ? '38.5' : '10.4'}
                aria-label={isEv ? 'kWh added' : 'Gallons'}
              />
            </Field>

            <Field label="Odometer" error={errors.odometer}>
              <input
                className="text-input"
                type="text"
                inputMode="numeric"
                value={odometer}
                onChange={(e) => {
                  setOdometer(e.target.value);
                  clearFieldError('odometer');
                }}
                placeholder="45,650"
                aria-label="Odometer"
              />
            </Field>

            <button
              type="button"
              className="check-row"
              role="checkbox"
              aria-checked={fullTank}
              onClick={() => setFullTank((v) => !v)}
            >
              <span className={`checkbox ${fullTank ? 'checked' : ''}`} />
              <span className="check-row-text">
                {isEv ? 'Charged to my usual full' : 'Filled it all the way up'}
                <span className="check-row-hint">
                  {fullTank
                    ? `Full fills are what measure your real ${unitLabel}.`
                    : "Partial fill — it'll count toward your next full one."}
                </span>
              </span>
            </button>

            <Field label="Date" error={errors.date}>
              <input
                className="text-input"
                type="date"
                max={today}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  clearFieldError('date');
                }}
                aria-label="Date"
              />
            </Field>

            {pendingWarning && (
              <p className="field-warning" role="alert">
                That&apos;s {Math.round(pendingWarning.miles).toLocaleString('en-US')} miles since your last fill-up —
                more than a {isEv ? 'charge' : 'tank'} can go. Missed logging one, or a typo? Save anyway and this{' '}
                {isEv ? 'charge' : 'tank'} is left out of your real {unitLabel}.
              </p>
            )}

            <div className="modal-actions">
              <button className="modal-skip-button" onClick={onClose}>
                Skip
              </button>
              <button className="modal-save-button" onClick={handleSave}>
                {pendingWarning ? 'Save anyway' : 'Save'}
              </button>
            </div>
          </>
        ) : (
          <>
            <ResultMessage vehicle={vehicle} unitLabel={unitLabel} outcome={outcome} isEv={isEv} />
            <div className="modal-actions">
              <button className="modal-save-button" onClick={onClose} autoFocus>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      {children}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function ResultMessage({ vehicle, unitLabel, outcome, isEv }) {
  const { summary, entry, excludedHere } = outcome;
  const rated = isEv ? vehicle.efficiencyMiPerKwh : vehicle.combinedMpg;
  const needed = summary.fullFillUpsNeeded;
  return (
    <>
      {summary.efficiency ? (
        <p className="modal-title">
          Your {vehicle.model} is getting {summary.efficiency.toFixed(1)} {unitLabel}
          {rated ? ` — rated ${rated} ${unitLabel}` : ''}.
        </p>
      ) : (
        <p className="modal-title">Logged — thanks, that keeps prices accurate nearby.</p>
      )}
      {!summary.efficiency && (
        <p className="modal-subtext">
          {entry.fullTank
            ? `${needed} more full ${isEv ? 'charge' : 'fill-up'}${needed === 1 ? '' : 's'} until GasGuide uses your real ${unitLabel}.`
            : `Partial fill — it'll count toward your next full ${isEv ? 'charge' : 'tank'}.`}
        </p>
      )}
      {excludedHere && <p className="field-warning">{describeExclusion(excludedHere.reason)}</p>}
    </>
  );
}
