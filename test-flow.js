/* The booking lifecycle: taking a date, choosing a menu, and paying to 50%. */
let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
};

resetStore();
const seeded = bookings().length;
t('seeds sample bookings', seeded > 0, true);

// ── availability is months Gino has released, minus days he closed ──
const thisMonth = monthKey(addDays(0));
t('the current month is released', isReleased(thisMonth), true);
const far = iso(addDays(200));
t('a month he has not released is not bookable', isBookable(far), false);
toggleMonth(monthKey(far));
t('releasing the month opens it', isBookable(far), true);
toggleBlocked(far);
t('closing that single evening shuts it again', isBookable(far), false);
toggleBlocked(far);
t('reopening the evening restores it', isBookable(far), true);
t('a past date is never bookable', isBookable(iso(addDays(-1))), false);

// ── a customer takes a date; Gino does not approve it ──
const day = iso(addDays(40));
toggleMonth(monthKey(day));
if (!isBookable(day)) toggleBlocked(day);
const b = createBooking({ date:day, time:'19:00', pax:12, hours:5,
                          name:'Test Customer', phone:'+65 8000 0001', addr:'Somewhere' });
t('the date is taken immediately', isBookable(day), false);
t('stage is holding', stage(b), 'hold');
t('a holding deposit is claimed on booking', paymentPlan(b).pending, 70);
t('nothing is confirmed yet', paymentPlan(b).paid, 0);
t('it needs Gino to confirm the money', actionable().some(x => x.id === b.id), true);

// ── the menu is open straight away, no waiting ──
t('the menu is not locked', bookingById(b.id).menuLocked, false);
saveMenu(b.id, { chicken:['liver','heart','skin','tail','thigh','wing','neck'],
                 veg:['asparagus','shishito'], addons:{ wagyu:10 } });
t('menu saves', bookingById(b.id).chicken.length, 7);

confirmPayment(b.id, 'hold');
t('confirming the deposit moves it to choosing', stage(bookingById(b.id)), 'building');
t('the deposit is now credited', paymentPlan(bookingById(b.id)).paid, 70);

// ── extra skewer types ──
saveMenu(b.id, { chicken:['liver','heart','skin','tail','thigh','wing','neck','fillet'] });
const withExtra = bookingById(b.id);
t('eight chicken types are allowed', validate({ ...withExtra, pax:12 }).ok, true);
t('the extra type is billed at 12 x $5', paymentPlan(withExtra).subtotal, 700 + 50 + 250 + 60);

// ── submitting locks it ──
submitMenu(b.id);
t('submitting locks the menu', bookingById(b.id).menuLocked, true);
t('stage is menu-in', stage(bookingById(b.id)), 'menuIn');
t('a locked menu rejects further edits', saveMenu(b.id, { veg:['zucchini'] }), null);
t('the choices are untouched', bookingById(b.id).veg, ['asparagus','shishito']);

// ── paying the balance to 50% ──
const plan = paymentPlan(bookingById(b.id));
t('due now brings the total paid to half', round2(plan.paid + plan.dueNow), plan.byMenu);
claimPayment(b.id, 'menu', plan.dueNow);
t('claiming moves it to awaiting confirmation', stage(bookingById(b.id)), 'menuPaid');
t('still not counted as received', paymentPlan(bookingById(b.id)).paid, 70);
confirmPayment(b.id, 'menu');
t('confirming settles it', stage(bookingById(b.id)), 'set');
t('half the bill is now in', paymentPlan(bookingById(b.id)).paid, plan.byMenu);
t('the other half is left for the night', paymentPlan(bookingById(b.id)).balance, plan.byMenu);
t('nothing more is due', paymentPlan(bookingById(b.id)).dueNow, 0);
t('it no longer needs action', actionable().some(x => x.id === b.id), false);

// ── Gino reopens a locked menu ──
reopenMenu(b.id);
t('reopening unlocks it', bookingById(b.id).menuLocked, false);
t('money already confirmed stays credited', paymentPlan(bookingById(b.id)).paid, plan.byMenu);
saveMenu(b.id, { addons:{ wagyu:10, 'lamb-rack':10 } });
const after = paymentPlan(bookingById(b.id));
t('a bigger menu creates a new shortfall', after.dueNow > 0, true);
t('the shortfall is exactly the new half minus what is paid',
  after.dueNow, round2(after.byMenu - after.paid));

// ── completion ──
markComplete(b.id);
t('completing frees the record from upcoming', upcoming().some(x => x.id === b.id), false);
t('and the evening opens up again', isBookable(day), true);

// ── persistence ──
const before = JSON.stringify(bookings());
saveStore();
t('store round-trips through localStorage',
  JSON.stringify(JSON.parse(localStorage.getItem(STORE_KEY)).bookings), before);

// ── a store from an older shape must be refused, not loaded ──
t('rejects a pre-refactor record', isUsableStore({ seq:1, blocked:[], bookings:[
  { id:'X', date:'2026-01-01', status:'menu', chicken:[], veg:[], addons:{} }] }), false);
