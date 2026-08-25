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
| `#/chef/calendar` | Month view; tap an open evening to block it |
| `#/chef/menu` | Price and availability per item |
| `#/chef/settings` | Pricing, PayNow, contact |

## Walking the whole flow

Both sides are wired to one store, so you can run a booking end to end. Use the
**Customer / Gino** switch in the prototype strip at the top of every page.

1. **Customer** → *Reserve* → pick an evening, fill in the form, send the request.
2. **Gino** → the request is in his inbox → **Confirm the date**. He now has the
   private link, with a copy button and a pre-written WhatsApp message.
3. **Customer** → open that link → choose 7 chicken + 2 vegetable, add extras,
   watch the total move → **Review & confirm**.
4. **Customer** → PayNow screen → **I've paid the deposit**.
5. **Gino** → the booking now says *"says the deposit is sent"* → **Confirm it landed**.
6. **Customer** → the summary reads *Deposit received*, and the menu locks.

Along the way: that evening disappears from the public calendar the moment the
request is made, and the menu stays editable until 72 hours before the event.

**Reset data** in the top strip puts everything back to the sample bookings.

Everything is stored in `localStorage`, so both sides must be the same browser —
two phones won't see each other's changes until there's a real backend.

## Layout

```
index.html              shell — loads fonts, css, the five scripts
assets/css/app.css      design system: "Charcoal & Ember"
assets/js/menu-data.js  every item + SETTINGS (prices, minimums, contact)
assets/js/pricing.js    quote() · validate() · prepSheet() — pure, no DOM
assets/js/store.js      date helpers + the booking store (Postgres, later)
assets/js/chef.js       the chef's four screens
assets/js/app.js        customer screens, routing, selection logic
probe-widths.html       layout probe: every route × 360/390/768, flags overflow
assets/img/*.webp       58 cutouts extracted from the chef's PDF
test.js                 26 assertions over pricing + validation
test-flow.js            29 assertions over the booking lifecycle
build-artifact.py       inlines everything into one shareable HTML file
```

`pricing.js` is deliberately free of DOM and framework code. When this becomes a
real app it moves to the server unchanged, and the browser keeps using it for the
live estimate — the client's number is shown, the server's number is charged.

## Pricing, as encoded

```
base            = $500 session + $200 chef service (4 hrs)   = $700, serves 10
extra hours     = $50 each beyond 4
add-ons         = Σ (qty × unit price)
deposit         = 50% of the total
```

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

Everything server-side: Postgres, auth, real availability, email, the private-link
tokens, and persistence. The customer's in-progress order lives in `localStorage`;
the chef's screens run on eight sample bookings in `store.js`, and every action
(confirm, mark paid, block a date, change a price) mutates that array in memory —
so a refresh resets it.

Also not wired: nothing on the Settings screen saves, and the PayNow QR is a
drawn placeholder rather than a real payment code.
