# GasGuide (web)

— trip fuel-cost calculator with a station price map —
now running as a website instead of through Expo Go. This sidesteps the
mobile SDK version-matching problems entirely: it's just a browser.

## Run it

```bash
git init && git add -A && git commit -m "GasGuide web starter"
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
then open the **Network** address in your phone's browser — no app store,
no QR code, no install required on the phone at all.

Commit before you open this in Claude Code, and again after any change you
understand and want to keep.

## Continue building it in Claude Code

Open this folder in Claude Code (`cd` into it, run `claude`). It reads
**CLAUDE.md** automatically — full architecture, brand decisions, and
exactly where each real integration goes, in build order.

## What's real vs. mock right now

| Piece | Status |
|---|---|
| Calculator math (gallons, cost) | Real |
| Condition-factor ("damage") adjustments | Real — manual by design |
| Map rendering | Real (OpenStreetMap via Leaflet, no key needed, ever) |
| Station pins + prices | Mock data (`src/data/mockStations.js`) |
| Vehicle specs | Mock data (`src/data/mockVehicles.js`) |
| Trip distance | Manual number entry, not yet a real route lookup |
| Ads / paywall screens | Placeholder UI only, nothing wired to billing |

## Project structure

See **CLAUDE.md** for the full breakdown.
