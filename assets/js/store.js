/* Booking store + shared date helpers.
   Persisted to localStorage so the customer side and the chef side of the
   prototype read and write the same records inside one browser.
   In the real build this is Postgres behind an API; the record shape stays the same. */

/* Local calendar date. Do NOT use the UTC serialiser here — it shifts to UTC and
   lands on the previous day anywhere east of Greenwich. Singapore is UTC+8. */
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

function addDays(n, from){
  const d = new Date(from || new Date());
  d.setHours(0,0,0,0); d.setDate(d.getDate() + n);
  return d;
}
/** n days out. Seed data no longer needs to dodge fixed service days. */
const serviceDay = n => iso(addDays(n));
const monthKey   = d => (typeof d === 'string' ? d : iso(d)).slice(0, 7);
function prettyDate(s){
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-SG',
    { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
function shortDate(s){
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-SG',
    { weekday:'short', day:'numeric', month:'short' });
}
function daysUntil(s){
  return Math.round((new Date(s + 'T00:00:00') - addDays(0)) / 86400000);
}
function whenLabel(s){
  const n = daysUntil(s);
  if (n === 0) return 'Tonight';
  if (n === 1) return 'Tomorrow';
  if (n < 0)   return `${-n} day${n === -1 ? '' : 's'} ago`;
  if (n < 7)   return `In ${n} days`;
  return `In ${Math.round(n / 7)} week${n < 11 ? '' : 's'}`;
}

/* ── the booking lifecycle ──────────────────────────────
   Gino never approves a date: booking takes it immediately. What he does is
   confirm that money arrived, and unlock a menu when someone wants to change it.

   hold      booked; the 10% holding deposit hasn't been confirmed yet
   building  deposit confirmed; the customer is choosing their menu
   menuIn    menu submitted and locked; the 40% top-up isn't paid
   menuPaid  customer says they've paid; Gino hasn't confirmed it
   set       paid to 50% and locked in
   done      the night happened                                            */
const STATUSES = {
  hold:     { label:'Holding',    cls:'p-req',  todo:'Confirm the holding deposit landed' },
  building: { label:'Choosing',   cls:'p-conf', todo:'Waiting on their menu' },
  menuIn:   { label:'Menu in',    cls:'p-menu', todo:'Balance to 50% not paid' },
  menuPaid: { label:'Paid 50%?',  cls:'p-menu', todo:'Confirm their payment landed' },
  set:      { label:'Set',        cls:'p-paid', todo:null },
  done:     { label:'Done',       cls:'p-done', todo:null }
};
const NEEDS_ACTION = ['hold', 'building', 'menuIn', 'menuPaid'];

const paid    = b => (b.payments || []).filter(p => p.confirmed);
const claimed = b => (b.payments || []).filter(p => p.claimed && !p.confirmed);
const hasKind = (b, kind, f) => (b.payments || []).some(p => p.kind === kind && f(p));

/** One derived stage, so status can never disagree with the payment records. */
function stage(b){
  if (b.completed)                       return 'done';
  if (hasKind(b, 'menu', p => p.confirmed)) return 'set';
  if (hasKind(b, 'menu', p => p.claimed))   return 'menuPaid';
  if (b.menuLocked)                      return 'menuIn';
  if (hasKind(b, 'hold', p => p.confirmed)) return 'building';
  return 'hold';
}
const statusOf = b => STATUSES[stage(b)];

const SET7 = ['thigh-leek','skin','tail','meatball','liver','wing','neck'];

const HOLD = () => round2(SETTINGS.holdPct * minimumSpend());
const pay  = (kind, amount, confirmed) => ({ kind, amount, claimed:true, confirmed });

function seedStore(){
  const thisMonth = monthKey(addDays(0));
  const nextMonth = monthKey(addDays(32));
  return {
    seq: 433,
    seededOn: iso(new Date()),
    /* Gino opens a month at a time, then closes individual evenings inside it. */
    releasedMonths: [thisMonth, nextMonth],
    log: [],
    /* What Gino has done to the menu. The MENU array in menu-data.js stays the
       shipped original; this is the diff on top of it. See applyMenu(). */
    menu: { edits:{}, custom:[], retired:[], deleted:[] },
    blocked: [serviceDay(12), serviceDay(15), serviceDay(41)],
    bookings: [
      { id:'BY-0418', name:'Daniel Wong', phone:'+65 9123 4567', date:serviceDay(3), time:'19:00',
        pax:15, hours:5, addr:'18 Katong Park Ave', menuLocked:true, completed:false,
        notes:'Two guests don’t eat pork. Birthday — will bring a cake at the end.',
        chicken:['heart','gizzard','skin','thigh','tail','fillet','neck-skin'], veg:['white-corn','shishito'],
        addons:{ 'king-prawn':15, 'iberico-belly':10, 'sashimi-5':15, 'sake-dassai-23':2 },
        payments:[ pay('hold', HOLD(), true), pay('menu', 802.50, true) ] },

      { id:'BY-0421', name:'Rachel Tan', phone:'+65 8234 5678', date:serviceDay(9), time:'19:00',
        pax:12, hours:4, addr:'42 Jalan Kayu', menuLocked:true, completed:false,
        notes:'One guest allergic to shellfish.',
        chicken:SET7.slice(), veg:['asparagus','shiitake'],
        addons:{ 'pb-shisho':12, 'wagyu':10, 'sake-kuheiji-kurodasho':1, 'uni':1 },
        payments:[ pay('hold', HOLD(), true), pay('menu', 484, true) ] },

      { id:'BY-0425', name:'Marcus Lim', phone:'+65 9345 6789', date:serviceDay(16), time:'18:30',
        pax:20, hours:6, addr:'Sentosa Cove, Ocean Drive', menuLocked:false, completed:false,
        notes:'Company dinner. Wants the grill on the terrace.',
        chicken:[], veg:[], addons:{},
        payments:[ pay('hold', HOLD(), true) ] },

      { id:'BY-0429', name:'Priya Menon', phone:'+65 8456 7890', date:serviceDay(23), time:'19:30',
        pax:10, hours:4, addr:'Bukit Timah, Sixth Ave', menuLocked:false, completed:false,
        notes:'Is it possible to do a vegetarian portion for two guests?',
        chicken:[], veg:[], addons:{},
        payments:[ pay('hold', HOLD(), false) ] },

      { id:'BY-0430', name:'Alex Chua', phone:'+65 9567 8901', date:serviceDay(30), time:'19:00',
        pax:14, hours:4, addr:'Tiong Bahru', menuLocked:false, completed:false,
        notes:'', chicken:[], veg:[], addons:{},
        payments:[ pay('hold', HOLD(), false) ] },

      { id:'BY-0402', name:'Serene Koh', phone:'+65 9789 0123', date:serviceDay(-7), time:'19:00',
        pax:10, hours:4, addr:'Holland Village', menuLocked:true, completed:true,
        notes:'', chicken:SET7.slice(), veg:['asparagus','cherry-tomato'], addons:{ 'pb-tomato':10 },
        payments:[ pay('hold', HOLD(), true), pay('menu', 305, true) ] },

      { id:'BY-0388', name:'Farid Rahman', phone:'+65 8890 1234', date:serviceDay(-21), time:'18:30',
        pax:18, hours:5, addr:'Pasir Panjang', menuLocked:true, completed:true,
        notes:'', chicken:SET7.slice(), veg:['zucchini','baby-potato'], addons:{ 'lamb-rack':18, 'quail-egg':18 },
        payments:[ pay('hold', HOLD(), true), pay('menu', 611, true) ] }
    ]
  };
}

/* Bump this whenever the record shape changes. Anything saved under an older key
   is simply ignored, so a returning visitor never loads data this code can't read. */
const STORE_KEY = 'bincotan.store.v4';

/* Belt and braces: even within a version, refuse a record that's missing a field
   the app depends on. A half-written or hand-edited store re-seeds instead of
   throwing mid-render and leaving a blank page. */
function isUsableStore(raw){
  return !!(raw
    && Array.isArray(raw.bookings)
    && Array.isArray(raw.blocked)
    && Array.isArray(raw.releasedMonths)
    && Array.isArray(raw.log)
    && typeof raw.seq === 'number'
    && raw.menu && typeof raw.menu === 'object'
    && raw.menu.edits && typeof raw.menu.edits === 'object'
    && Array.isArray(raw.menu.custom)
    && Array.isArray(raw.menu.retired)
    && Array.isArray(raw.menu.deleted)
    && raw.bookings.every(b =>
         b && typeof b.id === 'string' && typeof b.date === 'string'
         && Array.isArray(b.chicken) && Array.isArray(b.veg)
         && b.addons && typeof b.addons === 'object'
         && Array.isArray(b.payments)));
}

let STORE = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (isUsableStore(raw)) return raw;
  } catch {}                       // private mode, or a sandboxed embed with storage blocked
  return seedStore();
})();
function saveStore(){ try { localStorage.setItem(STORE_KEY, JSON.stringify(STORE)); } catch {} }

