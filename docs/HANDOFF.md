# Handoff

Where this project stands, what to do next, and what still needs an answer.
Written to be read cold, months later, by someone who wasn't here.

---

## What this is

A booking and menu-ordering site for **Gino**, a private yakitori chef in
Singapore who works alone. He currently takes bookings by WhatsApp, then sends a
PDF menu and collects choices by message. This replaces that back-and-forth.

**Live:** https://githubchun.github.io/bincotan-yakitori/
**Source:** https://github.com/githubchun/bincotan-yakitori

It is a **working design prototype**: real menu data, real pricing logic, real
flows on both sides. There is no server — everything lives in one `localStorage`
record, so the customer side and the chef side only see each other in the same
browser.

Nothing has been shown to Gino yet as of the last session. It was built for the
project owner to review first.

---

## State of play

| Area | Status |
|---|---|
| Customer flow — browse, book, build menu, pay | Complete and walkable |
| Chef flow — bookings, calendar, menu, settings, records | Complete and walkable |
| Menu manager — reprice, hide, add, remove | Complete, persisted and recorded |
| Pricing and payment schedule | Complete, 43 assertions |
| Transaction record + tamper detection | Complete, 34 assertions incl. 9 tamper scenarios |
| Booking lifecycle + menu manager | Complete, 121 assertions |
| Documentation checked against the code | 36 assertions |
| Responsive down to 360px | Verified across every route |
| Backend, auth, mail delivery, real payments | **Not started** |
| Shown to Gino | **Not yet** |

**234 assertions pass**, plus four browser harnesses. `./run-tests.sh` runs the
unit suites; the browser harnesses need the site served (see README).

---

## The single most important thing to know

**Everything is in `localStorage` under one key.** There is no server. This has
three consequences that shape any next step:

1. Two devices never see each other's data. Demoing to Gino means one screen, or
   he gets his own independent copy.
2. Clearing browser data wipes everything, including the transaction record.
3. The record's tamper-evidence is real but local — anyone with devtools can
   edit the store; the point is that the chain *detects* it, not that it
   prevents it. Real durability needs the server.

The code is arranged so this is a contained change: `pricing.js` and `ledger.js`
are pure and move to the server unchanged, and `store.js` is the only file that
touches persistence.

---

## What to do next, in order

### 1. Show Gino (no code needed)

Nothing has been validated with the person who will use it. Before building
more, walk him through it and get answers to the open questions below. Several
of them could change the shape of the work.

### 2. Answer the open questions

See the table below. Two of them — the extra-skewer price and the unpaid-hold
policy — affect money, so they should be settled before anything goes live.

### 3. Build the backend

The prototype's shape is deliberately close to what the real thing needs:

- **Postgres** — tables mirror the record shapes in `docs/DATA-MODEL.md`.
- **Auth** — Gino only. Magic link. The customer never signs in; their private
  link is the credential, so those tokens must become unguessable (currently
  the booking id, which is sequential and therefore trivially enumerable —
  see *Known gaps*).
- **Mail delivery** — the transaction record is written to expect this.
  `emailFor()` already renders the exact message; it needs a transactional
  sender (Resend, Postmark) and a real destination mailbox.
- **Server-side pricing** — `pricing.js` moves across unchanged. The browser
  keeps using it for the live estimate; the server's number is the one charged.

### 4. Let Gino upload item photos

He can add menu items, but not a picture of one — a new item shows a drawn
placeholder while the 54 shipped ones have real cutouts. The seam is already
in: `imgOf()` returns `m.photo` if it is set, so an upload only has to write
that field.

What it needs is somewhere to put the file. Base64 in `localStorage` is not it
— the quota is about 5MB and a handful of photos would fill it and take the
whole store down with it. This wants object storage, which means it waits for
the backend in step 3.

### 5. Replace the placeholders

Everything below is invented and marked in the UI with a dotted gold underline.
All of it lives in `SETTINGS` in `assets/js/menu-data.js`.

| Placeholder | Current value |
|---|---|
| PayNow UEN | `T00XXXXXXX` |
| PayNow account name | `BINCOTAN YAKITORI (PLACEHOLDER)` |
| WhatsApp number | `+65 8000 0000` |
| Notification address | user `hello` at `placeholder.invalid` |
| Records inbox | user `records` at `placeholder.invalid` |
| Extra skewer price | `$5` — a guess, see open questions |
| Domain | none; runs on the github.io path |

**Never commit the real PayNow details.** Once there's a server they belong in
environment variables. The repo is public.

---

## Open questions

Ordered by how much they'd change the work.

