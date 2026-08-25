/* Booking store + shared date helpers.
   Loaded before chef.js and app.js — both read from here.
   In the real build this is Postgres; in the prototype it's an array the UI mutates. */

/* Local calendar date. Do NOT use the UTC serialiser here — it shifts to UTC and
   lands on the previous day anywhere east of Greenwich. Singapore is UTC+8. */
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

function addDays(n, from){
  const d = new Date(from || new Date());
  d.setHours(0,0,0,0); d.setDate(d.getDate() + n);
  return d;
}
/** n days out, nudged forward to the next Tue–Sat so mock data always lands on a service day. */
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

const STATUSES = {
  req:  { label:'New request', cls:'p-req',  todo:'Confirm or decline the date' },
  conf: { label:'Confirmed',   cls:'p-conf', todo:'Waiting on their menu' },
  menu: { label:'Menu in',     cls:'p-menu', todo:'Deposit not received yet' },
  paid: { label:'Paid',        cls:'p-paid', todo:null },
  done: { label:'Done',        cls:'p-done', todo:null }
};
const NEEDS_ACTION = ['req', 'conf', 'menu'];

/* Dates the chef has personally blocked off. Offsets are spaced so that snapping
   forward to a service day can't collapse two of them onto the same date. */
const BLOCKED = new Set([serviceDay(12), serviceDay(15), serviceDay(41)]);

const SET7 = ['thigh-leek','skin','tail','meatball','liver','wing','neck'];

const BOOKINGS = [
  { id:'BY-0418', name:'Daniel Wong', phone:'+65 9123 4567', date:serviceDay(3), time:'19:00',
    pax:15, hours:5, status:'paid', addr:'18 Katong Park Ave', paidAt:serviceDay(-2),
    notes:'Two guests don’t eat pork. Birthday — will bring a cake at the end.',
    chicken:['heart','gizzard','skin','thigh','tail','fillet','neck-skin'], veg:['white-corn','shishito'],
    addons:{ 'king-prawn':15, 'iberico-belly':10, 'sashimi-5':15, 'sake-dassai-23':2 } },

  { id:'BY-0421', name:'Rachel Tan', phone:'+65 8234 5678', date:serviceDay(9), time:'19:00',
    pax:12, hours:4, status:'menu', addr:'42 Jalan Kayu',
    notes:'One guest allergic to shellfish.',
    chicken:SET7, veg:['asparagus','shiitake'],
    addons:{ 'pb-shisho':12, 'wagyu':10, 'sake-kuheiji-kurodasho':1, 'uni':1 } },

  { id:'BY-0425', name:'Marcus Lim', phone:'+65 9345 6789', date:serviceDay(16), time:'18:30',
    pax:20, hours:6, status:'conf', addr:'Sentosa Cove, Ocean Drive',
    notes:'Company dinner. Wants the grill on the terrace.',
    chicken:[], veg:[], addons:{} },

  { id:'BY-0429', name:'Priya Menon', phone:'+65 8456 7890', date:serviceDay(23), time:'19:30',
    pax:10, hours:4, status:'req', addr:'Bukit Timah, Sixth Ave',
    notes:'Is it possible to do a vegetarian portion for two guests?',
    chicken:[], veg:[], addons:{} },

  { id:'BY-0430', name:'Alex Chua', phone:'+65 9567 8901', date:serviceDay(30), time:'19:00',
    pax:14, hours:4, status:'req', addr:'Tiong Bahru',
    notes:'', chicken:[], veg:[], addons:{} },

  { id:'BY-0433', name:'Wei Ling Ho', phone:'+65 8678 9012', date:serviceDay(38), time:'19:00',
    pax:10, hours:4, status:'conf', addr:'Serangoon Gardens',
    notes:'', chicken:[], veg:[], addons:{} },

  { id:'BY-0402', name:'Serene Koh', phone:'+65 9789 0123', date:serviceDay(-7), time:'19:00',
    pax:10, hours:4, status:'done', addr:'Holland Village',
    notes:'', chicken:SET7, veg:['asparagus','cherry-tomato'], addons:{ 'pb-tomato':10 } },

  { id:'BY-0388', name:'Farid Rahman', phone:'+65 8890 1234', date:serviceDay(-21), time:'18:30',
    pax:18, hours:5, status:'done', addr:'Pasir Panjang',
    notes:'', chicken:SET7, veg:['zucchini','baby-potato'], addons:{ 'lamb-rack':18, 'quail-egg':18 } }
];

const bookingById  = id => BOOKINGS.find(b => b.id === id);
const bookingOn    = d  => BOOKINGS.find(b => b.date === d && b.status !== 'done');
const actionable   = () => BOOKINGS.filter(b => NEEDS_ACTION.includes(b.status) && daysUntil(b.date) >= 0);
const upcoming     = () => BOOKINGS.filter(b => daysUntil(b.date) >= 0 && b.status !== 'done')
                                   .sort((a,b) => a.date.localeCompare(b.date));
const nextEvent    = () => upcoming().find(b => b.status === 'paid' || b.status === 'menu') || upcoming()[0];

/** Dates the customer-facing calendar must not offer. */
function unavailableDates(){
  const out = new Set(BLOCKED);
  BOOKINGS.forEach(b => { if (b.status !== 'done') out.add(b.date); });
  return out;
}

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