const MENU_SLICE = { edits:{}, custom:[], retired:[], deleted:[] };
t('rejects a booking with no payment records', isUsableStore({ seq:1, blocked:[], releasedMonths:[], log:[],
  menu:MENU_SLICE, bookings:[{ id:'X', date:'2026-01-01', chicken:[], veg:[], addons:{} }] }), false);
t('rejects a missing releasedMonths', isUsableStore({ seq:1, blocked:[], log:[], menu:MENU_SLICE, bookings:[] }), false);
t('accepts what seedStore produces', isUsableStore(seedStore()), true);
t('accepts an empty but well-formed store',
  isUsableStore({ seq:0, blocked:[], releasedMonths:[], log:[], menu:MENU_SLICE, bookings:[] }), true);
t('rejects a store with no record log',
  isUsableStore({ seq:0, blocked:[], releasedMonths:[], menu:MENU_SLICE, bookings:[] }), false);
t('rejects a store predating the menu manager',
  isUsableStore({ seq:0, blocked:[], releasedMonths:[], log:[], bookings:[] }), false);

// ── invariants ──
resetStore();
const live = bookings().filter(x => !x.completed).map(x => x.date);
t('no double-booked evening', new Set(live).size, live.length);
t('every seeded booking has payment records',
  bookings().every(x => Array.isArray(x.payments) && x.payments.length > 0), true);
t('seeded stages are all recognised',
  bookings().every(x => !!STATUSES[stage(x)]), true);
t('reset restores the sample data', bookings().length, seeded);

// ── every action leaves a record ──
resetStore();
const kinds = () => ledger().map(e => e.kind);
const n0 = ledger().length;
t('seeded bookings come with a history', n0 > 20, true);
t('the seeded chain verifies', chainState().ok, true);

const day2 = iso(addDays(45));
toggleMonth(monthKey(day2));
t('releasing a month is recorded', kinds().at(-1), 'month.released');

const nb = createBooking({ date:day2, pax:12, hours:4, name:'Recorded Customer',
                           phone:'+65 8000 0009', addr:'Anywhere' });
t('booking is recorded', kinds().at(-1), 'booking.created');
t('the record names the customer', ledger().at(-1).summary.includes('Recorded Customer'), true);
t('the record captures the guest count', ledger().at(-1).data.guests, 12);

confirmPayment(nb.id, 'hold');
t('confirming a payment is recorded', kinds().at(-1), 'payment.confirmed');

saveMenu(nb.id, { chicken:['liver','heart','skin','tail','thigh','wing','neck'], veg:['asparagus','shishito'] });
t('browsing the menu is deliberately NOT recorded', kinds().at(-1), 'payment.confirmed');

submitMenu(nb.id);
t('submitting the menu is recorded', kinds().at(-1), 'menu.submitted');
const snap = ledger().at(-1);
t('the record lists the actual skewers', snap.data.chicken.includes('Liver'), true);
t('by readable name, not id', snap.data.chicken.includes('liver'), false);
t('and captures the total at that moment', snap.data.total, money(quote(bookingById(nb.id)).subtotal));

reopenMenu(nb.id);
t('reopening is recorded', kinds().at(-1), 'menu.reopened');
t('with what the menu had been', ledger().at(-1).data.wasChicken.includes('Liver'), true);

markComplete(nb.id);
t('completion is recorded', kinds().at(-1), 'booking.completed');

t('the chain still verifies after all of that', chainState().ok, true);
t('exactly six actions produced exactly six entries', ledger().length - n0, 6);
t('and they are the six expected ones', kinds().slice(n0),
  ['month.released','booking.created','payment.confirmed','menu.submitted','menu.reopened','booking.completed']);
t('entries only ever appended', ledger().every((e, i) => e.seq === i + 1), true);

// cancelling removes the booking but must NOT remove its history
const histBefore = logFor(nb.id).length;
declineBooking(nb.id);
t('a cancelled booking is gone from the list', bookingById(nb.id), undefined);
t('but its history survives', logFor(nb.id).length, histBefore + 1);
t('and the cancellation itself is recorded', kinds().at(-1), 'booking.cancelled');
t('the chain survives a cancellation', chainState().ok, true);

// ── the menu manager ────────────────────────────────────
// Gino edits the menu; the shipped MENU array is never what gets edited.
resetStore();

t('a price edit survives being written and read back',
  (setItemPrice('wagyu', 28), JSON.parse(localStorage.getItem(STORE_KEY)).menu.edits.wagyu.price), 28);
t('and the live item shows it', byId('wagyu').price, 28);
t('a price edit is recorded', kinds().at(-1), 'price.changed');
t('an item in the set has no price to change', setItemPrice('liver', 4), null);
t('nor does one quoted on request', setItemPrice('uni', 90), null);
t('re-entering the same price records nothing', setItemPrice('wagyu', 28), null);

