# Bincotan Yakitori

Booking and menu-ordering site for a private yakitori chef in Singapore.

**Live:** https://githubchun.github.io/bincotan-yakitori/

A working design prototype — real menu data, real pricing, both sides of the
flow. No backend yet: everything lives in one `localStorage` record.

> **Picking this up after a break?** Read [`docs/HANDOFF.md`](docs/HANDOFF.md)
> first. It has the state of play, what to do next, the open questions, and the
> traps that already cost us an afternoon.

---

## Documentation

| Document | What's in it |
|---|---|
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | State of play, next steps, open questions, known gaps, traps |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Why the design is the way it is, and what was rejected |
| [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) | Record shapes, the lifecycle, invariants, pricing rules |

---

## Run it

```sh
python3 -m http.server 8811     # then open http://localhost:8811
```

No build step, no dependencies. Plain HTML, CSS and JavaScript.

Python 3 is needed only for the local server and `build-artifact.py`; Node for
the test runner. Neither is required to *use* the site.

### Routes

Hash-based, so it works on static hosting.

| Route | Screen |
|---|---|
| `#/` | Home |
| `#/menu` | The full menu, replacing his PDF |
| `#/reserve` | Take a date |
| `#/thanks/:id` | Confirmation and the holding deposit |
| `#/order/:id` | The private menu link |
| `#/order/:id/summary` | Review, bill, payment |
| `#/order` | Explains the private link; lists bookings as a shortcut |
| `#/chef` | Gino: calendar and bookings |
| `#/chef/records` | Gino: the transaction record |
| `#/chef/menu` | Gino: price and availability per item |
| `#/chef/settings` | Gino: the numbers behind every quote |
| `#/reset` | Wipe everything back to the sample data |

---

## Walking the whole flow

Both sides share one store, so a booking runs end to end. Use the
**Customer / Gino** switch in the strip at the top of every page.

1. **Customer → Reserve** — pick an open evening and book it. The date is taken
   immediately, against a **$70 holding deposit** (10% of the $700 minimum).
   Gino never approves it.
2. **Customer** — choose skewers straight away. 7 chicken + 2 vegetable are
   included; take more types at **$5 a skewer, one per guest, minimum 10**.
3. **Customer → Submit & pay** — the menu locks, and the top-up brings the total
   paid to **50% of the bill**.
4. **Gino** — confirms each payment landed in PayNow.
5. **Gino → Reopen their menu** if they want a change. Confirmed money stays
   credited; only the shortfall is re-collected.
6. The final **50%** is settled with Gino on the night.

Every step of that is recorded — see **The transaction record** below.

**Reset data** in the top strip restores the sample bookings.

Everything is stored in `localStorage`, so both sides must be the same browser.
Two phones won't see each other until there's a real backend.

---

## Availability

There are no fixed service days. Gino **releases a month** on his Bookings
screen, then closes individual evenings inside it. Anything in an unreleased
month simply isn't offered.

If bookings dry up, check whether he's released the next month.

---

## Pricing

```
base           = $500 session + $200 chef service (4 hrs)  = $700, serves 10
extra hours    = $50 each beyond 4
extra skewers  = types beyond 7 chicken / 2 vegetable,
                 charged at $5 × max(10, guests) per type
add-ons        = Σ (qty × unit price)
──────────────────────────────────────────────────────────
to hold a date = 10% of the $700 minimum       = $70, fixed
on menu lock   = 50% of the total − whatever's already paid
on the night   = the remaining 50%
```

Confirmed payments are tracked individually, so reopening a menu never loses a
customer money — it recalculates what's still owed.

Items priced "ask" (Comb, Bafun Uni) stay out of the total and are flagged for
Gino to quote.

---

## The transaction record

Every booking, menu submission, payment and cancellation is appended to a log
that is never edited and never deleted. Each entry carries the SHA-256 hash of
the entry before it, so the whole thing is a chain: alter any past entry and
every hash after it stops matching. `#/chef/records` verifies the chain on every
view and names the first entry that doesn't hold up.

**Why it exists.** If a customer says the wrong menu turned up, Gino opens the
booking and reads what was actually submitted, when, and by whom — with the
total as it stood at that moment.

**The mailed copy.** Every entry also renders as a plain-text message to a
dedicated inbox, carrying the full snapshot plus both hashes. That copy matters
because it lives outside the application.

Two honest limits, both asserted in the tests rather than glossed over:

- **A mailbox copy is not immutable.** Whoever owns it can delete a message. Its
  value is independence, not permanence.
- **The chain detects alteration, not truncation.** Editing, deleting or
  reordering any entry is caught. Lopping off the newest entries and stopping is
  not, because nothing after them disagrees. The mailed copies close that gap.

---

## Layout

```
index.html              shell — loads fonts, css, the six scripts
assets/css/app.css      design system: "Charcoal & Ember"
assets/js/menu-data.js  every item + SETTINGS (prices, minimums, contact)
assets/js/pricing.js    quote · validate · paymentPlan · prepSheet — pure, no DOM
assets/js/ledger.js     append-only record, SHA-256 chain, email rendering — pure
assets/js/store.js      persistence, booking lifecycle, availability
assets/js/chef.js       the chef's four screens
assets/js/app.js        customer screens, routing, selection logic
assets/img/*.webp       58 cutouts extracted from the chef's PDF menu
build-artifact.py       inlines everything into one shareable HTML file
run-tests.sh            all four unit suites
```

`pricing.js` and `ledger.js` are deliberately free of DOM, framework and storage
code. When this becomes a real app they move to the server unchanged, and the
browser keeps using them for the live estimate — the client's number is shown,
the server's number is charged.

`store.js` is the only file that touches persistence, and every mutation in it
appends to the record. Nothing writes around that.

---

## Tests

```sh
./run-tests.sh
```

**183 assertions** across four suites — `run-tests.sh` prints the total, so
that's the number to trust if this one has drifted:

| Suite | Covers |
|---|---|
| `test.js` | Pricing, extras, the payment schedule, menu data integrity |
| `test-ledger.js` | The record — nine tamper scenarios, eight caught and one proven undetectable |
| `test-docs.js` | Claims made in `docs/` checked against the code |
| `test-flow.js` | The booking lifecycle and the records it produces |

`test-docs.js` exists so the documentation can't quietly drift. If it fails,
either the code changed or the docs are now lying — fix whichever is wrong.

### Browser harnesses

Serve the site, then open each. Every one prints its own pass/fail.

| Harness | What it proves |
|---|---|
| `e2e.html` | 28 steps: book → build → submit → pay → confirm → reopen |
| `tamper.html` | The dashboard catches an edited or deleted record |
| `stale.html` | Recovery from an out-of-date or corrupt saved store |
| `probe-widths.html` | No route scrolls sideways at 360 / 390 / 768px |

---

## Build the shareable file

```sh
python3 build-artifact.py                                        # dist/bincotan.html
python3 build-artifact.py dist/bincotan-artifact.html --fragment # for artifact hosting
```

Both inline all 58 images as data URIs (~1.8 MB). The build asserts that no
image path escaped `asset()`, so a dynamically-built `src` can't silently ship
broken.

---

## Placeholders

Everything invented is marked in the UI with a dotted gold underline and lives
in `SETTINGS` in `assets/js/menu-data.js`: PayNow UEN and account name, WhatsApp
number, notification address, records inbox, the extra-skewer price, and the
domain.

**Never commit the real PayNow details.** This repo is public.

The site carries `noindex` and a `robots.txt` disallow while it's a draft, so it
won't surface in search results for Gino's business.

To take it down: `gh repo delete githubchun/bincotan-yakitori`
