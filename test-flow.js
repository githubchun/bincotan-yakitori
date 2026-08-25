/* The booking lifecycle: a customer's request becoming a paid, menu'd event. */
let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
};

resetStore();
const seeded = bookings().length;
t('seeds sample bookings', seeded > 0, true);

// ── a customer requests a date ──
const day = serviceDay(60);
const b = createBooking({ date:day, time:'19:00', pax:12, hours:5,
                          name:'Test Customer', phone:'+65 8000 0001', addr:'Somewhere' });
t('new booking starts as a request', b.status, 'req');
t('booking is appended to the store', bookings().length, seeded + 1);
t('id is sequential and padded', /^BY-\d{4}$/.test(b.id), true);
t('starts with an empty menu', [b.chicken.length, b.veg.length, Object.keys(b.addons).length], [0,0,0]);
t('shows up in the chef inbox', actionable().some(x => x.id === b.id), true);
t('its date is now unavailable to others', unavailableDates().has(day), true);

// ── the private link should not open before Gino confirms ──
t('menu cannot be submitted while pending', submitMenu(b.id).status, 'req');

// ── Gino confirms ──
setStatus(b.id, 'conf');
t('confirmed', bookingById(b.id).status, 'conf');
t('private link points at the booking', orderPath(b.id), `#/order/${b.id}`);

// ── the customer builds their menu ──
saveMenu(b.id, { chicken:['liver','heart','skin','tail','thigh','wing','neck'],
                 veg:['asparagus','shishito'], addons:{ wagyu:10 } });
const built = bookingById(b.id);
t('menu is saved to the booking', [built.chicken.length, built.veg.length], [7,2]);
t('selection validates', validate({ ...built, pax:built.pax }).ok, true);
t('quote includes the extra hour and the add-on',
  quote({ hours:built.hours, addons:built.addons }).subtotal, 700 + 50 + 250);

submitMenu(b.id);
t('submitting moves it to menu-in', bookingById(b.id).status, 'menu');
t('chef sees it as needing action', actionable().some(x => x.id === b.id), true);

// ── deposit ──
t('deposit not claimed yet', bookingById(b.id).depositClaimed, false);
claimDeposit(b.id);
t('customer claims the deposit', bookingById(b.id).depositClaimed, true);
t('status stays menu-in until Gino confirms', bookingById(b.id).status, 'menu');
setStatus(b.id, 'paid');
t('Gino confirms receipt', bookingById(b.id).status, 'paid');
t('no longer needs action', actionable().some(x => x.id === b.id), false);
t('still upcoming', upcoming().some(x => x.id === b.id), true);

// ── persistence across a reload ──
const before = JSON.stringify(bookings());
saveStore();
t('store round-trips through localStorage',
  JSON.stringify(JSON.parse(localStorage.getItem('bincotan.store.v2')).bookings), before);

// ── declining removes it ──
const d = createBooking({ date:serviceDay(70), name:'Declined', phone:'x', addr:'y' });
const n = bookings().length;
declineBooking(d.id);
t('declining removes the booking', [bookings().length, bookingById(d.id)], [n - 1, undefined]);

// ── blocking a date ──
const blockDay = serviceDay(75);
t('open before blocking', unavailableDates().has(blockDay), false);
toggleBlocked(blockDay);
t('blocked after toggle', unavailableDates().has(blockDay), true);
toggleBlocked(blockDay);
t('unblocked after toggling back', unavailableDates().has(blockDay), false);

// ── two bookings can never share an evening ──
const dates = bookings().filter(x => x.status !== 'done').map(x => x.date);
t('no double-booked evening', new Set(dates).size, dates.length);

// ── reset restores the seed ──
resetStore();
t('reset restores the sample data', bookings().length, seeded);
t('reset clears the test booking', bookingById(b.id), undefined);

console.log(`\n${pass} passed, ${fail} failed`);
__done(fail);
