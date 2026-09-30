import { useState } from 'react';
import { useVehicle } from '../context/VehicleContext';
import { usePreferences } from '../context/PreferencesContext';
import { RETURN_MINUTES_PER_MILE, computeOffer, describeReason, formatMoney, parseAmount } from '../lib/offerMath';
import { resolveOfferEfficiency, resolveOfferPrice } from '../lib/offerInputs';
import { getEfficiencyUnitLabel } from '../data/mockVehicles';
import { getPriceUnitLabel } from '../data/mockStations';
import PriceBadge from '../components/PriceBadge';

// "Worth it?" — the offer verdict for gig drivers (SPEC.md). This screen
// only collects input and renders; every number comes from src/lib.

const VERDICT_WORD = { take: 'Take it', borderline: 'Borderline', decline: 'Decline' };

const OFFER_FIELD_NAMES = { payout: 'the payout', offerMiles: 'the miles', offerMinutes: 'the minutes' };

const WARNING_COPY = {
  payout: (v) => `Double-check the payout — ${formatMoney(v)} is a lot for one offer.`,
  offerMiles: (v) => `Double-check the miles — ${v} is a lot for one offer.`,
  offerMinutes: (v) => `Double-check the minutes — ${v} is a long offer.`,
  returnMiles: (v) => `Double-check the miles back — ${v} is a long way to your zone.`,
};

export default function OfferScreen() {
  const {
    vehicles,
    selectedVehicle,
    selectedVehicleId,
    setSelectedVehicleId,
    activeFactorIds,
    realEfficiency,
    realEfficiencySummary,
    fillUps,
  } = useVehicle();
  const { preferences, setPreference } = usePreferences();

  const [payout, setPayout] = useState('');
  const [offerMiles, setOfferMiles] = useState('');
  const [offerMinutes, setOfferMinutes] = useState('');
  const [priceOverride, setPriceOverride] = useState('');
  const [editingPrice, setEditingPrice] = useState(false);
  // Kept here, not inside <Breakdown>, so the panel stays open while the
  // result briefly goes invalid (e.g. wear turned on before a value is typed).
  const [showBreakdown, setShowBreakdown] = useState(false);

  const isEv = selectedVehicle.fuelKind === 'ev';
  const effUnit = getEfficiencyUnitLabel(selectedVehicle);
  const priceUnit = getPriceUnitLabel(selectedVehicle.fuelKind);
  const fuelWord = isEv ? 'charging' : 'gas';
  const floors = preferences.offerFloors;
  const wear = preferences.offerWear;
  const returnMiles = preferences.offerReturnMiles;

  const efficiency = resolveOfferEfficiency({ vehicle: selectedVehicle, activeFactorIds, realEfficiency });
  const price = resolveOfferPrice({ fillUps, fuelKind: selectedVehicle.fuelKind, override: priceOverride });
  const result = computeOffer({
    payout,
    offerMiles,
    offerMinutes,
    returnMiles,
    fuelEconomy: efficiency.value,
    pricePerUnit: price.value,
    floors,
    wearEnabled: wear.enabled,
    wearCentsPerMile: wear.centsPerMile,
  });
  const afterCosts = `after ${fuelWord}${wear.enabled ? ' & wear' : ''}`;

  function clearOffer() {
    setPayout('');
    setOfferMiles('');
    setOfferMinutes('');
  }

  return (
    <div className="screen">
      <VerdictCard result={result} afterCosts={afterCosts} fuelWord={fuelWord} />

      {result.warnings.length > 0 && (
        <div className="warning-list" role="status">
          {result.warnings.map((key) => (
            <p key={key} className="field-warning">
              {WARNING_COPY[key](parseAmount({ payout, offerMiles, offerMinutes, returnMiles }[key]))}
            </p>
          ))}
        </div>
      )}

      <span className="label">The offer</span>
      <div className="offer-grid">
        <NumberField label="Payout" prefix="$" value={payout} onChange={setPayout} placeholder="0.00" autoFocus />
        <NumberField label="Miles" value={offerMiles} onChange={setOfferMiles} placeholder="0.0" />
        <NumberField label="Minutes" value={offerMinutes} onChange={setOfferMinutes} placeholder="0" inputMode="numeric" />
      </div>
      <NumberField
        label="Miles back to your zone"
        hint={`Remembered for your shift · counted at ${60 / RETURN_MINUTES_PER_MILE} mph`}
        value={returnMiles}
        onChange={(v) => setPreference('offerReturnMiles', v)}
        placeholder="0"
      />
      {(payout || offerMiles || offerMinutes) && (
        <button className="text-button" onClick={clearOffer}>
          Clear offer
        </button>
      )}

      <span className="label section-spacing">Vehicle</span>
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
      <p className="source-line">
        <EfficiencySource efficiency={efficiency} summary={realEfficiencySummary} effUnit={effUnit} isEv={isEv} />
      </p>

      <span className="label section-spacing">{isEv ? 'Charging price' : 'Gas price'}</span>
      <PriceRow
        price={price}
        priceUnit={priceUnit}
        editing={editingPrice}
        override={priceOverride}
        onEdit={() => setEditingPrice(true)}
        onOverride={setPriceOverride}
        onDone={() => setEditingPrice(false)}
        onReset={() => {
          setPriceOverride('');
          setEditingPrice(false);
        }}
      />

      {result.ok && (
        <Breakdown
          result={result}
          effUnit={effUnit}
          priceUnit={priceUnit}
          fuelWord={fuelWord}
          open={showBreakdown}
          onToggle={setShowBreakdown}
        />
      )}

      <FloorsCard
        floors={floors}
        wear={wear}
        afterCosts={afterCosts}
        onFloors={(next) => setPreference('offerFloors', next)}
        onWear={(next) => setPreference('offerWear', next)}
      />
    </div>
  );
}

