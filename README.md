# Bincotan Yakitori

Booking and menu-ordering site for a private yakitori chef in Singapore.
This is the **design prototype** — real screens, real menu data, real pricing logic,
no backend yet.

**Live:** https://githubchun.github.io/bincotan-yakitori/

Send Gino that link — it works on any phone, no login. Deep links work too:
`…/#/menu`, `…/#/reserve`, `…/#/chef`.

The site carries `noindex` and a `robots.txt` disallow while it's a draft, so it
won't turn up in search results for his business.

To take it down: `gh repo delete githubchun/bincotan-yakitori`

## Run it

```sh
python3 -m http.server 8811     # then open http://localhost:8811
node -e "…" # see "Tests" below
```

Routes are hash-based:

| Route | Screen |
|---|---|
| `#/` | Home |
| `#/menu` | Full digital menu (replaces the PDF) |
| `#/reserve` | Step 1 — request a date |
| `#/order` | Explains the private link (and lists confirmed bookings, as a shortcut) |
| `#/thanks/:id` | Confirmation after a request is sent |
| `#/order/:id` | The private menu link Gino sends |
| `#/order/:id/summary` | Review, bill, PayNow deposit |
| `#/reset` | Wipes everything back to the sample data |
| `#/chef` | Gino's bookings inbox |
| `#/chef/records` | The transaction record, with chain verification |
| `#/chef/menu` | Price and availability per item |
| `#/chef/settings` | Pricing, PayNow, contact |

## Walking the whole flow

Both sides are wired to one store, so you can run a booking end to end. Use the
**Customer / Gino** switch in the prototype strip at the top of every page.

1. **Customer** → *Reserve* → pick an evening and book it. The date is taken
   immediately — Gino never approves it — against a **$70 holding deposit**
   (10% of the $700 minimum).
2. **Customer** → choose skewers right away, no waiting. 7 chicken + 2 vegetable
   are included; take more types at **$5 a skewer, one per guest, minimum 10**.
3. **Customer** → **Submit & pay**. The menu locks, and the top-up brings the
   total paid to **50% of the bill**.
4. **Gino** → confirms each payment landed in PayNow.
5. **Gino** → **Reopen their menu** if they want to change something. Money already
   confirmed stays credited; only the shortfall is re-collected.
6. The last **50%** is settled with Gino on the night.

## The transaction record

Every booking, menu submission, payment and cancellation is appended to a log
that is never edited and never deleted. Each entry carries the SHA-256 hash of
the entry before it, so the whole thing is a chain: alter any past entry and
every hash after it stops matching. `#/chef/records` verifies the chain on every
view and names the first entry that doesn't hold up.

**Why this exists.** If a customer says the wrong menu turned up, Gino opens the
booking and reads what was actually submitted, when, and by whom — with the
total as it stood at that moment.

**The emailed copy.** Every entry also renders as a plain-text email to a
dedicated inbox, carrying the full snapshot plus both hashes. That copy matters
because it lives outside the application: if the site is down, the database is
lost, or its records are doubted, the mailbox is an independent second source.

Two honest limits:

- **Email is not immutable.** Whoever owns the mailbox can delete a message. Its
  value is independence, not permanence. Treat the chain as the integrity
  mechanism and the mailbox as the backup — and consider auto-forwarding to a
  second address Gino doesn't administer.
- **The chain detects alteration, not truncation.** Editing, deleting or
  reordering any entry is caught. Lopping off the newest entries and stopping is
  not, because there's nothing after them to disagree. `test-ledger.js` asserts
  this explicitly rather than pretending otherwise. The emailed copies are what
  close that gap: the inbox still holds what the log no longer does.

Worth adding later: copy each record to the **customer** as well, so both parties
hold the same evidence rather than only the chef.

## Availability

There are no fixed service days. Gino **releases a month** on his Bookings screen,
then closes individual evenings inside it. Anything in an unreleased month is
simply not offered.

**Reset data** in the top strip puts everything back to the sample bookings.

Everything is stored in `localStorage`, so both sides must be the same browser —
two phones won't see each other's changes until there's a real backend.

## Layout

