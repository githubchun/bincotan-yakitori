# Data model

Every shape the app persists, the rules that must hold about them, and how the
booking lifecycle works. This is the document to translate into Postgres tables
when the backend gets built.

Everything lives in one `localStorage` record under `bincotan.store.v4`.

---

## The store

```js
{
  seq: 433,                       // last booking number issued
  seededOn: '2026-08-25',
  releasedMonths: ['2026-08', '2026-09'],   // months open for booking
  blocked: ['2026-09-08', '2026-09-09'],    // evenings closed inside a released month
  bookings: [ /* Booking */ ],
  log: [ /* Entry */ ],           // append-only, see below
  menu: { /* MenuChanges */ }     // what Gino has done to the menu, see below
}
```

`isUsableStore()` in `store.js` refuses to load a record missing any of these.
**Bump `STORE_KEY` whenever this shape changes** — see the trap in `HANDOFF.md`.

---

## Booking

```js
{
  id: 'BY-0434',                  // sequential, zero-padded
  createdAt: '2026-08-25',

  // who and where
  name: 'Yi Chun',
  phone: '+65 9111 2222',
  addr: '12 Test Road, Singapore',
  notes: 'Dad turns 60. One guest is vegetarian.',

  // when
  date: '2026-08-28',             // local calendar date, never a UTC serialisation
  time: '19:00',
  hours: 5,                       // chef hours; 4 included, more billed
  pax: 12,

  // what
  chicken: ['thigh-leek', 'skin', ...],   // ORDER MATTERS — see below
  veg: ['asparagus', 'white-corn', ...],
  addons: { 'wagyu': 10, 'pb-shisho': 12 },

  // state
  menuLocked: true,
  completed: false,
  payments: [ /* Payment */ ]
}
```

### `chicken` and `veg` are ordered

The **first `includedChicken` (7)** entries are part of the set; anything after
is an extra type, billed at `extraSkewerPrice × max(10, pax)`. Same for `veg`
with `includedVeg` (2).

This means **reordering these arrays changes the bill.** Selection appends and
removal splices, which preserves the property. Don't sort them.

### There is no `status` field

Deliberately. See *Status is derived* in `DECISIONS.md`.

---

## Payment

```js
{ kind: 'hold' | 'menu', amount: 70, claimed: true, confirmed: false }
```

- `claimed` — the customer says they've sent it.
- `confirmed` — Gino has seen it land.

Only `confirmed` payments count as received. `paymentPlan()` sums them and
works out what's still owed, which is what makes reopening a menu safe: money
already confirmed stays credited even when the total changes.

---

## The lifecycle

Six stages, all **derived** by `stage(booking)` — never stored.

```
  hold ──► building ──► menuIn ──► menuPaid ──► set ──► done
    │          │           │           │          │
    │          │           │           │          └─ markComplete()
    │          │           │           └─ confirmPayment(id,'menu')
    │          │           └─ claimPayment(id,'menu',amount)
    │          └─ submitMenu()  [locks the menu]
    └─ confirmPayment(id,'hold')
```

| Stage | Means | What Gino sees to do |
|---|---|---|
| `hold` | Booked; the 10% isn't confirmed | Confirm the holding deposit landed |
| `building` | Deposit in; they're choosing | Waiting on their menu |
| `menuIn` | Menu submitted and locked; 40% unpaid | Ask for the balance to 50% |
| `menuPaid` | They say they've paid | Confirm their payment landed |
| `set` | Paid to 50%, locked | Nothing — prep sheet, mark done |
| `done` | The night happened | Nothing |

`reopenMenu()` moves a booking backwards: it clears `menuLocked` and drops any
*unconfirmed* `menu` payment, so the stage falls back to `building`. Confirmed
payments are untouched.

### Invariants

These must always hold. Several are asserted in `test-flow.js`.

1. **One live booking per evening.** `isBookable()` refuses a date that already
   has a booking with `completed: false`.
2. **A locked menu rejects edits.** `saveMenu()` returns `null` rather than
   writing.
3. **Only `confirmed` payments count as received.**
4. **The log only ever grows.** No mutation deletes or edits an entry, including
   cancelling the booking it describes.
5. **`stage()` is total** — every booking maps to one of the six.

---

## Availability

A date is bookable when **all** of these hold:

```js
isReleased(monthKey(d))   // Gino opened that month
&& !isBlocked(d)          // and didn't close that evening
&& !bookingOn(d)          // and nobody has taken it
&& daysUntil(d) >= 0      // and it isn't in the past
```

There is no weekday rule. An unreleased month offers nothing at all.

---

## Ledger entry

Append-only. Written by `record()` in `store.js`, which every mutation calls.

```js
{
  seq: 29,                        // 1-based, contiguous
  at: '2026-08-04T11:50:21.000Z', // ISO instant
  kind: 'menu.submitted',
  ref: 'BY-0421',                 // booking id, or '' for calendar-level events
  summary: 'Rachel Tan submitted their menu — 7 chicken, 2 vegetable',
  data: { chicken: ['Liver', ...], total: '$1,108', ... },
  prev: '<hash of entry 28>',
  hash: '<sha256 of this entry>'
}
```

### The hash

`hash = sha256(JSON.stringify([seq, at, kind, ref, summary, data, prev]))`

Built by `canonical()` — one place, because field order is part of the hash.
**Changing `canonical()` invalidates every existing entry.** If a field must be
added, append it to the end of the array and accept that older entries verify
under the old shape, or re-anchor the chain deliberately.

