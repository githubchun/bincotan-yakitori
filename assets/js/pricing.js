/* Pricing + validation — the single source of truth.
   Pure functions, no DOM. In the real build this module is shared by the browser
   (live estimate) and the server (authoritative recompute on submit). The browser's
   number is never trusted. */

const money = n => '$' + Number(n).toLocaleString('en-SG', {
  minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2
});

/**
 * @param {{hours:number, addons:Object<string,number>}} order
 * @returns {{lines:Array, subtotal:number, deposit:number, balance:number, askItems:Array}}
 */
function quote(order) {
  const hours = Math.max(SETTINGS.chefServiceHours, order.hours || SETTINGS.chefServiceHours);
  const extraHours = hours - SETTINGS.chefServiceHours;

  const lines = [{
    key: 'base',
    label: 'Yakitori set — 7 chicken + 2 vegetable',
    sub: `Serves ${SETTINGS.minPax} · session ${money(SETTINGS.sessionFee)} + chef service ${money(SETTINGS.chefServiceFee)} (${SETTINGS.chefServiceHours} hrs)`,
    amount: SETTINGS.sessionFee + SETTINGS.chefServiceFee
  }];

  if (extraHours > 0) lines.push({
    key: 'hours',
    label: `Additional chef hours × ${extraHours}`,
    sub: `${money(SETTINGS.extraHourFee)} per hour`,
    amount: extraHours * SETTINGS.extraHourFee
  });

  const askItems = [];
  for (const [id, qty] of Object.entries(order.addons || {})) {
    if (!qty) continue;
    const m = byId(id);
    if (!m) continue;
    if (m.price === 'ask') { askItems.push(m); continue; }
    lines.push({
      key: id,
      label: m.en,
      sub: `${qty} × ${money(m.price)} per ${m.unit}`,
      amount: qty * m.price,
      qty
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const deposit  = Math.round(subtotal * SETTINGS.depositPct * 100) / 100;
  return { lines, subtotal, deposit, balance: subtotal - deposit, askItems };
}

/**
 * Every rule the chef's PDF states, in one place.
 * @returns {{ok:boolean, errors:string[], counts:{chicken:number, veg:number}}}
 */
function validate(order) {
  const errors = [];
  const chicken = (order.chicken || []).length;
  const veg     = (order.veg || []).length;

  if (chicken !== SETTINGS.includedChicken)
    errors.push(`Choose exactly ${SETTINGS.includedChicken} chicken skewers — ${chicken} selected.`);
  if (veg !== SETTINGS.includedVeg)
    errors.push(`Choose exactly ${SETTINGS.includedVeg} vegetable skewers — ${veg} selected.`);
  if ((order.pax || 0) < SETTINGS.minPax)
    errors.push(`Minimum ${SETTINGS.minPax} guests.`);

  for (const [id, qty] of Object.entries(order.addons || {})) {
    if (!qty) continue;
    const m = byId(id);
    if (m && m.min && qty < m.min)
      errors.push(`${m.en} — minimum ${m.min} ${m.unit}${m.min > 1 ? 's' : ''}, ${qty} entered.`);
  }

  return { ok: errors.length === 0, errors, counts: { chicken, veg } };
}

/** Prep sheet: what the chef actually shops for and skewers. */
function prepSheet(order) {
  const rows = [];
  (order.chicken || []).forEach(id => rows.push({ item: byId(id), qty: order.pax, note: 'set' }));
  (order.veg || []).forEach(id     => rows.push({ item: byId(id), qty: order.pax, note: 'set' }));
  for (const [id, qty] of Object.entries(order.addons || {})) {
    if (qty) rows.push({ item: byId(id), qty, note: 'add-on' });
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
