# SPEC — "Worth it?" verdict screen

Status: **approved for build** · Owner: G · Stack: Vite + React 19 (web) · Tier: **Free**

A gig delivery driver gets an offer — payout, miles, minutes — and has about
30 seconds to accept it. GasGuide answers one question in that window:
**after gas, is this offer worth my time and my car?**

---

## 1. Problem

Delivery apps show the payout and the miles, never the driver's cost. A $7.50
offer for 5 miles *feels* fine, but once the drive back to the driver's zone and
the gas for all of it come out, it can land well under what the driver would
accept by the hour. Drivers do this math in their heads, badly, dozens of times
a shift. Every bad accept costs money; every good decline costs money too.

GasGuide already knows the two things the math needs and the gig apps don't:
**this car's real MPG** (from the fill-up log) and **what this driver actually
paid for gas**. That's the edge over generic earnings trackers.

## 2. Goals

1. A driver gets a verdict in **≤ 10 seconds** from opening the tab, with three
   numbers typed.
2. The verdict is computed from **labeled** inputs only — every MPG and price
   on screen says where it came from.
3. **Real MPG** replaces the EPA rating as soon as the driver has logged three
   full-tank fill-ups, so the verdict gets more accurate the more they use it.
4. Three real drivers use it for a full shift and each can name at least one
   offer they'd have taken without it (see §10).

## 3. Non-goals (v1)

| Out of scope | Why |
|---|---|
| Offer history, shift analytics, earnings dashboards | Pro features. v1 proves the verdict is trusted first. |
| Price-drop or offer alerts | Pro; needs a backend. |
| Multiple vehicles per shift / fleet | Pro. The selected vehicle is the one on shift. |
| Tax / mileage export | Pro; needs history first. |
| Reading offers from the gig app automatically (screen reading, overlays, accessibility hooks) | Violates the gig apps' terms and gets drivers deactivated. Typing three numbers is the product. |
| Stacked / batched orders as separate legs | Enter the combined payout, miles and minutes. Revisit if testers ask. |
| Sending offer data anywhere | Everything stays on the device (localStorage). |

## 4. Users and stories

**Primary: the multi-app gig driver** (DoorDash, Uber Eats, Instacart, Spark),
part-time or full-time, driving their own car, deciding offer by offer.

1. As a driver looking at an offer, I want to type payout, miles and minutes
   and see Take / Borderline / Decline so I can answer before the offer expires.
2. As a driver, I want the drive back to my zone counted, so a "short" offer
   that strands me 8 miles out doesn't look better than it is.
3. As a driver, I want to set my own floors ($/hour and $/mile) so the verdict
   reflects what *my* time is worth.
4. As a driver who logs fill-ups, I want the math to use my car's real MPG
   so the fuel cost is my fuel cost, not a sticker estimate.
