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
/** n days out, nudged forward to the next Tue–Sat so seed data lands on a service day. */
function serviceDay(n){
  const d = addDays(n);
  while (!SETTINGS.serviceDays.includes(d.getDay())) d.setDate(d.getDate() + 1);
  return iso(d);
}
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
   req → conf → menu → paid → done
   req   customer asked for a date; Gino hasn't answered
   conf  Gino said yes; the private menu link now opens
   menu  customer submitted their 7 + 2 (may also have claimed the deposit)
   paid  Gino confirmed the deposit landed
   done  the night happened                                              */
const STATUSES = {
  req:  { label:'New request', cls:'p-req',  todo:'Confirm or decline the date' },
  conf: { label:'Confirmed',   cls:'p-conf', todo:'Waiting on their menu' },
  menu: { label:'Menu in',     cls:'p-menu', todo:'Deposit not received yet' },
  paid: { label:'Paid',        cls:'p-paid', todo:null },
  done: { label:'Done',        cls:'p-done', todo:null }
};
const NEEDS_ACTION = ['req', 'conf', 'menu'];

const SET7 = ['thigh-leek','skin','tail','meatball','liver','wing','neck'];

function seedStore(){
  return {
    seq: 433,
    seededOn: iso(new Date()),
    /* Offsets are spaced so that snapping forward to a service day can't collapse
       two blocked dates together, or a blocked date onto a booking. */
    blocked: [serviceDay(12), serviceDay(15), serviceDay(41)],
    bookings: [
      { id:'BY-0418', name:'Daniel Wong', phone:'+65 9123 4567', date:serviceDay(3), time:'19:00',
        pax:15, hours:5, status:'paid', addr:'18 Katong Park Ave', depositClaimed:true,
        notes:'Two guests don’t eat pork. Birthday — will bring a cake at the end.',
        chicken:['heart','gizzard','skin','thigh','tail','fillet','neck-skin'], veg:['white-corn','shishito'],
        addons:{ 'king-prawn':15, 'iberico-belly':10, 'sashimi-5':15, 'sake-dassai-23':2 } },

      { id:'BY-0421', name:'Rachel Tan', phone:'+65 8234 5678', date:serviceDay(9), time:'19:00',
        pax:12, hours:4, status:'menu', addr:'42 Jalan Kayu', depositClaimed:false,
        notes:'One guest allergic to shellfish.',
        chicken:SET7.slice(), veg:['asparagus','shiitake'],
        addons:{ 'pb-shisho':12, 'wagyu':10, 'sake-kuheiji-kurodasho':1, 'uni':1 } },

      { id:'BY-0425', name:'Marcus Lim', phone:'+65 9345 6789', date:serviceDay(16), time:'18:30',
        pax:20, hours:6, status:'conf', addr:'Sentosa Cove, Ocean Drive', depositClaimed:false,
        notes:'Company dinner. Wants the grill on the terrace.',
        chicken:[], veg:[], addons:{} },

      { id:'BY-0429', name:'Priya Menon', phone:'+65 8456 7890', date:serviceDay(23), time:'19:30',
        pax:10, hours:4, status:'req', addr:'Bukit Timah, Sixth Ave', depositClaimed:false,
        notes:'Is it possible to do a vegetarian portion for two guests?',
        chicken:[], veg:[], addons:{} },

      { id:'BY-0430', name:'Alex Chua', phone:'+65 9567 8901', date:serviceDay(30), time:'19:00',
        pax:14, hours:4, status:'req', addr:'Tiong Bahru', depositClaimed:false,
        notes:'', chicken:[], veg:[], addons:{} },

      { id:'BY-0402', name:'Serene Koh', phone:'+65 9789 0123', date:serviceDay(-7), time:'19:00',
        pax:10, hours:4, status:'done', addr:'Holland Village', depositClaimed:true,
        notes:'', chicken:SET7.slice(), veg:['asparagus','cherry-tomato'], addons:{ 'pb-tomato':10 } },

      { id:'BY-0388', name:'Farid Rahman', phone:'+65 8890 1234', date:serviceDay(-21), time:'18:30',
        pax:18, hours:5, status:'done', addr:'Pasir Panjang', depositClaimed:true,
        notes:'', chicken:SET7.slice(), veg:['zucchini','baby-potato'], addons:{ 'lamb-rack':18, 'quail-egg':18 } }
    ]
  };
}

const STORE_KEY = 'bincotan.store.v2';
let STORE = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (raw && Array.isArray(raw.bookings)) return raw;
  } catch {}                       // private mode, or a sandboxed embed with storage blocked
  return seedStore();
})();
function saveStore(){ try { localStorage.setItem(STORE_KEY, JSON.stringify(STORE)); } catch {} }
function resetStore(){ STORE = seedStore(); saveStore(); }

/* ── reads ──────────────────────────────────────────── */
const bookings    = () => STORE.bookings;
const bookingById = id => STORE.bookings.find(b => b.id === id);
const bookingOn   = d  => STORE.bookings.find(b => b.date === d && b.status !== 'done');
const actionable  = () => STORE.bookings.filter(b => NEEDS_ACTION.includes(b.status) && daysUntil(b.date) >= 0);
const upcoming    = () => STORE.bookings.filter(b => daysUntil(b.date) >= 0 && b.status !== 'done')
                                        .sort((a,b) => a.date.localeCompare(b.date));
const past        = () => STORE.bookings.filter(b => daysUntil(b.date) < 0 || b.status === 'done')
                                        .sort((a,b) => b.date.localeCompare(a.date));
const nextEvent   = () => upcoming().find(b => b.status === 'paid' || b.status === 'menu') || upcoming()[0];

const isBlocked = d => STORE.blocked.includes(d);

/** Dates the customer's picker must not offer: blocked evenings and live bookings. */
function unavailableDates(){
  const out = new Set(STORE.blocked);
  STORE.bookings.forEach(b => { if (b.status !== 'done') out.add(b.date); });
  return out;
}

/* ── writes ─────────────────────────────────────────── */
function toggleBlocked(d){
  const i = STORE.blocked.indexOf(d);
  i > -1 ? STORE.blocked.splice(i, 1) : STORE.blocked.push(d);
  saveStore();
}

/** A customer asks for a date. Returns the new booking. */
function createBooking(f){
  const b = {
    id: 'BY-' + String(++STORE.seq).padStart(4, '0'),
    status: 'req', createdAt: iso(new Date()),
    name:'', phone:'', addr:'', notes:'', time:'19:00',
    pax: SETTINGS.minPax, hours: SETTINGS.chefServiceHours,
    chicken: [], veg: [], addons: {}, depositClaimed: false,
    ...f
  };
  STORE.bookings.push(b);
  saveStore();
  return b;
}

function setStatus(id, status){
  const b = bookingById(id);
  if (b) { b.status = status; saveStore(); }
  return b;
}
function declineBooking(id){
  const i = STORE.bookings.findIndex(b => b.id === id);
  if (i > -1) { STORE.bookings.splice(i, 1); saveStore(); }
}
/** Live-saves the customer's picks, so Gino sees progress before they submit. */
function saveMenu(id, patch){
  const b = bookingById(id);
  if (!b) return null;
  Object.assign(b, patch);
  saveStore();
  return b;
}
function submitMenu(id){
  const b = bookingById(id);
  if (b && b.status === 'conf') { b.status = 'menu'; saveStore(); }
  return b;
}
function claimDeposit(id){
  const b = bookingById(id);
  if (b) { b.depositClaimed = true; saveStore(); }
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
