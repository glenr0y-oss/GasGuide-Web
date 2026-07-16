const PRO_FEATURES = [
  'OBD-II real-time diagnostics (auto-detects mileage-hurting issues)',
  'Unlimited saved vehicles',
  'Price-drop alerts for your regular routes',
  'No ads',
];

export default function SettingsScreen() {
  return (
    <div className="screen">
      {/* NEXT INTEGRATION: an ad slot (e.g. Google AdSense for web) goes
          here for free-tier users. Wrap in `{!isPro && <AdSlot />}` once
          billing state exists. See CLAUDE.md "Monetization." */}
      <div className="ad-placeholder">
        <span className="ad-placeholder-text">Ad banner placeholder</span>
      </div>

      <div className="pro-card">
        <p className="pro-title">GasGuide Pro</p>
        <p className="pro-subtitle">$4.99/mo</p>
        {PRO_FEATURES.map((feature) => (
          <div className="pro-feature-row" key={feature}>
            <span>✓</span>
            <span>{feature}</span>
          </div>
        ))}
        <button
          className="upgrade-button"
          onClick={() =>
            alert(
              'This is where a real payment provider (Stripe for web) takes over. See CLAUDE.md "Monetization."'
            )
          }
        >
          Upgrade
        </button>
      </div>

      <span className="label section-spacing">Preferences</span>
      <SettingsRow label="Fill-up price prompts" />
      <SettingsRow label="Location access" />
      <SettingsRow label="Units — miles / gallons" />

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