toggleItem('kinki');
t('switching an item off hides it from customers', inCat('premium').some(m => m.id === 'kinki'), false);
t('but Gino still sees it', inCatAll('premium').some(m => m.id === 'kinki'), true);
t('the toggle is recorded', kinds().at(-1), 'item.toggled');
toggleItem('kinki');
t('and switching it back on restores it', inCat('premium').some(m => m.id === 'kinki'), true);

// adding
const vegBefore = inCatAll('vegetable').length;
const okra = addMenuItem({ cat:'vegetable', en:'Okra', cn:'秋葵', price:null });
t('a new item gets a readable id', okra.id, 'okra');
t('it lands in its category', inCatAll('vegetable').length, vegBefore + 1);
t('customers see it immediately', inCat('vegetable').some(m => m.id === 'okra'), true);
t('it has no photo of its own', okra.noImg, true);
t('and it falls back to the drawn placeholder', imgOf(okra).startsWith('data:image/svg+xml'), true);
t('adding is recorded', kinds().at(-1), 'item.added');

const dup = addMenuItem({ cat:'vegetable', en:'Okra', cn:'秋葵', price:null });
t('a duplicate name never reuses an id', dup.id, 'okra-2');

const gyoza = addMenuItem({ cat:'premium', en:'Grilled Gyoza', cn:'烤饺子', price:9, unit:'pc', min:6 });
t('a priced addition quotes at its price',
  quote({ pax:10, hours:4, chicken:[], veg:[], addons:{ [gyoza.id]:6 } }).subtotal, 700 + 54);
t('and enforces its own minimum',
  validate({ pax:10, chicken:SET7, veg:['asparagus','shiitake'], addons:{ [gyoza.id]:5 } }).ok, false);

// removing something nobody has ordered
t('an unused item is in use nowhere', itemInUse(gyoza.id).length, 0);
t('so removing it removes it', removeMenuItem(gyoza.id).action, 'removed');
t('it is gone from the chef list too', inCatAll('premium').some(m => m.id === gyoza.id), false);
t('and gone from byId', byId(gyoza.id), undefined);
t('removal is recorded', kinds().at(-1), 'item.removed');
t('a shipped item can be deleted the same way', removeMenuItem('squid').action, 'removed');
t('and stays deleted across a reload',
  JSON.parse(localStorage.getItem(STORE_KEY)).menu.deleted.includes('squid'), true);

// removing something a booking depends on — the case that must not reprice
const daniel = bookings().find(b => b.addons['king-prawn']);
const wasTotal = quote(daniel).subtotal;
const wasPrep  = prepSheet(daniel).length;
t('the item is in use', itemInUse('king-prawn').map(b => b.id), [daniel.id]);
const out = removeMenuItem('king-prawn');
t('so it is retired, not removed', out.action, 'retired');
t('it names the bookings it was kept for', out.bookings.map(b => b.id), [daniel.id]);
t('customers no longer see it', inCat('premium').some(m => m.id === 'king-prawn'), false);
t('Gino no longer sees it either', inCatAll('premium').some(m => m.id === 'king-prawn'), false);
t('but byId still resolves it', byId('king-prawn').en, 'King Prawn in Pork Belly & Shiso');
t('SO THE AGREED TOTAL IS UNCHANGED', quote(daniel).subtotal, wasTotal);
t('and the prep sheet still lists it', prepSheet(daniel).length, wasPrep);
t('retiring is recorded', kinds().at(-1), 'item.retired');
t('it shows in the retired list for its category', retiredIn('premium').map(m => m.id), ['king-prawn']);

restoreItem('king-prawn');
t('restoring puts it back for customers', inCat('premium').some(m => m.id === 'king-prawn'), true);
t('and the total still has not moved', quote(daniel).subtotal, wasTotal);
t('restoring is recorded', kinds().at(-1), 'item.restored');

// undo, for the moment right after a delete
const snapCustom = addMenuItem({ cat:'vegetable', en:'Lotus Root', cn:'蓮根', price:null });
const cRemoved = removeMenuItem(snapCustom.id);
t('a custom item deletes cleanly', byId(snapCustom.id), undefined);
undoRemove(cRemoved.item);
t('undo brings a custom item back', byId(snapCustom.id).en, 'Lotus Root');
const sRemoved = removeMenuItem('sting-ray');
t('a shipped item deletes cleanly', byId('sting-ray'), undefined);
undoRemove(sRemoved.item);
t('undo brings a shipped item back', byId('sting-ray').price, 20);
t('undo will not double-add', undoRemove(sRemoved.item), null);
t('undo is recorded', kinds().at(-1), 'item.restored');

t('the chain verifies after every menu change', chainState().ok, true);

// the projection is a projection, not a mutation
const projected = MENU.length;
t('reapplying twice changes nothing', (applyMenu(), applyMenu(), MENU.length), projected);
resetStore();
t('a reset returns the shipped menu', byId('wagyu').price, 25);
t('and drops what Gino added', byId('okra'), undefined);
t('and undeletes what he deleted', byId('squid').en, 'Charcoal Grilled Squid Ika Ichiyaboshi');

console.log(`\n${pass} passed, ${fail} failed`);
__done(fail);
