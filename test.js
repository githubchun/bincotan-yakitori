let pass=0,fail=0;
const t=(name,got,want)=>{ const ok=JSON.stringify(got)===JSON.stringify(want);
  ok?pass++:fail++; console.log(`${ok?'✓':'✗'} ${name}${ok?'':`  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`); };

t('15 chicken', inCat('chicken').length, 15);
t('7 vegetable', inCat('vegetable').length, 7);
t('8 makimono', inCat('makimono').length, 8);
t('13 premium', inCat('premium').length, 13);
t('11 sake', inCat('sake').length, 11);
t('no duplicate ids', new Set(MENU.map(m=>m.id)).size, MENU.length);
t('every image file exists', MENU.filter(m=>!__exists(imgOf(m))).map(m=>m.id), []);

t('base only', quote({hours:4,addons:{}}).subtotal, 700);
t('holding deposit is 10% of the minimum', paymentPlan({hours:4,addons:{},payments:[]}).hold, 70);
t('two extra hours', quote({hours:6,addons:{}}).subtotal, 800);
t('hours below minimum clamp', quote({hours:2,addons:{}}).subtotal, 700);
t('wagyu x10', quote({hours:4,addons:{wagyu:10}}).subtotal, 950);
t('fractional price 12 x 6.5', quote({hours:4,addons:{'pb-shisho':12}}).subtotal, 778);
t('ask item excluded from total', quote({hours:4,addons:{uni:1}}).subtotal, 700);
t('ask item surfaced separately', quote({hours:4,addons:{uni:1}}).askItems.map(m=>m.id), ['uni']);
t('50%% target rounds to cents (771.50)', paymentPlan({hours:4,addons:{'iberico-belly':11},payments:[]}).byMenu, 385.75);

const good={chicken:['liver','heart','skin','tail','thigh','wing','neck'],veg:['asparagus','shishito'],pax:10,addons:{}};
t('valid order passes', validate(good).ok, true);
t('6 chicken fails', validate({...good,chicken:good.chicken.slice(0,6)}).ok, false);
t('a 3rd vegetable is allowed (billed as an extra)', validate({...good,veg:['asparagus','shishito','zucchini']}).ok, true);
t('fewer than 2 vegetables fails', validate({...good,veg:['asparagus']}).ok, false);
t('an 8th chicken is allowed', validate({...good,chicken:[...good.chicken,'fillet']}).ok, true);
t('9 pax fails', validate({...good,pax:9}).ok, false);
t('below min qty fails', validate({...good,addons:{wagyu:5}}).ok, false);
t('at min qty passes', validate({...good,addons:{wagyu:10}}).ok, true);
t('min-2 item at 2 passes', validate({...good,addons:{kinki:2}}).ok, true);
t('min-2 item at 1 fails', validate({...good,addons:{kinki:1}}).ok, false);

// ── extras beyond the included set ──
const eight={...good,chicken:[...good.chicken,'fillet'],pax:12};
t('one extra chicken type costs price x pax', quote(eight).subtotal, 700 + 5*12);
t('extra qty never dips below the minimum',
  quote({...good,chicken:[...good.chicken,'fillet'],pax:10}).subtotal, 700 + 5*10);
t('two extra types double it',
  quote({...good,chicken:[...good.chicken,'fillet','comb'],pax:12}).subtotal, 700 + 2*5*12);
t('extra vegetables bill the same way',
  quote({...good,veg:[...good.veg,'zucchini'],pax:12}).subtotal, 700 + 5*12);
t('extras appear as their own bill line',
  quote(eight).lines.some(l => l.key === 'extra-chicken'), true);

// ── the payment schedule ──
const plan0 = paymentPlan({...good,hours:4,payments:[]});
t('nothing paid yet', [plan0.paid, plan0.pending], [0,0]);
t('due now is the whole 50%', plan0.dueNow, 350);
t('balance is the other 50%', plan0.balance, 350);

const afterHold = paymentPlan({...good,hours:4,payments:[{kind:'hold',amount:70,claimed:true,confirmed:true}]});
t('holding deposit is credited', afterHold.paid, 70);
t('remaining due is 50% minus the hold', afterHold.dueNow, 280);
t('70 + 280 reaches half of 700', afterHold.paid + afterHold.dueNow, 350);

const claimedOnly = paymentPlan({...good,hours:4,
  payments:[{kind:'hold',amount:70,claimed:true,confirmed:false}]});
t('an unconfirmed claim is not counted as paid', claimedOnly.paid, 0);
t('but it is not asked for twice', claimedOnly.dueNow, 280);

const big = paymentPlan({...good,hours:5,addons:{wagyu:10},payments:[{kind:'hold',amount:70,claimed:true,confirmed:true}]});
t('bigger menu, bigger second payment', [big.subtotal, big.byMenu, big.dueNow], [1000, 500, 430]);

const sheet=prepSheet({...good,pax:12,addons:{wagyu:10,'sake-dassai-23':1}});
t('prep sheet rows', sheet.length, 11);
t('prep sheet marks which skewers are extras',
  prepSheet({...eight,addons:{}}).filter(r => r.note === 'extra').length, 1);
t('prep totals merge skewers, split bottles', prepTotals(sheet), '118 skewers · 1 bottle');

console.log(`\n${pass} passed, ${fail} failed`);
__done(fail);
