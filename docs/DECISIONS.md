# Decisions

Why the design is the way it is. Most of what follows was a deliberate call with
an alternative that was considered and rejected — which is exactly the part you
can't recover by reading the code. Read this before changing anything
structural.

Decisions the project owner made are marked **[owner]**. The rest were
engineering calls made in the course of building, and are open to revision.

---

## Product shape

### The site does the whole job, not just lead capture **[owner]**

Four options were on the table: a menu showcase with a WhatsApp button, a smart
enquiry form, book-online-then-confirm, or full self-serve. Full self-serve was
chosen — the site takes the booking, the menu and the money.

### Booking and menu are two separate steps **[owner]**

Not one long form. This mirrors how Gino already works: date first, menu after.
It also means someone can secure a date in a minute and agonise over skewers
later, which is how people actually behave.

### The date is taken the moment someone books **[owner]**

Gino does not approve or decline dates. Originally he confirmed each request;
that was removed because it put him back in the loop for something a calendar
can decide. He now controls availability *in advance* by releasing months and
closing evenings, rather than adjudicating requests one by one.

The trade-off is a real one and currently unresolved — see *A held date is never
released* in `HANDOFF.md`.

### Availability is released month by month **[owner]**

There is no fixed Tue–Sat rule any more. Gino opens a month, then closes
individual evenings inside it. This matches how he thinks about his own
diary — "I'll take bookings for October now" — rather than forcing a recurring
weekly pattern he'd constantly have to override.

Consequence: an unreleased month shows nothing at all to customers. If bookings
dry up, the first thing to check is whether he's released the next month.

### Payment is manual, in three steps **[owner]**

10% of the minimum to hold the date, 40% more when the menu locks (bringing the
total to 50%), and the last 50% settled with Gino on the night.

A conflict was flagged during this decision and is worth remembering: "holding a
date without Gino confirming" implies the *payment* verifies itself, which needs
a real gateway. The owner chose to keep payment manual anyway. These coexist
because the thing removed was **date approval**, not payment reconciliation —
Gino never says yes to a date, but he does tick off money when it lands.

If that ever feels like too much manual work, the fix is a gateway (HitPay is
the natural Singapore choice, since it handles PayNow properly), not re-adding
an approval step.

### Extra skewer types are billed like any other add-on **[owner]**

The set includes 7 chicken and 2 vegetable. More of either is allowed, charged
per skewer with a minimum of 10 — the same shape as the makimono and premium
add-ons, so there is one pricing idea to understand rather than two.

Quantity is **not** separately editable for extras: an extra type is served to
every guest, so the quantity is `max(10, guests)`. This keeps the selection UI
free of steppers and matches how the included set already works.

### Submitting the menu locks it **[owner]**

The customer cannot change it afterwards; they message Gino and he reopens it.
This is friction on purpose — it gives him a fixed thing to shop against, and it
puts a deliberate pause before a change that moves money.

When he reopens, **confirmed payments stay credited.** Only the shortfall is
re-collected. Nobody loses money by changing their mind.

### The prep sheet

Not requested. Added because Gino shops for these events himself, and a list
grouped by chicken / vegetable / makimono / premium / saké with quantities is
the single most useful thing the data can produce. It's printable.

---

## Records and integrity

### An append-only chain, not just emails **[owner proposed emails]**

The owner proposed emailing every transaction to a dedicated inbox as an
"almost immutable" record. That was built — and something underneath it, because
**email alone doesn't deliver the property being asked for.** Whoever owns a
mailbox can delete from it.

So: the primary record is an append-only log where each entry carries the
SHA-256 hash of the entry before it. Altering any past entry breaks every hash
after it, and the dashboard names the first entry that fails. The mailed copy is
the *backup* — its value is independence (a copy outside the application), not
permanence.

Nine tamper scenarios are exercised in `test-ledger.js`. Eight are caught:
edits to a summary, a total or a skewer list; back-dating; deletion from the
middle; insertion; reordering; and editing an entry then recomputing its hash to
cover the tracks. The ninth is proven *un*detectable — truncating the newest
entries breaks nothing, because there is nothing after them to disagree. That is
precisely the gap the mailbox copy fills, and it is asserted rather than left
implied.

### SHA-256 is implemented in the repo