5. As a driver, I want to see *why* an offer is Borderline ("$2.55/hr under
   your floor") so I can overrule it knowingly.
6. As a driver who wants the honest number, I want the option to include a
   per-mile wear cost (tires, oil, repairs, depreciation).
7. Edge: as a driver who fat-fingers "70" for "7.0" miles, I want a nudge to
   double-check instead of a silently absurd number.
8. Edge: as a driver with no MPG or no gas price on file, I want to be told
   what's missing instead of getting a made-up verdict.

## 5. Inputs

| Input | Where it comes from | Required | Notes |
|---|---|---|---|
| **Payout** ($) | Typed per offer | Yes | The total the offer shows, tip included. |
| **Offer miles** | Typed per offer | Yes | Pickup + drop-off, as the offer shows it. (Uber shows the two legs separately — add them.) |
| **Offer minutes** | Typed per offer | Yes | The app's time estimate for the whole offer. |
| **Miles back to your zone** | Typed once, **remembered** | No (blank = 0) | The dead-head drive after drop-off. Most drivers reuse the same number all shift, so it persists. |
| **Fuel economy** | See §6.1 | Yes | Never typed on this screen. |
| **Gas price** ($/gal) | Last logged fill-up price, **editable** | Yes | Falls back to the best nearby station price. See §6.2. |
| **Floors** | Driver settings, remembered | Yes | Defaults: **$18.00/hr** and **$1.00/mi**, both after costs. Shown on the screen at all times. |
| **Wear cost** (¢/mi) | Driver setting | No | Off by default. See §7. |

Why two mileage fields instead of three: the gig apps show pickup + drop-off as
one number (DoorDash, Instacart) far more often than as legs, and every extra
field costs seconds the driver doesn't have. The return leg is separate because
the apps never show it and it barely changes during a shift.

## 6. The math

All math lives in one pure module, **`src/lib/offerMath.js`**. Components never
do arithmetic; they call the module and render what it returns.

```
totalMiles     = offerMiles + returnMiles
returnMinutes  = returnMiles × 2          (30 mph for the drive back — shown on screen)
totalMinutes   = offerMinutes + returnMinutes
fuelUsed       = totalMiles ÷ fuelEconomy   (gallons, or kWh for an EV)
fuelCost       = fuelUsed × pricePerUnit
wearCost       = totalMiles × wearCentsPerMile ÷ 100      (0 when wear is off)
net            = payout − fuelCost − wearCost
hourly         = net ÷ (totalMinutes ÷ 60)
perMile        = net ÷ totalMiles
```

### Verdict

Compared on **unrounded** values — rounding happens only for display.

| Verdict | Rule |
|---|---|
| **Decline** | `net ≤ 0`, **or** hourly < 85% of the hourly floor, **or** perMile < 85% of the per-mile floor |
| **Take** | hourly ≥ hourly floor **and** perMile ≥ per-mile floor |
| **Borderline** | Anything else — at least one number is under its floor, but by less than 15% |

Each verdict carries plain-English reasons, e.g. *"$2.55/hr under your $18.00
floor"* and *"7¢/mi under your $1.00 floor"*. A Take shows the margin over the
tighter floor.

### 6.1 Fuel economy source (in priority order)

1. **Your real MPG** — from the fill-up log, once there are **3 full-tank
   fill-ups** (2 complete tanks measured). See §8.
2. **EPA city MPG**, adjusted by any condition factors the driver flagged —
   delivery driving is stop-and-go, so city is the honest fallback. Captured
   from fueleconomy.gov (`city08` / `cityE`) for vehicles added by VIN.
3. **EPA combined MPG**, adjusted by condition factors — when city isn't known.
4. **None** → no verdict. The screen says: *"Log 3 full-tank fill-ups or pick
   a vehicle with an EPA rating."*

The source is always printed under the numbers: *"Using your real 29.4 mpg"*,
*"EPA city 28 mpg, −3% for what you flagged"*, *"EPA 35 mpg (combined) — 2 more
full-tank fill-ups to use your real MPG"*.

EVs use the same math in their own units: mi/kWh, $/kWh, "charging" instead of
"gas".

### 6.2 Gas price source

1. The price on the **most recent fill-up logged for this vehicle**, labeled
   *"logged 2 days ago"*.
2. Else the **best nearby station price** (the same seam Trip Cost uses),
   labeled with the station name.
3. Either way the driver can tap and override it for this session.
4. **Stale**: a logged price older than **14 days** still computes, but shows
   *"logged 23 days ago — tap to update"*.

## 7. Decision: per-mile wear cost in v1?

**For including it**
- Gas is only part of what a delivery mile costs. Tires, oil, brakes and
  depreciation scale with miles too; ignoring them makes marginal offers look
  profitable, and "accuracy is the product" is GasGuide's first principle.
- Competitors show a mileage figure; leaving it out entirely reads as naive.
- It's one setting and one line in the breakdown — small to build and test.

**Against**
- Wear per mile is car-specific and hard to know. A preset number would be a
  guess dressed as precision — the exact failure GasGuide exists to avoid.
- The per-mile floor already gives drivers a lever for wear.
- Every extra concept slows a 30-second decision.

**Decision: ship it in v1 as an opt-in setting, off by default, with no preset
value.** The driver types their own ¢/mile. When on, the labels change from
"after gas" to "after gas & wear" and wear gets its own line in the breakdown,
so it's never hidden inside another number.

## 8. Real MPG from the fill-up log

Math lives in **`src/lib/fillUps.js`** (pure). Each fill-up stores:
`id, date, odometer, units (gallons or kWh), pricePerUnit, fullTank`.

**Method (full-to-full):** between two consecutive full-tank fill-ups, miles =
odometer difference, fuel = everything pumped *after* the first full fill up to
and including the second (partial fills in between count). Real MPG =
Σ miles ÷ Σ fuel across all valid intervals — distance-weighted, not an average
of averages. Needs **≥ 2 valid intervals** (i.e. 3 full-tank fill-ups).

**Validation when saving**

| Check | Result |
|---|---|
| Odometer ≤ the previous fill-up's | **Blocked**: "That's lower than your last fill-up (45,500). Typo?" |
| Units ≤ 0, or > 110% of the tank (or > 40 gal / 150 kWh if tank unknown) | **Blocked**: "More than your tank holds." |
| Price ≤ 0 or ≥ $20/gal ($2/kWh) | **Blocked** |
| Miles since last fill-up > 125% of a tank's range (or > 700 mi if unknown) | **Saved with a warning**: "More than a tank's range — missed logging a fill-up, or a typo?" That interval is excluded from real MPG. |
| Date in the future | **Blocked** |

**Interval exclusion:** an interval whose MPG falls outside **50%–160% of the
EPA rating** (or 5–80 mpg / 1–8 mi/kWh with no rating) is excluded with a reason
shown in the log. A partial fill before the first full fill has no anchor and
is ignored for MPG (its price still counts as "last logged price").

**Worked example — partial fill**

| # | Date | Odometer | Gallons | Full? |
|---|---|---|---|---|
| 1 | Sep 1 | 45,000 | 11.0 | ✓ |
| 2 | Sep 8 | 45,320 | 10.2 | ✓ → 320 mi ÷ 10.2 gal = 31.4 mpg |
| 3 | Sep 12 | 45,500 | 5.0 | partial |
| 4 | Sep 16 | 45,650 | 6.0 | ✓ → 330 mi ÷ (5.0 + 6.0) gal = 30.0 mpg |

Real MPG = (320 + 330) ÷ (10.2 + 11.0) = **30.7 mpg**.

**Skipped log:** if #3 was never logged, interval 2 reads 330 ÷ 6.0 = 55 mpg —
above 160% of a 32 mpg rating (51.2), so it's excluded and flagged; real MPG
waits for another good interval.

**Odometer typo:** 4,565 (dropped a digit) is blocked as lower than 45,500.
456,500 (extra digit) saves with the range warning and its interval is excluded.

## 9. Worked examples (verdict)

**Example 1 — real MPG, Borderline.** 2022 Camry, real MPG 29.4, gas $3.29
logged 2 days ago, floors $18/hr and $1.00/mi, wear off.
Offer: **$7.50 · 5.2 mi · 22 min**, 2.0 mi back to zone.

| Step | Value |
|---|---|
| Total miles | 5.2 + 2.0 = **7.2 mi** |
| Total minutes | 22 + (2.0 × 2) = **26 min** |
| Gas used | 7.2 ÷ 29.4 = 0.2449 gal |
| Gas cost | 0.2449 × $3.29 = **$0.81** |
| Net | $7.50 − $0.81 = **$6.69** |
| Hourly | $6.694 ÷ (26 ÷ 60) = **$15.45/hr** (86% of floor) |
| Per mile | $6.694 ÷ 7.2 = **$0.93/mi** (93% of floor) |
| Verdict | **Borderline** — "$2.55/hr under your $18.00 floor", "7¢/mi under your $1.00 floor" |

**Example 2 — EPA fallback + wear, Decline.** 2021 Civic, EPA 35 mpg combined
(no city figure), "Tires underinflated" flagged (−3%) → 33.95 mpg; only one
full-tank fill-up logged, so EPA is used. Gas $3.19 logged today. Wear **on** at
10¢/mi. Floors $18/hr, $1.00/mi.
Offer: **$5.25 · 6.8 mi · 24 min**, 3.0 mi back.

| Step | Value |
|---|---|
| Total miles | **9.8 mi** · Total minutes 24 + 6 = **30 min** |
| Gas | 9.8 ÷ 33.95 = 0.2887 gal × $3.19 = **$0.92** |
| Wear | 9.8 × $0.10 = **$0.98** |
| Net | $5.25 − $0.92 − $0.98 = **$3.35** |
| Hourly | **$6.70/hr** (37% of floor) · Per mile **$0.34/mi** |
| Verdict | **Decline** — "$11.30/hr under your $18.00 floor" |

## 10. Edge cases

| Case | Behavior |
|---|---|
| Payout, offer miles or minutes blank, 0, negative or not a number | No verdict. The card says which field is missing. |
| Return miles blank | Treated as 0 (optional). |
| Miles > 100, minutes > 240 or payout > $200 | Computes, plus a "double-check" note naming the field. |
| No fuel economy | No verdict; says how to get one (§6.1). |
| No gas price at all | No verdict; asks for a price. |
| Stale price (> 14 days) | Computes; shows the age and invites an update. |
| Net ≤ 0 | **Decline** — "You'd lose money on this one." |
| Switch vehicle mid-entry | Inputs stay; numbers recompute with that vehicle's fuel economy and price. |
| EV selected | Same math in kWh; labels switch to charging. |
| Exactly on a floor | Counts as meeting it (≥). |

## 11. What the screen must never do

- Show a verdict when a required input is missing or invalid.
- Use a number whose source isn't printed on the screen.
- Compare rounded numbers to floors.
- Send offer data off the device.
- Accept or decline for the driver, or read the gig app's screen.
- Interrupt entry with a modal.
- Use the amber price pill for anything but a price.
- Call anything "real MPG" before 2 valid full-to-full intervals exist.

## 12. Requirements

**P0 (ships in v1)**
- "Worth it?" tab with payout, offer miles, minutes, remembered return miles.
- Live verdict (Take / Borderline / Decline) with net, $/hr, $/mi and reasons.
- Floors editor on the screen; floors persist.
- Fuel-economy and price sources resolved and labeled per §6.
- Fill-up log with odometer + full-tank flag; real MPG per §8; log visible on
  the Vehicle tab with delete for typos.
- Optional wear cost per §7.
- `offerMath.js` and `fillUps.js` covered by automated tests for every example
  and edge case in this spec.

**P1 (fast follow)**
- "Clear offer" after each decision; quick-entry keyboard flow tuned with testers.
- Offer counter for the shift (local only).

**P2 (design for, don't build)**
- Offer history + shift analytics (Pro) — `computeOffer()` already returns a
  plain object that can be stored as-is.
- Backend sync of fill-ups for the community price map.

## 13. Acceptance criteria (check by hand)

- [ ] Example 1 inputs on a vehicle with 29.4 real MPG show **Net $6.69 ·
      $15.45/hr · $0.93/mi · Borderline**.
- [ ] Example 2 inputs show **Net $3.35 · $6.70/hr · $0.34/mi · Decline**, with a
      separate $0.98 wear line.
- [ ] $12.00 · 4.5 mi · 18 min · 1.0 mi back at 32 mpg and $3.29 shows **Take**
      ($11.43 net, $34.30/hr, $2.08/mi).
- [ ] Clearing the minutes field removes the verdict and names the missing field.
- [ ] Typing 700 in offer miles shows a "double-check" note.
- [ ] Return miles survive a page reload.
- [ ] Floors survive a page reload and the verdict changes when a floor changes.
- [ ] A vehicle with 2 full-tank fill-ups shows the EPA source and "1 more
      full-tank fill-up"; the 3rd valid one switches the label to real MPG.
- [ ] Logging an odometer lower than the last one is refused with a message.
- [ ] Deleting a fill-up recomputes real MPG.
- [ ] Turning wear on changes the label to "after gas & wear" and adds a line.
- [ ] With the Pro preview on, the screen follows the Pro theme.
- [ ] `npm test` passes.

## 14. Success metrics

- **Leading (first shift):** each tester checks ≥ 20 offers; median time to
  verdict ≤ 10 s; zero "that number is wrong" reports.
- **Lagging (1–2 weeks):** 2 of 3 testers still use it after a week; each can
  name an offer it changed their mind on.
- **Measured by:** the five tester questions in the Bottle-phase handoff.

## 15. Open questions

| Question | Owner | Blocking? |
|---|---|---|
| Is 30 mph right for the drive back, or should it be a setting? | Testers | No |
| Do drivers think in gross $/mi (the "$1 a mile" rule) or net? Floors use net for consistency. | Testers | No |
| Are $18/hr and $1.00/mi sensible starter floors in central CT? | Testers | No |
| Should stacked orders get their own entry mode? | Testers | No |