/** Append to the record. Every mutation below goes through here, never around it. */
function record(kind, opts){
  const e = logEvent(STORE.log, kind, opts);
  /* In the real build this is where a transactional email goes out. Here the
     message is rendered on demand instead — see emailFor(). */
  saveStore();
  return e;
}

/* Give the sample bookings a plausible history so the record isn't empty. */
function seedLog(){
  record('log.started', { summary:'Transaction record opened' , at:new Date(Date.now() - 40*864e5).toISOString() });
  STORE.releasedMonths.forEach(m =>
    record('month.released', { summary:`${m} opened for booking`, data:{ month:m },
      at:new Date(Date.now() - 39*864e5).toISOString() }));
  [...STORE.bookings].sort((a,b) => a.id.localeCompare(b.id)).forEach((b, i) => {
    const t = k => new Date(Date.now() - (30 - i*3) * 864e5 + k * 36e5).toISOString();
    record('booking.created', { ref:b.id, at:t(0),
      summary:`${b.name} booked ${shortDate(b.date)} for ${b.pax} guests`,
      data:{ date:b.date, time:b.time, guests:b.pax, hours:b.hours, where:b.addr, note:b.notes || '—' } });
    (b.payments || []).forEach((p, j) => {
      record('payment.claimed', { ref:b.id, at:t(1 + j*2),
        summary:`${b.name} sent ${money(p.amount)} (${p.kind === 'hold' ? 'holding deposit' : 'balance to 50%'})`,
        data:{ amount:money(p.amount), kind:p.kind, reference:b.id } });
      if (p.confirmed) record('payment.confirmed', { ref:b.id, at:t(2 + j*2),
        summary:`Gino confirmed ${money(p.amount)} received`,
        data:{ amount:money(p.amount), kind:p.kind } });
    });
    if (b.menuLocked) record('menu.submitted', { ref:b.id, at:t(6),
      summary:`${b.name} submitted their menu — ${b.chicken.length} chicken, ${b.veg.length} vegetable`,
      data:{ chicken:b.chicken.map(id => byId(id)?.en || id),
             vegetable:b.veg.map(id => byId(id)?.en || id),
             addons:Object.fromEntries(Object.entries(b.addons).map(([k,v]) => [byId(k)?.en || k, v])),
             total:money(quote(b).subtotal) } });
    if (b.completed) record('booking.completed', { ref:b.id, at:t(8),
      summary:`${shortDate(b.date)} — event completed` });
  });
}
function resetStore(){ STORE = seedStore(); applyMenu(); seedLog(); saveStore(); }
if (!STORE.log.length) { seedLog(); }

