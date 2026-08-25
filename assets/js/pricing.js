/* Pricing, validation and the payment schedule — the single source of truth.
   Pure functions, no DOM. In the real build this module moves to the server
   unchanged; the browser keeps using it for the live estimate, and the server's
   number is the one that gets charged. */

const money = n => '$' + Number(n).toLocaleString('en-SG', {
  minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2
});
const round2 = n => Math.round(n * 100) / 100;

/** The floor for any event: the session plus the included four hours of chef time. */
const minimumSpend = () => SETTINGS.sessionFee + SETTINGS.chefServiceFee;

/** Skewers of one extra type: one per guest, never fewer than the minimum. */
const extraQtyFor = pax => Math.max(SETTINGS.extraSkewerMinQty, pax || SETTINGS.minPax);

/**
 * @param {{hours:number, pax:number, chicken:string[], veg:string[], addons:Object<string,number>}} order
 * @returns {{lines:Array, subtotal:number, askItems:Array}}
 */
function quote(order){
  const hours = Math.max(SETTINGS.chefServiceHours, order.hours || SETTINGS.chefServiceHours);
  const extraHours = hours - SETTINGS.chefServiceHours;
  const pax = Math.max(SETTINGS.minPax, order.pax || SETTINGS.minPax);

  const lines = [{
    key: 'base',
    label: `Yakitori set — ${SETTINGS.includedChicken} chicken + ${SETTINGS.includedVeg} vegetable`,
    sub: `Serves ${SETTINGS.minPax} · session ${money(SETTINGS.sessionFee)} + chef service ${money(SETTINGS.chefServiceFee)} (${SETTINGS.chefServiceHours} hrs)`,
    amount: minimumSpend()
  }];

  if (extraHours > 0) lines.push({
    key: 'hours',
    label: `Additional chef hours × ${extraHours}`,
    sub: `${money(SETTINGS.extraHourFee)} per hour`,
    amount: extraHours * SETTINGS.extraHourFee
  });

  /* Anything chosen beyond the included 7 + 2 is billed like any other add-on:
     one skewer per guest of that type, minimum 10. */
  const qty = extraQtyFor(pax);
  const extras = [
    ['chicken', (order.chicken || []).length - SETTINGS.includedChicken, 'chicken'],
    ['veg',     (order.veg     || []).length - SETTINGS.includedVeg,     'vegetable']
  ];
  for (const [key, over, label] of extras){
    if (over > 0) lines.push({
      key: `extra-${key}`,
      label: `${over} extra ${label} skewer${over === 1 ? '' : 's'}`,
      sub: `${over} × ${qty} skewers × ${money(SETTINGS.extraSkewerPrice)}`,
      amount: over * qty * SETTINGS.extraSkewerPrice
    });
  }

  const askItems = [];
  for (const [id, n] of Object.entries(order.addons || {})) {
    if (!n) continue;
    const m = byId(id);
    if (!m) continue;
    if (m.price === 'ask') { askItems.push(m); continue; }
    lines.push({
      key: id, label: m.en,
      sub: `${n} × ${money(m.price)} per ${m.unit}`,
      amount: n * m.price, qty: n
    });
  }

  return { lines, subtotal: round2(lines.reduce((s, l) => s + l.amount, 0)), askItems };
}

/**
 * Money moves in three steps:
 *   1. a fixed holding deposit, 10% of the minimum spend, to take the date
 *   2. a top-up once the menu is confirmed, bringing the total paid to 50%
 *   3. the remaining 50%, settled with Gino on the night
 * Whatever has already been confirmed is credited, so reopening a menu never
 * loses a customer money — it just changes what's still owed.
 */
function paymentPlan(b){
  const q       = quote(b);
  const hold    = round2(SETTINGS.holdPct * minimumSpend());
  const byMenu  = round2(SETTINGS.byMenuPct * q.subtotal);
  const paid    = (b.payments || []).filter(p => p.confirmed).reduce((s, p) => s + p.amount, 0);
  const pending = (b.payments || []).filter(p => p.claimed && !p.confirmed).reduce((s, p) => s + p.amount, 0);
  const dueNow  = Math.max(0, round2(byMenu - paid - pending));
  return {
    ...q, hold, byMenu,
    paid: round2(paid), pending: round2(pending), dueNow,
    outstanding: round2(byMenu - paid),
    balance: round2(q.subtotal - byMenu)
  };
}

/**
 * Every rule the chef's menu states, in one place.
 * @returns {{ok:boolean, errors:string[], counts:{chicken:number, veg:number}}}
 */
function validate(order){
  const errors = [];
  const chicken = (order.chicken || []).length;
  const veg     = (order.veg || []).length;

  if (chicken < SETTINGS.includedChicken)
    errors.push(`Choose at least ${SETTINGS.includedChicken} chicken skewers — ${chicken} selected.`);
  if (veg < SETTINGS.includedVeg)
    errors.push(`Choose at least ${SETTINGS.includedVeg} vegetable skewers — ${veg} selected.`);
  if ((order.pax || 0) < SETTINGS.minPax)
    errors.push(`Minimum ${SETTINGS.minPax} guests.`);

  for (const [id, n] of Object.entries(order.addons || {})) {
    if (!n) continue;
    const m = byId(id);
    if (m && m.min && n < m.min)
      errors.push(`${m.en} — minimum ${m.min} ${m.unit}${m.min > 1 ? 's' : ''}, ${n} entered.`);
  }

  return { ok: errors.length === 0, errors, counts: { chicken, veg } };
}

/** Prep sheet: what the chef actually shops for and skewers. */
function prepSheet(order){
  const rows = [];
  const pax = Math.max(SETTINGS.minPax, order.pax || SETTINGS.minPax);
  (order.chicken || []).forEach((id, i) =>
    rows.push({ item: byId(id), qty: pax, note: i < SETTINGS.includedChicken ? 'set' : 'extra' }));
  (order.veg || []).forEach((id, i) =>
    rows.push({ item: byId(id), qty: pax, note: i < SETTINGS.includedVeg ? 'set' : 'extra' }));
  for (const [id, n] of Object.entries(order.addons || {})) {
    if (n) rows.push({ item: byId(id), qty: n, note: 'add-on' });
  }
  return rows.filter(r => r.item);
}

/** Totals for the prep sheet, grouped by unit — a saké bottle is not a skewer. */
function prepTotals(rows){
  const by = {};
  rows.forEach(r => {
    const u = r.item.price === null ? 'skewer' : (r.item.unit || 'item');
    by[u] = (by[u] || 0) + r.qty;
  });
  return Object.entries(by)
    .map(([u, n]) => `${n} ${u}${n === 1 ? '' : u === 'pax' ? '' : 's'}`)
    .join(' · ');
}
