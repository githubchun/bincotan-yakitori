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
t('base deposit', quote({hours:4,addons:{}}).deposit, 350);
t('two extra hours', quote({hours:6,addons:{}}).subtotal, 800);
t('hours below minimum clamp', quote({hours:2,addons:{}}).subtotal, 700);
t('wagyu x10', quote({hours:4,addons:{wagyu:10}}).subtotal, 950);
t('fractional price 12 x 6.5', quote({hours:4,addons:{'pb-shisho':12}}).subtotal, 778);
t('ask item excluded from total', quote({hours:4,addons:{uni:1}}).subtotal, 700);
t('ask item surfaced separately', quote({hours:4,addons:{uni:1}}).askItems.map(m=>m.id), ['uni']);
t('deposit rounds to cents (771.50/2)', quote({hours:4,addons:{'iberico-belly':11}}).deposit, 385.75);

const good={chicken:['liver','heart','skin','tail','thigh','wing','neck'],veg:['asparagus','shishito'],pax:10,addons:{}};
t('valid order passes', validate(good).ok, true);
t('6 chicken fails', validate({...good,chicken:good.chicken.slice(0,6)}).ok, false);
t('3 vegetable fails', validate({...good,veg:['asparagus','shishito','zucchini']}).ok, false);
t('9 pax fails', validate({...good,pax:9}).ok, false);
t('below min qty fails', validate({...good,addons:{wagyu:5}}).ok, false);
t('at min qty passes', validate({...good,addons:{wagyu:10}}).ok, true);
t('min-2 item at 2 passes', validate({...good,addons:{kinki:2}}).ok, true);
t('min-2 item at 1 fails', validate({...good,addons:{kinki:1}}).ok, false);

const sheet=prepSheet({...good,pax:12,addons:{wagyu:10,'sake-dassai-23':1}});
t('prep sheet rows', sheet.length, 11);
t('prep totals merge skewers, split bottles', prepTotals(sheet), '118 skewers · 1 bottle');

console.log(`\n${pass} passed, ${fail} failed`);
__done(fail);
