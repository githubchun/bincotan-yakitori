/* Claims made in docs/ checked against the code, so the documentation can't
   quietly drift out of date. If one of these fails, either the code changed or
   the docs are now lying — fix whichever is wrong. */
let pass=0, fail=0;
const t=(n,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);ok?pass++:fail++;
  console.log(`${ok?'✓':'✗'} ${n}${ok?'':`  got ${JSON.stringify(g)} want ${JSON.stringify(w)}`}`);};

// claims made in DATA-MODEL.md
t('54 menu items  [DATA-MODEL.md]', MENU.length, 54);
t('15 chicken     [DATA-MODEL.md]', inCatAll('chicken').length, 15);
t('7 vegetable    [DATA-MODEL.md]', inCatAll('vegetable').length, 7);
t('8 makimono     [DATA-MODEL.md]', inCatAll('makimono').length, 8);
t('13 premium     [DATA-MODEL.md]', inCatAll('premium').length, 13);
t('11 saké        [DATA-MODEL.md]', inCatAll('sake').length, 11);
t('58 image files [DATA-MODEL.md]', __imageCount(), 58);
t('5 categories', Object.keys(CATS).length, 5);
t('minimum spend is $700', minimumSpend(), 700);
t('hold is $70', round2(SETTINGS.holdPct*minimumSpend()), 70);
t('STORE_KEY is v4', STORE_KEY, 'bincotan.store.v4');
t('genesis prev is 64 zeros', GENESIS, '0'.repeat(64));
t('18 event kinds', Object.keys(EVENTS).length, 18);

// the worked example in DATA-MODEL.md and DECISIONS.md
const ex = { hours:5, pax:12,
  chicken:['liver','heart','skin','tail','thigh','wing','neck','fillet','gizzard'],
  veg:['asparagus','shishito','zucchini'], addons:{}, payments:[] };
t('worked example subtotal is $930', quote(ex).subtotal, 930);
const p = paymentPlan(ex);
t('worked example: hold $70', p.hold, 70);
t('worked example: due on lock $395', round2(p.byMenu - p.hold), 395);
t('worked example: balance $465', p.balance, 465);

// invariants claimed in DATA-MODEL.md
resetStore();
t('stage() is total over seeded bookings', bookings().every(b=>!!STATUSES[stage(b)]), true);
t('no live booking shares an evening', (()=>{const d=bookings().filter(b=>!b.completed).map(b=>b.date);
  return new Set(d).size===d.length;})(), true);
t('no booking carries a status field', bookings().every(b=>b.status===undefined), true);
t('log seq is contiguous from 1', ledger().every((e,i)=>e.seq===i+1), true);
t('seeded chain verifies', chainState().ok, true);

// availability rule claimed in DATA-MODEL.md
const far = iso(addDays(300));
t('unreleased month is not bookable', isBookable(far), false);
toggleMonth(monthKey(far));
t('released month is bookable', isBookable(far), true);

// locked menu rejects edits (invariant 2)
const b0 = bookings().find(b=>b.menuLocked);
t('a locked menu rejects edits', saveMenu(b0.id,{veg:['zucchini']}), null);

// cancelling keeps history (invariant 4)
const nb = createBooking({date:far, pax:10, name:'Doc Check', phone:'x', addr:'y'});
const n1 = ledger().length;
declineBooking(nb.id);
t('cancelling appends rather than deletes', ledger().length, n1+1);
t('the cancelled booking keeps its history', logFor(nb.id).length >= 2, true);

// ordering matters (DATA-MODEL claim)
const a = quote({hours:4,pax:12,chicken:['liver','heart','skin','tail','thigh','wing','neck','fillet'],veg:['asparagus','shishito'],addons:{}});
const bq = quote({hours:4,pax:12,chicken:['fillet','liver','heart','skin','tail','thigh','wing','neck'],veg:['asparagus','shishito'],addons:{}});
t('same 8 types cost the same regardless of which is 8th', a.subtotal, bq.subtotal);
t('but 8 types cost more than 7', a.subtotal > quote({hours:4,pax:12,chicken:['liver','heart','skin','tail','thigh','wing','neck'],veg:['asparagus','shishito'],addons:{}}).subtotal, true);

// 'ask' items excluded (DATA-MODEL claim)
t("'ask' items are excluded from the subtotal", quote({hours:4,pax:12,chicken:[],veg:[],addons:{uni:1,comb:1}}).subtotal, 700);
t("and surfaced separately", quote({hours:4,pax:12,chicken:[],veg:[],addons:{uni:1}}).askItems.length, 1);

// counts quoted in README.md — these drift silently otherwise
t('9 tamper scenarios  [README.md]', __count('test-ledger.js', /^bad = clone\(\);|^let bad = clone\(\);/gm), 9);
t('50 e2e assertions   [README.md]', __count('e2e.html', /log\(/g) - 1, 50);
t('4 test suites       [README.md]', __count('run-tests.sh', /^sect /gm), 4);
t('6 scripts in index  [README.md]', __count('index.html', /script src/g), 6);
t('3 docs in docs/     [README.md]', __docCount(), 3);

console.log(`\n${pass} passed, ${fail} failed`);
__done(fail);