function VerdictCard({ result, afterCosts, fuelWord }) {
  if (!result.ok) {
    return (
      <div className="verdict-card verdict-empty" aria-live="polite">
        <span className="verdict-kicker">Worth it?</span>
        <p className="verdict-prompt">{missingMessage(result.missing, fuelWord)}</p>
      </div>
    );
  }
  return (
    <div className={`verdict-card verdict-${result.verdict}`} aria-live="polite">
      <span className="verdict-word">{VERDICT_WORD[result.verdict]}</span>
      <div className="verdict-stats">
        <Stat value={formatMoney(result.net)} label={afterCosts} />
        <Stat value={formatMoney(result.hourly)} unit="/hr" label="per hour" />
        <Stat value={formatMoney(result.perMile)} unit="/mi" label="per mile" />
      </div>
      <ul className="verdict-reasons">
        {result.reasons.map((reason, i) => (
          <li key={i}>{describeReason(reason)}</li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ value, unit, label }) {
  return (
    <div className="verdict-stat">
      <span className="verdict-stat-value">
        {value}
        {unit && <span className="verdict-stat-unit">{unit}</span>}
      </span>
      <span className="verdict-stat-label">{label}</span>
    </div>
  );
}

function missingMessage(missing, fuelWord) {
  const offerGaps = missing.filter((m) => OFFER_FIELD_NAMES[m]);
  if (offerGaps.length === 3) return 'Type the payout, miles and minutes from the offer.';
  if (offerGaps.length) return `Still need ${joinWords(offerGaps.map((m) => OFFER_FIELD_NAMES[m]))}.`;
  if (missing.includes('returnMiles')) return 'Miles back to your zone should be a number — or leave it blank.';
  if (missing.includes('fuelEconomy')) {
    return 'No fuel economy for this vehicle yet. Log 3 full-tank fill-ups or pick a vehicle with an EPA rating.';
  }
  if (missing.includes('pricePerUnit')) return `Add a ${fuelWord === 'gas' ? 'gas' : 'charging'} price below.`;
  if (missing.includes('floors')) return 'Fix your floors below — they should be numbers.';
  if (missing.includes('wear')) return 'Enter your wear cost in cents per mile, or turn wear off.';
  return 'Something is missing.';
}

function joinWords(words) {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

function NumberField({ label, hint, prefix, value, onChange, placeholder, inputMode = 'decimal', autoFocus = false }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className={`input-affix ${prefix ? 'has-prefix' : ''}`}>
        {prefix && <span className="affix">{prefix}</span>}
        <input
          className="text-input"
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          enterKeyHint="next"
          aria-label={label}
        />
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function EfficiencySource({ efficiency, summary, effUnit, isEv }) {
  const needed = summary.fullFillUpsNeeded;
  const toReal = `${needed} more full ${isEv ? 'charge' : 'fill-up'}${needed === 1 ? '' : 's'} to use your real ${effUnit}`;
  const penalty = efficiency.penaltyPct ? `, −${efficiency.penaltyPct}% for what you flagged` : '';
  switch (efficiency.source) {
    case 'real':
      return (
        <>
          Using your real <b className="stat-inline">{efficiency.value.toFixed(1)}</b> {effUnit}, measured over{' '}
          {summary.validIntervals.length} full {isEv ? 'charges' : 'tanks'}.
        </>
      );
    case 'epa-city':
      return (
        <>
          EPA city <b className="stat-inline">{efficiency.base}</b> {effUnit}
          {penalty} · {toReal}.
        </>
      );
    case 'epa-combined':
      return (
        <>
          EPA <b className="stat-inline">{efficiency.base}</b> {effUnit} (combined){penalty} · {toReal}.
        </>
      );
    default:
      return <>No {effUnit} for this vehicle yet — log 3 full-tank fill-ups on the Vehicle tab.</>;
  }
}

function PriceRow({ price, priceUnit, editing, override, onEdit, onOverride, onDone, onReset }) {
  if (editing) {
    return (
      <div className="price-edit">
        <span className="input-affix has-prefix">
          <span className="affix">$</span>
          <input
            className="text-input"
            type="text"
            inputMode="decimal"
            value={override}
            onChange={(e) => onOverride(e.target.value)}
            placeholder={price.value ? price.value.toFixed(2) : '3.29'}
            aria-label={`Price per ${priceUnit}`}
            autoFocus
          />
        </span>
        <button className="text-button" onClick={onDone}>
          Use it
        </button>
        <button className="text-button muted" onClick={onReset}>
          Reset
        </button>
      </div>
    );
  }
  let caption;
  if (price.source === 'logged') {
    caption = price.daysAgo === 0 ? 'logged today' : `logged ${price.daysAgo} day${price.daysAgo === 1 ? '' : 's'} ago`;
  } else if (price.source === 'nearby') caption = `best nearby · ${price.stationName}`;
  else if (price.source === 'override') caption = 'your price for now';
  return (
    <div className="price-line">
      {price.value ? (
        <PriceBadge price={price.value} label={`per ${priceUnit} · ${caption}`} />
      ) : (
        <span className="field-warning">
          {price.source === 'invalid' ? 'That price isn’t a number.' : 'No price yet.'}
        </span>
      )}
      <button className="text-button" onClick={onEdit}>
        {price.value ? 'Change' : 'Add a price'}
      </button>
      {price.stale && (
        <span className="field-warning">
          Logged {price.daysAgo} days ago — prices move. Tap Change if it&apos;s different now.
        </span>
      )}
    </div>
  );
}

function Breakdown({ result, effUnit, priceUnit, fuelWord, open, onToggle }) {
  const miles = (n) => (Math.round(n * 10) / 10).toString();
  return (
    <details className="breakdown" open={open} onToggle={(e) => onToggle(e.currentTarget.open)}>
      <summary>How we got this</summary>
      <dl>
        <Row label="Total miles" value={`${miles(result.totalMiles)} mi`} note={`${miles(result.offerMiles)} on the offer + ${miles(result.returnMiles)} back`} />
        <Row
          label="Total time"
          value={`${Math.round(result.totalMinutes)} min`}
          note={`${Math.round(result.offerMinutes)} on the offer + ${Math.round(result.returnMinutes)} to get back`}
        />
        <Row
          label={fuelWord === 'gas' ? 'Gas used' : 'Energy used'}
          value={`${result.fuelUsed.toFixed(2)} ${priceUnit}`}
          note={`at ${result.fuelEconomy.toFixed(1)} ${effUnit}`}
        />
        <Row label={fuelWord === 'gas' ? 'Gas cost' : 'Charging cost'} value={formatMoney(result.fuelCost)} note={`at ${formatMoney(result.pricePerUnit)}/${priceUnit}`} />
        {result.wearEnabled && (
          <Row label="Wear" value={formatMoney(result.wearCost)} note={`${result.wearCentsPerMile}¢ × ${miles(result.totalMiles)} mi`} />
        )}
        <Row label="Payout" value={formatMoney(result.payout)} />
        <Row label="You keep" value={formatMoney(result.net)} strong />
      </dl>
    </details>
  );
}

function Row({ label, value, note, strong = false }) {
  return (
    <div className={`breakdown-row ${strong ? 'strong' : ''}`}>
      <dt>
        {label}
        {note && <span className="breakdown-note">{note}</span>}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

function FloorsCard({ floors, wear, afterCosts, onFloors, onWear }) {
  return (
    <section className="floors-card section-spacing" aria-label="Your floors">
      <span className="label">Your floors</span>
      <p className="hint">The least you&apos;ll take, {afterCosts}. Meet both and it&apos;s a Take.</p>
      <div className="floors-grid">
        <NumberField
          label="Per hour"
          prefix="$"
          value={floors.hourly}
          onChange={(v) => onFloors({ ...floors, hourly: v })}
          placeholder="18"
        />
        <NumberField
          label="Per mile"
          prefix="$"
          value={floors.perMile}
          onChange={(v) => onFloors({ ...floors, perMile: v })}
          placeholder="1.00"
        />
      </div>
      <button
        type="button"
        className="check-row"
        role="checkbox"
        aria-checked={wear.enabled}
        onClick={() => onWear({ ...wear, enabled: !wear.enabled })}
      >
        <span className={`checkbox ${wear.enabled ? 'checked' : ''}`} />
        <span className="check-row-text">
          Count wear &amp; tear
          <span className="check-row-hint">Tires, oil, brakes, depreciation — your own estimate per mile.</span>
        </span>
      </button>
      {wear.enabled && (
        <NumberField
          label="Wear cost (cents per mile)"
          value={wear.centsPerMile}
          onChange={(v) => onWear({ ...wear, centsPerMile: v })}
          placeholder="¢ per mile"
        />
      )}
    </section>
  );
}