const ledger    = () => STORE.log;
const logFor    = ref => STORE.log.filter(e => e.ref === ref);
const chainState = () => verifyChain(STORE.log);

/* ── reads ──────────────────────────────────────────── */
const bookings    = () => STORE.bookings;
const bookingById = id => STORE.bookings.find(b => b.id === id);
const bookingOn   = d  => STORE.bookings.find(b => b.date === d && !b.completed);
const actionable  = () => STORE.bookings.filter(b => NEEDS_ACTION.includes(stage(b)) && daysUntil(b.date) >= 0);
const upcoming    = () => STORE.bookings.filter(b => daysUntil(b.date) >= 0 && !b.completed)
                                        .sort((a,b) => a.date.localeCompare(b.date));
const past        = () => STORE.bookings.filter(b => daysUntil(b.date) < 0 || b.completed)
                                        .sort((a,b) => b.date.localeCompare(a.date));
const nextEvent   = () => upcoming()[0];

const isBlocked  = d => STORE.blocked.includes(d);
const isReleased = m => STORE.releasedMonths.includes(m);

/** An evening a customer may actually book. */
function isBookable(d){
  return isReleased(monthKey(d))
      && !isBlocked(d)
      && !bookingOn(d)
      && daysUntil(d) >= 0;
}
/** Dates the customer's picker must show as closed. */
function unavailableDates(){
  const out = new Set(STORE.blocked);
  STORE.bookings.forEach(b => { if (!b.completed) out.add(b.date); });
  return out;
}