| # | Question | Why it matters | Current assumption |
|---|---|---|---|
| 1 | What should an extra skewer type cost? | Nothing in Gino's PDF covers it. Every quote with more than 7+2 depends on it. | $5/skewer, min 10, editable in Settings |
| 2 | What happens to a held date nobody pays for? | A date is taken the instant someone books, before any money is verified. Someone can hold next Saturday and vanish. | Nothing — it stays held. See *Known gaps* |
| 3 | Should the records also go to the customer? | Both parties holding identical evidence is far stronger in a dispute than only Gino holding it. | Chef only |
| 4 | Is the $100 saké the Kuheiji or the Masumi? | Gino's PDF contradicts itself. Flagged `check: true` in the data. | Transcribed as Kuheiji (2 of 3 fields agree) |
| 5 | Does he want a real domain? | Affects nothing technically; changes how it reads to customers. | github.io path |
| 6 | Should the public menu show add-on prices? | Currently yes. He reveals pricing after confirming today. | Prices shown publicly |
| 7 | Travel charges by area? | Confirmed Singapore-wide flat in an earlier session, but worth re-checking with him. | Flat, no travel charge |

---

## Known gaps

Things that are wrong or missing and are *known* to be — not oversights.

**A menu item Gino adds has no photo.** It falls back to a drawn skewer. See
step 4 above — the fix needs somewhere to store an uploaded file.

**A held date is never released.** Booking takes the evening immediately and the
holding deposit is confirmed by hand afterwards. If it never arrives, the date
stays blocked and only Gino noticing will free it. The obvious fix is to
auto-release a hold whose deposit isn't confirmed within some window (48 hours?),
which needs question 2 answered and a server to run the timer.

**Private links are guessable.** `#/order/BY-0434` — the ids are sequential, so
anyone can walk them and read another customer's booking, menu and phone number.
Harmless in a prototype with invented data; **must be fixed before real customer
data goes in.** Replace the id in the URL with a long random token.

**The record detects alteration, not truncation.** Editing, deleting or
reordering any entry is caught. Removing the *newest* entries and stopping is
not, because nothing after them disagrees. `test-ledger.js` asserts this
explicitly. The mailed copies are what close the gap.

**A mailbox copy is not immutable.** Whoever owns the mailbox can delete a
message. Its value is independence — a copy outside the application — not
permanence. Consider auto-forwarding to a second address Gino doesn't administer.

**Settings doesn't save.** The screen shows what he'd control; the fields are
inert.

**The PayNow QR is drawn, not real.** It's a deliberate placeholder, clearly
marked `DEMO`. A real one encodes the SGQR payload.

**No accessibility audit.** Focus states, keyboard selection and reduced-motion
are handled, but nothing has been tested with a screen reader.

---

## Traps that already caught us once

Recorded so they don't cost a second afternoon.

**Changing the store's shape without bumping the key.** A returning visitor
loaded a record the new code couldn't read, `isReleased()` threw mid-render, and
the page painted *nothing*. Every test passed because they all started from a
clean or reset store. `STORE_KEY` is now versioned, `isUsableStore()` validates
the shape, and `render()` shows a recovery screen instead of a blank page.
`stale.html` reproduces it. **Bump `STORE_KEY` whenever a record shape changes.**

**`toISOString()` for calendar dates.** It converts to UTC, so in Singapore
(UTC+8) local midnight serialises as the *previous* day. Every booking was off
by one. Use the local formatter in `store.js`; never the UTC serialiser.

**`grid-template-columns: 1fr` on a track that must shrink.** `1fr` means
`minmax(auto, 1fr)`, and `auto` is min-content — so one `white-space: nowrap`
child props the whole column open and the page scrolls sideways on a phone.
Use `minmax(0, 1fr)`. `probe-widths.html` catches it.

**Base CSS placed after its own media query.** The desktop rule won by source
order and the mobile nav was stuck open. Base first, overrides after.

**Headless Chrome clamps the window to 500px wide.** "Mobile" screenshots are a
500px layout cropped, not a real narrow viewport. Measure in an iframe instead —
that's what `probe-widths.html` does.

**Cached DOM nodes after a re-render.** `render()` replaces `#app`, so any node
captured before a click is detached and clicking it silently does nothing. In
test harnesses, re-query immediately before each interaction.

**`scroll-behavior: smooth` never advances under virtual time.** A programmatic
scroll reads back as 0 in headless, which made a scroll assertion pass
vacuously. Set `scrollBehavior = 'auto'` in the harness first.

---

## How to verify you haven't broken anything

```sh
./run-tests.sh                 # 183 assertions, no browser needed
python3 -m http.server 8811    # then open each harness below
```

| Harness | What it proves |
|---|---|
| `e2e.html` | 28 steps: book → build → submit → pay → confirm → reopen, both sides |
| `tamper.html` | The dashboard catches an edited or deleted record |
| `stale.html` | Recovery from an out-of-date or corrupt saved store |
| `probe-widths.html` | No route scrolls sideways at 360 / 390 / 768px |

Each prints its own pass/fail. Green means green.

---

## Where things live

See `README.md` for the file layout and `docs/DATA-MODEL.md` for record shapes
and invariants. `docs/DECISIONS.md` explains why the design is the way it is —
read that before changing anything structural, because most of it was a
deliberate call rather than an accident.
