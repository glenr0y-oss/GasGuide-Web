# GasGuide (web)

trip fuel-cost calculator with a station price map
now running as a website instead of through Expo Go. This sidesteps the
mobile SDK version-matching problems entirely: it's just a browser.

## Run it

```bash
git clone https://github.com/glenr0y-oss/GasGuide-Web.git
cd GasGuide-Web
npm install
npm run dev
```

Terminal will print a couple of URLs, something like:

```
Local:   http://localhost:5173/
Network: http://192.168.x.x:5173/
```

Open the **Local** one on your own computer to check it works. To see it on
your phone: make sure your phone is on the same Wi-Fi as your computer,
then open the **Network** address in your phone's browser.No app store,
no QR code, no install required on the phone at all.

Commit before you open this in Claude Code, and again after any change you
understand and want to keep.

## Run the tests

```bash
npm test
```

Vitest runs the unit tests for the money and mileage math in `src/lib/` and
the screen tests. They should all pass before anything gets committed.

## Continue building it in Claude Code

Open this folder in Claude Code (`cd` into it, run `claude`). It reads
**CLAUDE.md** automatically, full architecture, brand decisions, and
exactly where each real integration goes, in build order.

## What's real vs. mock right now

| Piece | Status |
|---|---|
| Calculator math (gallons, cost) | Real |
| "Worth it?" offer verdict for gig drivers | Real — see SPEC.md |
| Fill-up log + real MPG (full-to-full) | Real — stored on the device |
| Condition-factor ("damage") adjustments | Real — manual by design |
| Map rendering | Real (OpenStreetMap via Leaflet, no key needed, ever) |
| Station pins + prices | Mock data (`src/data/mockStations.js`) |
| Vehicle specs | Mock sample fleet, plus real NHTSA + EPA lookup when you add a vehicle by VIN |
| Trip distance | Manual number entry, not yet a real route lookup |
| Ads / paywall screens | Placeholder UI only, nothing wired to billing |

## Project structure

See **CLAUDE.md** for the full breakdown.