The first entry's `prev` is 64 zeros.

### Event kinds

Defined in `EVENTS` in `ledger.js`. `keep: true` marks the ones that matter in a
dispute — they get an ember marker in the UI.

`booking.created` · `booking.cancelled` · `booking.completed` ·
`menu.submitted` · `menu.reopened` · `payment.claimed` · `payment.confirmed` ·
`date.closed` · `date.opened` · `month.released` · `month.closed` ·
`price.changed` · `item.toggled` · `log.started`

### What verification catches

`verifyChain()` returns `{ ok, checked, brokenAt, reason }`.

| Interference | Caught? |
|---|---|
| Editing a summary, a total, a skewer list | Yes |
| Back-dating an entry | Yes |
| Deleting an entry from the middle | Yes |
| Inserting an entry | Yes |
| Reordering entries | Yes |
| Editing an entry *and* recomputing its hash | Yes — the next entry's `prev` no longer matches |
| **Deleting the newest entries and stopping** | **No** — nothing after them disagrees |

That last row is why the mailed copies exist. It's asserted explicitly in
`test-ledger.js` rather than left implied.

---

## Menu item

Static data in `menu-data.js`, 54 items across five categories
(15 chicken · 7 vegetable · 8 makimono · 13 premium · 11 saké).

```js
{
  id: 'wagyu',
  cat: 'chicken' | 'vegetable' | 'makimono' | 'premium' | 'sake',
  en: 'Japan Wagyu Skewer',
  cn: '日本黑毛和牛',
  price: 25,        // null = included in the set; 'ask' = chef quotes on request
  unit: 'skewer' | 'pc' | 'order' | 'pax' | 'bottle' | 'box',
  min: 10,          // minimum order quantity
  rec: true,        // chef's pick
  flag: '🇯🇵',
  img: 'sashimi',   // only when the image is shared with another item
  active: false,    // set by the chef's menu manager; hides it from customers
  check: true       // transcription is uncertain — see open question 4
}
```

Three lookups, three jobs:

| | Returns |
|---|---|
| `inCat(cat)` | what customers pick from — active and not retired |
| `inCatAll(cat)` | what Gino manages — everything not retired |
| `retiredIn(cat)` | just the retired ones, for the footer he can restore from |
| `byId(id)` | **everything, retired included** |

That last row is load-bearing. A booking stores item *ids*, and `quote()` skips
an id it cannot resolve — so if `byId` ever stopped returning a retired item,
every bill that ordered it would silently get cheaper. See *Menu changes*.

---

## Menu changes

`MENU` in `menu-data.js` is the menu Gino was shipped and is never edited.
Everything he changes afterwards lives in `STORE.menu` and is re-projected onto
that array by `applyMenu()` on load:

```js
{
  edits:   { wagyu: { price: 28 }, comb: { active: false } },  // overrides on shipped items
  custom:  [ /* Menu items he added — same shape, plus noImg: true */ ],
  retired: ['king-prawn'],   // off both menus, still resolvable by byId
  deleted: ['squid']         // shipped items removed outright; gone from byId too
}
```

`applyMenu()` is idempotent: it rebuilds `MENU` from scratch each time, so
calling it twice is the same as calling it once.

### Removing splits two ways, and it isn't a choice

`removeMenuItem(id)` asks `itemInUse(id)` which bookings reference the item:

| Referenced by | What happens | Reversible with |
|---|---|---|
| nothing | **deleted** — off `byId`, into `deleted` or out of `custom` | `undoRemove(snapshot)` |
| any booking | **retired** — off both menus, still on `byId` | `restoreItem(id)` |

The rule exists because a hard delete would reprice a confirmed order. It is
asserted in `test-flow.js` (*"SO THE AGREED TOTAL IS UNCHANGED"*) rather than
left implied.

### New items have no photo

The 54 shipped items each have a cutout at `assets/img/{id}.webp`. Anything Gino
adds carries `noImg: true` and falls back to a drawn SVG skewer. `imgOf()` reads
`m.photo` first — that field is unused today and is the seam for real uploads.

Images live at `assets/img/{id}.webp` — 58 transparent cutouts extracted from
Gino's PDF, resolved through `asset()` so the bundler can rewrite one function
rather than pattern-match paths.

---

## Pricing

```
base           = sessionFee ($500) + chefServiceFee ($200)      = $700
extra hours    = (hours − 4) × $50
extra skewers  = types beyond 7 chicken / 2 veg,
                 each × max(10, pax) × extraSkewerPrice ($5)
add-ons        = Σ (qty × unit price)
─────────────────────────────────────────────────────────────
subtotal

hold           = 10% of $700 = $70            fixed, regardless of the total
byMenu         = 50% of subtotal              cumulative target when the menu locks
dueNow         = byMenu − confirmed − claimed
balance        = subtotal − byMenu            settled on the night
```

Items priced `'ask'` (Comb, Bafun Uni) are **excluded from the subtotal** and
surfaced separately as `askItems` for Gino to quote.

Worked example — 9 chicken, 3 vegetable, 12 guests, 5 hours:

```
700 base + 50 extra hour + (2 extra chicken × 12 × 5) + (1 extra veg × 12 × 5)
= 700 + 50 + 120 + 60 = $930
hold $70 · due on menu lock $395 · on the night $465
```