/* ── writes ─────────────────────────────────────────── */
function toggleBlocked(d){
  const i = STORE.blocked.indexOf(d);
  const closing = i === -1;
  closing ? STORE.blocked.push(d) : STORE.blocked.splice(i, 1);
  record(closing ? 'date.closed' : 'date.opened', {
    summary: `${shortDate(d)} ${closing ? 'closed' : 'reopened'}`, data:{ date:d } });
}
/** Open or close a whole month. Closing never deletes the bookings inside it. */
function toggleMonth(m){
  const i = STORE.releasedMonths.indexOf(m);
  const releasing = i === -1;
  releasing ? STORE.releasedMonths.push(m) : STORE.releasedMonths.splice(i, 1);
  record(releasing ? 'month.released' : 'month.closed', {
    summary: `${m} ${releasing ? 'opened for booking' : 'closed'}`, data:{ month:m } });
}

/* ── the menu ────────────────────────────────────────────
   `MENU` in menu-data.js is the menu Gino was shipped. Everything he changes
   afterwards lives in STORE.menu and is re-projected onto that array on load,
   so byId / inCat / quote / prepSheet never learn that any of this exists.

   Removing splits two ways, and which one you get is not a choice:
     · nothing references the item  →  it is deleted
     · a booking references it      →  it is retired: gone from both menus, but
                                       still resolvable by byId, so the bill that
                                       was agreed still prices out to what was
                                       agreed. Restorable.                    */
const MENU_BASE = MENU.map(m => ({ ...m }));

/** Rebuild MENU in place from the shipped list plus Gino's changes. Idempotent. */
function applyMenu(){
  const cfg = STORE.menu;
  MENU.length = 0;
  MENU_BASE.forEach(b => { if (!cfg.deleted.includes(b.id)) MENU.push({ ...b }); });
  cfg.custom.forEach(c => MENU.push({ ...c }));
  MENU.forEach(m => {
    if (cfg.edits[m.id]) Object.assign(m, cfg.edits[m.id]);
    if (cfg.retired.includes(m.id)) m.retired = true;
  });
}

/** Every booking that would be repriced if this item vanished. */
function itemInUse(id){
  return STORE.bookings.filter(b =>
    (b.chicken || []).includes(id) ||
    (b.veg || []).includes(id) ||
    !!(b.addons || {})[id]);
}

