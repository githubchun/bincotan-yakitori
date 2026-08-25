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
t('rejects a booking with no payment records', isUsableStore({ seq:1, blocked:[], releasedMonths:[],
  bookings:[{ id:'X', date:'2026-01-01', chicken:[], veg:[], addons:{} }] }), false);
t('rejects a missing releasedMonths', isUsableStore({ seq:1, blocked:[], bookings:[] }), false);
t('accepts what seedStore produces', isUsableStore(seedStore()), true);
t('accepts an empty but well-formed store',
  isUsableStore({ seq:0, blocked:[], releasedMonths:[], bookings:[] }), true);

// ── invariants ──
resetStore();
const live = bookings().filter(x => !x.completed).map(x => x.date);
t('no double-booked evening', new Set(live).size, live.length);
t('every seeded booking has payment records',
  bookings().every(x => Array.isArray(x.payments) && x.payments.length > 0), true);
t('seeded stages are all recognised',
  bookings().every(x => !!STATUSES[stage(x)]), true);
t('reset restores the sample data', bookings().length, seeded);

console.log(`\n${pass} passed, ${fail} failed`);
__done(fail);
