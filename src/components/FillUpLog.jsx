import { useState } from 'react';
import { computeRealEfficiency, describeExclusion } from '../lib/fillUps';
import { getEfficiencyUnitLabel } from '../data/mockVehicles';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return DATE_FORMAT.format(new Date(y, m - 1, d));
}

// The fill-up history for the selected vehicle, newest first. Each full
// fill that closes a tank shows that tank's mileage (or why it was left out),
// so a typo is easy to spot and remove.
export default function FillUpLog({ vehicle, fillUps, onDelete }) {
  const [confirmingId, setConfirmingId] = useState(null);
  const isEv = vehicle?.fuelKind === 'ev';
  const unitLabel = getEfficiencyUnitLabel(vehicle);
  const unitShort = isEv ? 'kWh' : 'gal';

  if (!fillUps.length) {
    return <p className="hint">No fill-ups yet. Log three full tanks and GasGuide switches to your real {unitLabel}.</p>;
  }

  const summary = computeRealEfficiency(fillUps, vehicle);
  const byClosingId = new Map(
    [...summary.validIntervals, ...summary.excludedIntervals].map((interval) => [interval.toId, interval])
  );
  const newestFirst = [...fillUps].reverse();

  return (
    <ul className="fillup-log">
      {newestFirst.map((f) => {
        const interval = byClosingId.get(f.id);
        return (
          <li key={f.id} className="fillup-row">
            <div className="fillup-main">
              <span className="fillup-date">{formatDate(f.date)}</span>
              <span className="fillup-meta">
                {f.odometer.toLocaleString('en-US')} mi · {f.units} {unitShort} · ${f.pricePerUnit.toFixed(2)}/{unitShort}
              </span>
              {interval && !interval.reason && (
                <span className="fillup-tank">
                  This tank: <span className="stat-inline">{interval.efficiency.toFixed(1)}</span> {unitLabel}
                </span>
              )}
              {interval?.reason && <span className="field-warning">{describeExclusion(interval.reason)}</span>}
            </div>
            <span className={`fill-kind ${f.fullTank ? 'full' : ''}`}>{f.fullTank ? 'Full' : 'Partial'}</span>
            {confirmingId === f.id ? (
              <span className="fillup-confirm">
                <button className="link-button danger" onClick={() => onDelete(f.id)}>
                  Remove
                </button>
                <button className="link-button" onClick={() => setConfirmingId(null)}>
                  Keep
                </button>
              </span>
            ) : (
              <button
                className="link-button"
                aria-label={`Remove the ${formatDate(f.date)} fill-up`}
                onClick={() => setConfirmingId(f.id)}
              >
                Remove
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
