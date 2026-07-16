# GasGuide (web)

A trip fuel-cost calculator with a station map. Pick a vehicle, enter a
distance, get gallons needed and estimated cost using the cheapest nearby
gas price, plus a map of stations ranked by price. Monetized via ads (free
tier) and a Pro subscription unlocking OBD-II diagnostics, unlimited saved
vehicles, and price-drop alerts.

## Why web, not a native mobile app

This started as an Expo/React Native project. It moved to a plain web app
after repeatedly hitting Expo Go / SDK version-matching failures that were
about that specific toolchain, not the app itself — a normal, common
strategy: validate the product as a web app first, go native later once
it's proven. Nothing about the product design changed, only how it runs.
A real background-location "detect when you've stopped at a pump" feature
will need a native build eventually (browsers can't reliably track location
in the background), but that was always a later-stage feature, not
something the current stage depends on.

## Stack

- Vite + React 19 — a much simpler, more stable toolchain than a mobile
  build: no app-store version matching, no device pairing, just a browser.
- `react-leaflet` + OpenStreetMap tiles for the map — genuinely real map
  rendering with **no API key required, ever**, unlike Google/Mapbox JS
  SDKs. Swap the `TileLayer` URL in `StationMapScreen.jsx` later if you
  want a custom map style; not required for this to work.
- No backend yet. Everything currently reads from `src/data/*` mock files.

Run `npm install` then `npm run dev`. That's the entire setup — no second
"reconcile versions" command needed the way Expo required, since a web
dev server doesn't have to match a separately-installed app's version.

## Project structure

```
index.html                entry HTML, loads src/main.jsx
src/
  main.jsx                 mounts <App /> to the page
  App.jsx                   tab shell + bottom tab bar (4 tabs)
  theme.css                 every color/spacing value as CSS variables —
                            never hardcode a hex value in a component
  App.css                   layout + component styles, all classes used
                            across screens
  context/VehicleContext.jsx single source of truth for selected vehicle +
                            active condition factors, shared across tabs
  data/mockVehicles.js      placeholder vehicle specs + the condition-
                            factor (damage) model — carried over unchanged
                            from the original mobile build, zero framework-
                            specific code in this file
  data/mockStations.js      placeholder station prices + the crowdsourced
                            price-report math — also carried over unchanged
  screens/                  TripCostScreen, StationMapScreen,
                            VehicleProfileScreen, SettingsScreen
  components/                PriceBadge, StatCard
public/
  icon.png / icon-source.svg  the logo — same mark as the mobile build
```

## Brand

Forest green, deliberately not a bright "eco-app" green. The mark is a fuel
droplet with a leaf vein through it. Same palette as the original mobile
build — see the CSS variables at the top of `src/theme.css` for exact
values and what each is reserved for. Numbers (prices, MPG, distances) use
the `.stat` class (tabular numerals) — this is a calculator, figures should
read as precise. Price highlights use the fully-rounded `.price-badge`
pill, never a plain rectangle — reserved for prices specifically.

## The condition ("damage") model — deliberately manual

No API or sensor can tell you a specific car has bad alignment or
underinflated tires. `src/data/mockVehicles.js` models this as user-
reported toggles (`conditionFactors`), each an additive MPG penalty. This
is final behavior, not a placeholder. An OBD-II Bluetooth integration for
real automatic detection is a Pro-tier feature for a future native build —
browsers can't talk to OBD-II hardware, so this genuinely requires going
native eventually, unlike most other features here.

## The price + real-MPG loop

The core data acquisition strategy, and more than a price tracker:

1. Something (originally planned as a background geofence — on web, this
   more realistically becomes "prompt when the user opens the app near a
   known station, or lets them manually log a fill-up") detects a stop at
   a station in `mockStations`.
2. A single low-friction prompt asks what they paid per gallon.
3. That one answer does two things (`processFillUpReport` in
   `mockStations.js` already models the math):
   - Feeds the community price map (anonymized, aggregated)
   - Combined with miles driven since the last fill-up, produces real MPG
     for that specific vehicle — more accurate than the EPA rating

**On the prompt's framing:** lead with what the answer is for — "Help keep
prices accurate nearby — what'd you pay?" — and make it a five-second tap,
never a form. Transparency about the value exchange gets *better* response
rates than a bare, unexplained field, and the privacy policy needs to
disclose this either way, so the honest framing and the effective framing
are the same thing here.

## Monetization

- Ads: a web ad network (e.g. Google AdSense) for the free tier. Placeholder
  mount point is in `src/screens/SettingsScreen.jsx`.
- Subscriptions: Stripe Checkout or Stripe Billing works cleanly for a web
  app — unlike a native app, there's no mandatory app-store cut or
  StoreKit/Play Billing requirement here, since nothing is distributed
  through an app store.
- Pro tier is the natural home for the eventual OBD-II integration once
  this becomes a native app — it's the most hardware- and engineering-
  intensive feature, so gate it behind the tier that's supposed to fund
  further work.

## Next integrations, in build order

Cheapest/lowest-risk first, most custom/expensive last:

1. **Maps/GPS + real distance** — swap the plain-number distance field in
   `TripCostScreen.jsx` for a real destination input against a Directions
   API (Google Maps Platform or Mapbox — the map *display* itself is
   already real via Leaflet, this is specifically about route distance).
2. **Vehicle data** — replace `mockVehicles` with NHTSA vPIC (VIN decode /
   make-model-year lookup, free, no key: `vpic.nhtsa.dot.gov/api`) and
   fueleconomy.gov (EPA MPG, free, no key: `fueleconomy.gov/ws/rest`).
3. **Price + MPG crowdsourcing** — a real backend to collect and serve
   fill-up reports. The custom piece; build it once steps 1–2 are solid.
4. **Ads + Stripe subscriptions** — last, same logic as before: nothing
   about it can be tested meaningfully until the core product works and
   there's something worth putting behind a paywall.
5. **Eventually: a native wrapper** — once the web app is proven, tools
   like Capacitor can wrap this same React codebase into an installable
   native app for the background-location and OBD-II features that a
   browser genuinely can't do. This is not an immediate concern.

Use a feature branch per step. Use plan mode (Shift+Tab in Claude Code)
before any change that touches more than one screen or wires up a new API.