```
index.html              shell — loads fonts, css, the five scripts
assets/css/app.css      design system: "Charcoal & Ember"
assets/js/menu-data.js  every item + SETTINGS (prices, minimums, contact)
assets/js/pricing.js    quote() · validate() · prepSheet() — pure, no DOM
assets/js/ledger.js     append-only record, SHA-256 chain, email rendering
assets/js/store.js      date helpers + the booking store (Postgres, later)
assets/js/chef.js       the chef's four screens
assets/js/app.js        customer screens, routing, selection logic
probe-widths.html       layout probe: every route × 360/390/768, flags overflow
assets/img/*.webp       58 cutouts extracted from the chef's PDF
test.js                 43 assertions over pricing, extras and the payment schedule
test-ledger.js          34 assertions over the record, including nine tamper attempts
test-flow.js            70 assertions over the booking lifecycle and its records
e2e.html                28-step browser walk-through of both flows (serve, then open)
tamper.html             proves the dashboard catches an edited or deleted record
stale.html              proves recovery from an out-of-date saved store
build-artifact.py       inlines everything into one shareable HTML file
```

`pricing.js` is deliberately free of DOM and framework code. When this becomes a
real app it moves to the server unchanged, and the browser keeps using it for the
live estimate — the client's number is shown, the server's number is charged.

## Pricing, as encoded

```
base           = $500 session + $200 chef service (4 hrs)  = $700, serves 10
extra hours    = $50 each beyond 4
extra skewers  = types beyond 7 chicken / 2 vegetable,
                 charged at $5 × max(10, guests) per type
add-ons        = Σ (qty × unit price)
──────────────────────────────────────────────────────────
to hold a date = 10% of the $700 minimum          = $70, fixed
on menu lock   = 50% of the total − whatever's paid
on the night   = the remaining 50%
```

Confirmed payments are tracked individually, so reopening a menu never loses a
customer money — it recalculates what is still owed.

Minimums are enforced per item: 10 for makimono and premium skewers, 2 for
Kinki/squid/mentaiko, 10 pax for sashimi moriwase. **Comb** and **Bafun uni** are
priced "ask" — they're flagged for Gino to quote and stay out of the total.

## Tests

```sh
./run-tests.sh
```

`probe-widths.html`, served over http, loads every route in an iframe at 360 /
390 / 768 px and flags anything that pushes the page sideways.

## Build the shareable file

```sh
python3 build-artifact.py                                  # dist/bincotan.html — standalone
python3 build-artifact.py dist/bincotan-artifact.html --fragment   # for Artifact hosting
```

Both inline all 58 images as data URIs (~1.7 MB). The build asserts that no image
path escaped `asset()`, so a dynamically-built `src` can't silently ship broken.

## Placeholders to replace

Everything below is invented and marked in the UI with a dotted gold underline.
All of it lives in `SETTINGS.contact` and `SETTINGS.paynow` in `menu-data.js`.

- PayNow UEN and account name
- WhatsApp number
- Notification email address
- Domain

## Known open question

The saké listed at $100 has a contradiction in the source PDF: the English name
reads "Masumi Nanago" (a Nagano brewery) while the Japanese reads 醸し人九平次
別誂 and the prefecture is 愛知 Aichi (Kamoshibito Kuheiji). It's transcribed as
the Kuheiji, since two of three fields agree — flagged with `check: true` in the
data. Worth confirming with Gino.

## The chef's side

Four screens at `#/chef`, designed for a phone between jobs — summary first, then detail.

- **Bookings** — an attention strip (new requests / waiting on menu / deposit unpaid), a
  "next up" card, and a list filtered by what needs him. Each booking's actions are
  contextual: a new request offers confirm/decline, a confirmed one offers the menu link,
  a menu-in one offers "mark deposit received".
- **Calendar** — bookings and blocked evenings in a month grid. Tap an open evening to
  block it; it disappears from the customer's date picker immediately.
- **Menu** — price and on/off per item. Switching an item off hides it from customers;
  bookings already placed keep their quoted price.
- **Settings** — the numbers behind every quote.

WhatsApp buttons open `wa.me` with the message pre-written (confirmation, nudge, deposit
request, day-before check-in), so he keeps the personal touch without retyping.

## Not built yet

Everything server-side: Postgres, auth, email, the private-link tokens, and real
persistence. Everything currently lives in one `localStorage` record, so the two
sides must be the same browser.

Also not wired: nothing on the Settings screen saves, and the PayNow QR is a
drawn placeholder rather than a real payment code.