/** A readable id from the English name, never colliding with one already taken. */
function slugId(en){
  const base = String(en || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
                 .replace(/^-+|-+$/g, '').slice(0, 32) || 'item';
  let id = base, n = 2;
  while (byId(id) || STORE.menu.deleted.includes(id)) id = `${base}-${n++}`;
  return id;
}

/** How a price reads in the record, where 'in the set' is as real as a number. */
const priceLabel = p => p === null ? 'in the set' : p === 'ask' ? 'on request' : money(p);

function addMenuItem(f){
  const item = { id: slugId(f.en), cat: f.cat, en: String(f.en || '').trim(),
                 cn: String(f.cn || '').trim(), price: f.price, noImg: true };
  if (f.unit) item.unit = f.unit;
  if (f.min)  item.min  = f.min;
  if (f.rec)  item.rec  = true;
  STORE.menu.custom.push(item);
  applyMenu();
  record('item.added', {
    summary: `${item.en} added to ${CATS[item.cat].label}`,
    data:{ item:item.en, chinese:item.cn || '—', category:CATS[item.cat].label,
           price:priceLabel(item.price), unit:item.unit || '—', minimum:item.min || '—' } });
  return byId(item.id);
}

/**
 * Delete it if no booking would notice; retire it if one would.
 * @returns {{action:'removed'|'retired', item:Object, bookings:Object[]}}
 */
function removeMenuItem(id){
  const m = byId(id);
  if (!m || m.retired) return null;
  const en = m.en, cat = m.cat, used = itemInUse(id);

  if (used.length){
    STORE.menu.retired.push(id);
    applyMenu();
    record('item.retired', {
      summary: `${en} retired — ${used.length} booking${used.length === 1 ? '' : 's'} still list it`,
      data:{ item:en, category:CATS[cat].label, keptFor:used.map(b => b.id).join(', ') } });
    return { action:'retired', item:byId(id), bookings:used };
  }

  const i = STORE.menu.custom.findIndex(c => c.id === id);
  if (i === -1) STORE.menu.deleted.push(id);
  else STORE.menu.custom.splice(i, 1);
  delete STORE.menu.edits[id];
  applyMenu();
  record('item.removed', {
    summary: `${en} removed from ${CATS[cat].label}`,
    data:{ item:en, category:CATS[cat].label, usedByAnyBooking:'no' } });
  return { action:'removed', item:m, bookings:[] };
}

/** Undo a delete, while the strip offering it is still on screen. */
function undoRemove(snap){
  if (!snap || byId(snap.id)) return null;
  const i = STORE.menu.deleted.indexOf(snap.id);
  if (i !== -1) STORE.menu.deleted.splice(i, 1);      // a shipped item: un-delete it
  else { const { retired, ...clean } = snap; STORE.menu.custom.push(clean); }
  applyMenu();
  record('item.restored', { summary:`${snap.en} put back on the menu`, data:{ item:snap.en } });
  return byId(snap.id);
}

/** Put a retired item back on the menu. */
function restoreItem(id){
  const i = STORE.menu.retired.indexOf(id);
  if (i === -1) return null;
  const en = byId(id)?.en || id;
  STORE.menu.retired.splice(i, 1);
  applyMenu();
  record('item.restored', { summary:`${en} put back on the menu`, data:{ item:en } });
  return byId(id);
}

function setItemPrice(id, v){
  const m = byId(id);
  if (!m || m.price === null || m.price === 'ask') return null;
  const en = m.en, was = m.price;
  if (!(v >= 0) || v === was) return null;
  (STORE.menu.edits[id] ||= {}).price = v;
  applyMenu();
  record('price.changed', {
    summary: `${en} — ${money(was)} → ${money(v)}`,
    data:{ item:en, from:money(was), to:money(v) } });
  return byId(id);
}

/** Switch an item off when it isn't in season. Bookings already placed keep it. */
function toggleItem(id){
  const m = byId(id);
  if (!m) return null;
  const en = m.en, showing = m.active === false;   // it was hidden; turning it back on
  (STORE.menu.edits[id] ||= {}).active = showing;
  applyMenu();
  record('item.toggled', {
    summary: `${en} ${showing ? 'back on the menu' : 'hidden from the menu'}`,
    data:{ item:en, customersSeeIt: showing ? 'yes' : 'no' } });
  return byId(id);
}

/** A customer takes a date. It is theirs immediately — Gino doesn't approve it. */
function createBooking(f){
  const b = {
    id: 'BY-' + String(++STORE.seq).padStart(4, '0'),
    createdAt: iso(new Date()),
    name:'', phone:'', addr:'', notes:'', time:'19:00',
    pax: SETTINGS.minPax, hours: SETTINGS.chefServiceHours,
    chicken: [], veg: [], addons: {},
    menuLocked: false, completed: false,
    payments: [ pay('hold', HOLD(), false) ],   // claimed on booking, Gino confirms
    ...f
  };
  STORE.bookings.push(b);
  record('booking.created', { ref:b.id,
    summary: `${b.name} booked ${shortDate(b.date)} for ${b.pax} guests`,
    data:{ date:b.date, time:b.time, guests:b.pax, hours:b.hours,
           where:b.addr, phone:b.phone, note:b.notes || '—',
           holding:money(HOLD()) } });
  return b;
}

function declineBooking(id){
  const i = STORE.bookings.findIndex(b => b.id === id);
  if (i === -1) return;
  const b = STORE.bookings[i];
  /* The booking goes, but its history stays — that is the point of the record. */
  STORE.bookings.splice(i, 1);
  record('booking.cancelled', { ref:b.id,
    summary: `${b.name}'s booking for ${shortDate(b.date)} was cancelled`,
    data:{ date:b.date, guests:b.pax, paid:money(paymentPlan(b).paid) } });
}

/** Live-saves the customer's picks so Gino sees progress before they submit. */
function saveMenu(id, patch){
  const b = bookingById(id);
  if (!b || b.menuLocked) return null;
  /* Deliberately not logged: this fires on every tap while they browse. What
     matters in a dispute is the snapshot at submit, which menu.submitted holds. */
  Object.assign(b, patch);
  saveStore();
  return b;
}
/** Submitting locks the menu; only Gino can reopen it. */
function submitMenu(id){
  const b = bookingById(id);
  if (!b || b.menuLocked) return b;
  b.menuLocked = true;
  const p = paymentPlan(b);
  record('menu.submitted', { ref:b.id,
    summary: `${b.name} submitted their menu — ${b.chicken.length} chicken, ${b.veg.length} vegetable`,
    data:{ chicken: b.chicken.map(x => byId(x)?.en || x),
           vegetable: b.veg.map(x => byId(x)?.en || x),
           addons: Object.fromEntries(Object.entries(b.addons)
                     .filter(([,n]) => n).map(([k,n]) => [byId(k)?.en || k, n])),
           guests: b.pax, total: money(p.subtotal), dueNow: money(p.dueNow) } });
  return b;
}
/** Gino reopens a locked menu so the customer can change their mind. Money already
    confirmed stays credited; if the menu grows, the shortfall reappears as due. */
function reopenMenu(id){
  const b = bookingById(id);
  if (!b) return null;
  const before = paymentPlan(b);
  b.menuLocked = false;
  b.payments = (b.payments || []).filter(p => !(p.kind === 'menu' && !p.confirmed));
  record('menu.reopened', { ref:b.id,
    summary: `Gino reopened ${b.name}'s menu`,
    data:{ wasChicken: b.chicken.map(x => byId(x)?.en || x),
           wasVegetable: b.veg.map(x => byId(x)?.en || x),
           wasTotal: money(before.subtotal), credited: money(before.paid) } });
  return b;
}

/** The customer says they've sent a payment. Gino confirms it separately. */
function claimPayment(id, kind, amount){
  const b = bookingById(id);
  if (!b) return null;
  const existing = (b.payments || []).find(p => p.kind === kind && !p.confirmed);
  if (existing) existing.amount = amount;
  else (b.payments ||= []).push(pay(kind, amount, false));
  record('payment.claimed', { ref:b.id,
    summary: `${b.name} sent ${money(amount)} (${kind === 'hold' ? 'holding deposit' : 'balance to 50%'})`,
    data:{ amount: money(amount), kind, reference: b.id } });
  return b;
}
function confirmPayment(id, kind){
  const b = bookingById(id);
  if (!b) return null;
  const amt = (b.payments || []).filter(p => p.kind === kind).reduce((s, p) => s + p.amount, 0);
  (b.payments || []).filter(p => p.kind === kind).forEach(p => { p.claimed = true; p.confirmed = true; });
  record('payment.confirmed', { ref:b.id,
    summary: `Gino confirmed ${money(amt)} received`,
    data:{ amount: money(amt), kind, totalPaid: money(paymentPlan(b).paid) } });
  return b;
}
function markComplete(id){
  const b = bookingById(id);
  if (!b) return null;
  b.completed = true;
  record('booking.completed', { ref:b.id,
    summary: `${shortDate(b.date)} — event completed`,
    data:{ guests:b.pax, total:money(paymentPlan(b).subtotal), paid:money(paymentPlan(b).paid) } });
  return b;
}

/** The private link Gino sends once he's confirmed the date. */
const orderPath = id => `#/order/${id}`;
const orderUrl  = id => location.origin + location.pathname + orderPath(id);

/** How many skewers actually go on the grill — bottles and platters aren't skewers. */
function skewerCount(b){
  return prepSheet({ chicken:b.chicken, veg:b.veg, addons:b.addons, pax:b.pax })
    .filter(r => r.item.price === null || r.item.unit === 'skewer')
    .reduce((s, r) => s + r.qty, 0);
}

/** What Gino buys, grouped the way a market run actually works. */
function shoppingList(b){
  const groups = {};
  prepSheet({ chicken:b.chicken, veg:b.veg, addons:b.addons, pax:b.pax }).forEach(r => {
    (groups[r.item.cat] ||= []).push(r);
  });
  return groups;
}

/* Project Gino's menu changes onto MENU before anything renders. */
applyMenu();