No dependency, and synchronous — which matters because appending must not be
able to half-finish. `crypto.subtle` is async; Node's `crypto` isn't available
in the browser. It is verified against the NIST vectors *and* fuzzed against
Node's own implementation across unicode, emoji and block-boundary lengths. An
unverified hash would make the entire guarantee worthless.

### Browsing the menu is deliberately not logged

Only the snapshot at submit. Logging every tap would bury the entries that
matter in noise, and the thing that settles a dispute is what was *submitted*,
not what was hovered over.

### Cancelling a booking keeps its history

The booking leaves the list; its records stay. A record you can delete by
cancelling the thing it describes isn't a record.

---

## Engineering

### Status is derived, never stored

A booking's stage is computed from its payment records and lock flag by
`stage()`. There is no `status` field. Storing it would let the badge disagree
with the money — the classic bug where something says "Paid" because a flag was
set while the payment records say otherwise.

**Do not add a status column.** If a new stage is needed, express it in
`stage()`.

### Payments are individual records, not booleans

`payments: [{ kind, amount, claimed, confirmed }]`. An earlier version used a
`depositClaimed` boolean and it could not answer "how much has actually been
received?" — which is exactly what's needed when a reopened menu changes the
total. The array makes reopening safe.

### `pricing.js` and `ledger.js` are pure

No DOM, no framework, no storage. They are the two modules that move to the
server unchanged when there is one. Everything the customer sees is computed by
the same code the server will use — the browser's number is displayed, the
server's number gets charged.

Keep them pure. If either starts importing from `store.js`, that boundary is
gone. (`ledger.js` briefly did, for a date formatter; it now carries its own.)

### `store.js` is the only file that touches persistence

Every mutation goes through a function there, and every one of those calls
`record()`. Nothing writes to the log directly and nothing writes around it.
That's what makes "every action leaves a record" checkable rather than hopeful.

### The store's key is versioned, and its shape is validated

`STORE_KEY = 'bincotan.store.v3'`. Changing a record shape without bumping this
once produced a completely blank page for every returning visitor. On top of
that, `isUsableStore()` refuses anything missing a field the code depends on,
so a future mistake degrades to a re-seed rather than a crash.

**Bump the key whenever a record shape changes.**

### `render()` can't leave a blank page

It's wrapped. A throw shows what broke and offers a reset. A prototype gets
clicked at from odd angles and an unexplained empty screen is the worst possible
failure mode — it looks like the link is dead.

### No build step, no framework

Plain HTML, CSS and JavaScript, hash-routed. The point of this phase is to look
at screens and argue about flows; a toolchain would add setup cost and nothing
else. `build-artifact.py` inlines everything into one shareable file when needed.

This stops being the right call the moment there's a server — at which point
these screens become Next.js routes, and the pure modules come along unchanged.

---

## Design

### Charcoal & Ember **[owner]**

Chosen from three options against a brief of "looks good". Near-black grounds,
ember-orange accent, a serif display face with brush-stroke Japanese as accent.

It earns its keep: all 58 product photos came out of Gino's PDF as **transparent
cutouts**, and cutouts on near-black look like a lit counter at night. On a pale
background they'd look like clip art. The palette follows the photography, not
the other way round.

### Deliberately single-theme

No light mode. The subject is a charcoal grill after dark. Every colour is
defined on bare `:root` and `body` paints an explicit background, so the page
holds on any host background rather than borrowing one.

### The chef's side is a tool, not a page

Its own compact header, denser type, status encoded as colour and shape, summary
before detail. It's built phone-first because a solo chef checks it between
jobs, not at a desk.

### Product photography came from the PDF

`pdftoppm`/PyMuPDF extraction with the soft masks preserved. Each image was
matched to its caption by comparing bounding boxes, then verified by eye against
the rendered pages. That's why the menu data is trustworthy: it wasn't
transcribed by hand, and it was checked.

---

## Things considered and rejected

| Idea | Why not |
|---|---|
| Automated payment gateway | Owner chose manual PayNow. Revisit if reconciliation becomes a chore |
| Customer accounts | Nothing to log in for. The private link is the credential |
| WhatsApp Business API | Needs a Meta business account, template approval and a paid provider. `wa.me` links with pre-written messages get most of the value for none of the setup |
| Storing a `status` field | Lets the badge disagree with the money |
| Logging every menu tap | Buries the entries that matter |
| A separate calendar page | Merged into Bookings at the owner's request — one screen, one mental model |
| Capping the menu at exactly 7+2 | Owner wanted extras; the cap is gone |
