import confetti from 'canvas-confetti';
import { usePro } from '../context/ProContext';

const PRO_FEATURES = [
  'OBD-II real-time diagnostics (auto-detects mileage-hurting issues)',
  'Unlimited saved vehicles',
  'Price-drop alerts for your regular routes',
  'No ads',
];

export default function SettingsScreen() {
  const { isPro, togglePro } = usePro();

  function handleTogglePro() {
    // NEXT INTEGRATION: dev tool only, for previewing the Pro theme. A
    // real payment provider (Stripe for web) replaces this entirely — see
    // CLAUDE.md "Monetization." Confetti only plays on the on-transition.
    if (!isPro) {
      confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#e9b44c', '#b7e4c7'],
      });
    }
    togglePro();
  }

  return (
    <div className="screen">
      {!isPro && (
        <div className="ad-placeholder">
          <span className="ad-placeholder-text">Ad banner placeholder</span>
        </div>
      )}

      {isPro ? (
        <div className="pro-welcome-card">
          <p className="pro-welcome-title">Welcome to Pro</p>
          <p className="pro-welcome-subtitle">
            You're all set — unlimited vehicles, price-drop alerts, OBD-II
            diagnostics, and no ads.
          </p>
          <button className="upgrade-button" onClick={handleTogglePro}>
            Turn off Pro preview
          </button>
        </div>
      ) : (
        <div className="pro-card">
          <p className="pro-title">GasGuide Pro</p>
          <p className="pro-subtitle">$4.99/mo</p>
          {PRO_FEATURES.map((feature) => (
            <div className="pro-feature-row" key={feature}>
              <span>✓</span>
              <span>{feature}</span>
            </div>
          ))}
          <button className="upgrade-button" onClick={handleTogglePro}>
            Preview Pro
          </button>
        </div>
      )}

      <span className="label section-spacing">Preferences</span>
      <SettingsRow label="Ask what I paid at the pump" />
      <SettingsRow label="Let GasGuide find stations near me" />
      <SettingsRow label="Miles & gallons" />

      <span className="label section-spacing">About</span>
      <SettingsRow label="Privacy policy" />
      <SettingsRow label="Terms of service" />
    </div>
  );
}

function SettingsRow({ label }) {
  return (
    <button className="settings-row">
      <span className="settings-row-text">{label}</span>
      <span>›</span>
    </button>
  );
}
