/* The chef's side. A tool, not a page — scanned and operated, mostly on a phone
   between jobs. Summary before detail; state readable at a glance. */

const CHEF_TABS = [
  ['#/chef',          'Bookings'],
  ['#/chef/calendar', 'Calendar'],
  ['#/chef/menu',     'Menu'],
  ['#/chef/settings', 'Settings']
];

let chefSel    = null;                 // selected booking id
let chefFilter = 'action';             // action | upcoming | past

function chefShell(active, body){
  const today = new Date().toLocaleDateString('en-SG', { weekday:'short', day:'numeric', month:'short' });
  return `<header class="chead">
    <div class="wrap chead-in">
      <a href="#/" class="brand" title="Back to the public site">
        <img src="${asset('mark-rooster')}" alt="">
        <span class="brand-txt">BINCOTAN<small>CHEF</small></span>
      </a>
      <span class="chead-date">${today}</span>
    </div>
    <div class="wrap ctabs">
      ${CHEF_TABS.map(([h,l]) =>
        `<a class="ctab ${active===h?'on':''}" href="${h}">${l}</a>`).join('')}
      <a class="ctab ctab-out" href="#/">View public site ↗</a>
    </div>
  </header>
  <div class="demo-bar">Demo — these bookings are made up. Nothing here is real and nothing sends.</div>
  <main class="wrap chef-main">${body}</main>`;
}

/* ── Bookings ─────────────────────────────────────────── */
function ChefBookings(){
  const todo = actionable();
  const next = nextEvent();
  const counts = {
    req:  todo.filter(b => b.status === 'req').length,
    conf: todo.filter(b => b.status === 'conf').length,
    menu: todo.filter(b => b.status === 'menu').length
  };
  const list = chefFilter === 'past'
    ? BOOKINGS.filter(b => daysUntil(b.date) < 0 || b.status === 'done').sort((a,b) => b.date.localeCompare(a.date))
    : chefFilter === 'upcoming' ? upcoming() : todo;

  if (!chefSel || !list.some(b => b.id === chefSel)) chefSel = list[0]?.id || null;
  const sel = bookingById(chefSel);

  const alert = (n, label, status) => n
    ? `<button class="alert ${status}" data-filter="action" data-status="${status}">
         <b>${n}</b><span>${label}</span></button>` : '';

  return chefShell('#/chef', `
    <div class="chef-top">
      <div>
        <h1 class="display chef-h1">Bookings</h1>
        <p class="muted" style="font-size:.88rem">
          ${todo.length ? `${todo.length} need${todo.length===1?'s':''} something from you.` : 'Nothing waiting on you.'}
        </p>
      </div>
      <div class="alerts">
        ${alert(counts.req,  counts.req === 1 ? 'new request' : 'new requests', 'a-req')}
        ${alert(counts.conf, 'waiting on menu', 'a-conf')}
        ${alert(counts.menu, 'deposit unpaid', 'a-menu')}
        ${todo.length ? '' : '<span class="alert a-ok"><b>✓</b><span>all clear</span></span>'}
      </div>
    </div>

    ${next ? nextUpCard(next) : ''}

    <div class="cfilters">
      ${[['action',`Needs you (${todo.length})`],['upcoming',`Upcoming (${upcoming().length})`],['past','Past']]
        .map(([k,l]) => `<button class="chip ${chefFilter===k?'on':''}" data-filter="${k}">${l}</button>`).join('')}
    </div>

    <div class="admin-grid">
      <div class="bk-list">
        ${list.length ? list.map(bookingRow).join('')
          : '<div class="notice notice-ok"><span>✓</span><div>Nothing here.</div></div>'}
      </div>
      <div id="bkDetail">${sel ? bookingDetail(sel) : ''}</div>
    </div>`);
}

function nextUpCard(b){
  const q = quote({ hours:b.hours, addons:b.addons });
  const n = daysUntil(b.date);
  return `<section class="nextup">
    <div class="nextup-l">
      <div class="eyebrow">Next up</div>
      <div class="nextup-when">${whenLabel(b.date)}</div>
      <div class="nextup-date">${prettyDate(b.date)} · ${b.time}</div>
      <div class="nextup-meta">${esc(b.name)} · ${b.pax} guests · ${b.hours} hrs · ${esc(b.addr)}</div>
      <div class="nextup-acts">
        <a class="btn btn-primary" href="${waLink(b, 'checkin')}" target="_blank" rel="noopener">Message ${esc(first(b))}</a>
        <button class="btn btn-ghost" data-open="${b.id}">Open booking</button>
        ${b.chicken.length ? `<button class="btn btn-ghost" data-print="${b.id}">Prep sheet</button>` : ''}
      </div>
    </div>
    <div class="nextup-r">
      <div class="nextup-num"><small>Total</small><b>${money(q.subtotal)}</b></div>
      <div class="nextup-num"><small>${b.status==='paid'?'Deposit paid':'Deposit due'}</small>
        <b class="${b.status==='paid'?'ok':'warn'}">${money(q.deposit)}</b></div>
      <div class="nextup-num"><small>Balance on the night</small><b>${money(q.balance)}</b></div>
      ${n <= 3 && b.chicken.length
        ? `<div class="nextup-tick">${skewerCount(b)} skewers to prep</div>` : ''}
    </div>
  </section>`;
}

const first  = b => esc(b.name.split(' ')[0]);
const waText = {
  confirm: b => `Hi ${b.name.split(' ')[0]}! Your yakitori night on ${prettyDate(b.date)} is confirmed. Here's your private link to choose your 7 chicken + 2 vegetable skewers: https://bincotan.example/order/${b.id}`,
  nudge:   b => `Hi ${b.name.split(' ')[0]}! Just a reminder to pick your skewers for ${prettyDate(b.date)} — here's your link: https://bincotan.example/order/${b.id}`,
  deposit: b => `Hi ${b.name.split(' ')[0]}! Got your menu, thank you. To lock in ${prettyDate(b.date)}, the 50% deposit is ${money(quote({hours:b.hours,addons:b.addons}).deposit)} via PayNow — reference ${b.id}.`,
  checkin: b => `Hi ${b.name.split(' ')[0]}! Looking forward to ${prettyDate(b.date)}. Just checking you'll have a table for the grill, lighting, and a portable gas stove ready. See you at ${b.time}.`
};
const waLink = (b, kind) =>
  `https://wa.me/${b.phone.replace(/\D/g,'')}?text=${encodeURIComponent(waText[kind](b))}`;

function bookingRow(b){
  const s = STATUSES[b.status];
  return `<button class="bk ${b.id===chefSel?'on':''}" data-bk="${b.id}">
    <div class="bk-top">
      <span class="bk-name">${esc(b.name)}</span>
      <span class="pill ${s.cls}">${s.label}</span>
    </div>
    <div class="bk-date">${shortDate(b.date)} · ${b.pax} pax · ${b.time}</div>
    ${s.todo ? `<div class="bk-todo">${s.todo}</div>` : ''}
  </button>`;
}

function bookingDetail(b){
  const q = quote({ hours:b.hours, addons:b.addons });
  const s = STATUSES[b.status];
  const chips = ids => ids.length
    ? ids.map(id => { const m = byId(id); return `<span class="mchip">
        <img src="${imgOf(m)}" alt="">${esc(m.en)}</span>`; }).join('')
    : '<span class="muted" style="font-size:.84rem">Not chosen yet</span>';

  const addonRows = Object.entries(b.addons).filter(([,n]) => n).map(([id,n]) => {
    const m = byId(id);
    return `<div class="kv"><span>${esc(m.en)}${m.price==='ask'?' <em>(to quote)</em>':''}</span>
      <b>${n} × ${m.price==='ask'?'—':money(m.price)}</b></div>`;
  }).join('');

  return `<div class="panel dpanel">
    <div class="dhead">
      <div>
        <div class="dname">${esc(b.name)}</div>
        <div class="dref">${b.id} · ${esc(b.phone)}</div>
      </div>
      <span class="pill ${s.cls}">${s.label}</span>
    </div>

    <div class="dstats">
      <div><small>When</small><b>${shortDate(b.date)} · ${b.time}</b></div>
      <div><small>Guests</small><b>${b.pax}</b></div>
      <div><small>Hours</small><b>${b.hours}</b></div>
      <div><small>Total</small><b>${money(q.subtotal)}</b></div>
    </div>

    <div class="kv"><span>Where</span><b>${esc(b.addr)}</b></div>
    ${b.notes ? `<div class="dnote"><small>Their note</small>${esc(b.notes)}</div>` : ''}

    <div class="dacts">${detailActions(b)}</div>

    <div class="dsec"><small>Their menu</small>
      <div class="mchips">${chips(b.chicken)}</div>
      <div class="mchips" style="margin-top:8px">${chips(b.veg)}</div>
    </div>

    ${addonRows ? `<div class="dsec"><small>Add-ons</small>${addonRows}
      <div class="kv" style="border-top:1px solid var(--line);margin-top:6px;padding-top:10px">
        <span>Deposit ${b.status==='paid'||b.status==='done'?'received':'due'}</span>
        <b class="${b.status==='paid'||b.status==='done'?'ok':'warn'}">${money(q.deposit)}</b></div>
    </div>` : ''}

    ${b.chicken.length ? prepPanel(b) : ''}
  </div>`;
}

function detailActions(b){
  const wa = (kind, label, cls='btn-ghost') =>
    `<a class="btn ${cls}" href="${waLink(b, kind)}" target="_blank" rel="noopener">${label}</a>`;
  switch (b.status){
    case 'req':  return `<button class="btn btn-primary" data-do="confirm" data-id="${b.id}">Confirm the date</button>
                         ${wa('confirm', `Message ${first(b)}`)}
                         <button class="btn btn-ghost danger" data-do="decline" data-id="${b.id}">Decline</button>`;
    case 'conf': return `${wa('nudge', 'Send the menu link', 'btn-primary')}
                         <button class="btn btn-ghost" data-do="menu" data-id="${b.id}">Mark menu received</button>`;
    case 'menu': return `<button class="btn btn-primary" data-do="paid" data-id="${b.id}">Mark deposit received</button>
                         ${wa('deposit', 'Ask for the deposit')}`;
    case 'paid': return `${wa('checkin', `Message ${first(b)}`, 'btn-primary')}
                         <button class="btn btn-ghost" data-print="${b.id}">Print prep sheet</button>
                         <button class="btn btn-ghost" data-do="done" data-id="${b.id}">Mark done</button>`;
    default:     return `<span class="muted" style="font-size:.84rem">Completed ${whenLabel(b.date).toLowerCase()}.</span>`;
  }
}

function prepPanel(b){
  const groups = shoppingList(b);
  const label = { chicken:'Chicken', vegetable:'Vegetable', makimono:'Makimono', premium:'Premium', sake:'Saké' };
  return `<div class="dsec prep" id="prep-${b.id}">
    <small>Prep sheet — ${esc(b.name)}, ${shortDate(b.date)}, ${b.pax} guests</small>
    ${Object.entries(groups).map(([cat, rows]) => `
      <div class="pgroup">
        <div class="pgroup-t">${label[cat] || cat}</div>
        <div class="tbl-scroll"><table class="prep-tbl"><tbody>
          ${rows.map(r => `<tr>
            <td style="width:38px"><img src="${imgOf(r.item)}" alt=""></td>
            <td>${esc(r.item.en)}<div class="muted" style="font-size:.72rem">${esc(r.item.cn)}</div></td>
            <td class="n">${r.qty} <span class="muted" style="font-size:.72rem">${
              r.item.price === null ? 'skewers' : (r.item.unit + (r.qty === 1 ? '' : 's'))}</span></td>
          </tr>`).join('')}
        </tbody></table></div>
      </div>`).join('')}
  </div>`;
}

/* ── Calendar ─────────────────────────────────────────── */
let chefMonth = (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();

function ChefCalendar(){
  return chefShell('#/chef/calendar', `
    <div class="chef-top"><div>
      <h1 class="display chef-h1">Calendar</h1>
      <p class="muted" style="font-size:.88rem">Tap an open evening to block it off. Tap a booking to open it.</p>
    </div></div>
    <div id="ccalMount">${chefCalGrid()}</div>
    <div class="cal-legend" style="margin-top:18px">
      <span><i class="dot" style="background:var(--ember)"></i>Booked</span>
      <span><i class="dot" style="background:var(--gold)"></i>Needs you</span>
      <span><i class="dot" style="background:var(--surface-2);border:1px solid var(--line)"></i>Open</span>
      <span><i class="dot" style="background:var(--line)"></i>Blocked or closed</span>
    </div>`);
}

function chefCalGrid(){
  const y = chefMonth.getFullYear(), mo = chefMonth.getMonth();
  const start = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
  const today = addDays(0), minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const cells = [];
  for (let i = 0; i < start; i++) cells.push('<div></div>');

  for (let d = 1; d <= days; d++){
    const date = new Date(y, mo, d), s = iso(date);
    const isService = SETTINGS.serviceDays.includes(date.getDay());
    const past = date < today;
    const bk = bookingOn(s);
    let cls = 'ccell', inner = `<span class="cnum">${d}</span>`, attr = '';

    if (bk){
      const needs = NEEDS_ACTION.includes(bk.status);
      cls += needs ? ' c-todo' : ' c-booked';
      inner += `<span class="cname">${esc(bk.name.split(' ')[0])}</span><span class="cpax">${bk.pax} pax</span>`;
      attr = `data-open="${bk.id}"`;
    } else if (BLOCKED.has(s)){
      cls += ' c-blocked'; inner += '<span class="cname">Blocked</span>';
      attr = past ? '' : `data-block="${s}"`;
    } else if (!isService || past){
      cls += ' c-off';
    } else {
      cls += ' c-open'; attr = `data-block="${s}"`;
    }
    cells.push(`<${attr ? 'button' : 'div'} class="${cls}" ${attr}>${inner}</${attr ? 'button' : 'div'}>`);
  }

  return `<div class="ccal">
    <div class="cal-head">
      <button type="button" id="ccPrev" ${chefMonth <= minMonth ? 'disabled' : ''}>‹</button>
      <strong>${chefMonth.toLocaleDateString('en-SG',{month:'long',year:'numeric'})}</strong>
      <button type="button" id="ccNext">›</button>
    </div>
    <div class="ccal-grid">
      ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-dow">${d}</div>`).join('')}
      ${cells.join('')}
    </div>
  </div>`;
}

/* ── Menu manager ─────────────────────────────────────── */
function ChefMenu(){
  const row = m => {
    const off = m.active === false;
    return `<div class="mrow ${off?'off':''}">
      <img src="${imgOf(m)}" alt="">
      <div class="mrow-b">
        <div class="mrow-en">${esc(m.en)}</div>
        <div class="mrow-cn">${esc(m.cn)}</div>
      </div>
      ${m.price === null
        ? '<span class="muted mrow-p">In the set</span>'
        : m.price === 'ask'
          ? '<span class="muted mrow-p">On request</span>'
          : `<label class="mrow-p price-in">$<input type="number" step="0.5" min="0"
               value="${m.price}" data-price="${m.id}" aria-label="Price for ${esc(m.en)}"></label>`}
      <button class="tog ${off?'':'on'}" data-toggle="${m.id}"
        role="switch" aria-checked="${!off}" aria-label="${off?'Show':'Hide'} ${esc(m.en)}"><i></i></button>
    </div>`;
  };
  return chefShell('#/chef/menu', `
    <div class="chef-top"><div>
      <h1 class="display chef-h1">Menu</h1>
      <p class="muted" style="font-size:.88rem">
        Change a price or switch an item off when it isn’t in season. Customers see this immediately;
        bookings already placed keep the price they were quoted.</p>
    </div></div>
    ${Object.entries(CATS).map(([k,c]) => `
      <section class="msec">
        <h2 class="msec-t">${c.label} <span class="jp muted">${c.cn}</span></h2>
        ${inCatAll(k).map(row).join('')}
      </section>`).join('')}`);
}

/* ── Settings ─────────────────────────────────────────── */
function ChefSettings(){
  const c = SETTINGS.contact, p = SETTINGS.paynow;
  const f = (label, val, hint) => `<div class="field">
    <label>${label}</label><input class="input" value="${esc(val)}" ${hint?`data-ph="1"`:''}>
    ${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
  return chefShell('#/chef/settings', `
    <div class="chef-top"><div>
      <h1 class="display chef-h1">Settings</h1>
      <p class="muted" style="font-size:.88rem">The numbers behind every quote. Change them once, here.</p>
    </div></div>
    <div class="split">
      <div class="panel">
        <div class="panel-t">Pricing</div>
        <div class="row">
          ${f('Session fee', '$' + SETTINGS.sessionFee)}
          ${f('Chef service (' + SETTINGS.chefServiceHours + ' hrs)', '$' + SETTINGS.chefServiceFee)}
        </div>
        <div class="row">
          ${f('Additional hour', '$' + SETTINGS.extraHourFee)}
          ${f('Minimum guests', SETTINGS.minPax)}
        </div>
        <div class="row">
          ${f('Deposit', SETTINGS.depositPct * 100 + '%')}
          ${f('Change cut-off', SETTINGS.cutoffHours + ' hours')}
        </div>
        <div class="field"><label>Available days</label>
          <div class="days">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i) =>
            `<span class="day ${SETTINGS.serviceDays.includes(i)?'on':''}">${d}</span>`).join('')}</div>
        </div>
      </div>
      <div>
        <div class="panel">
          <div class="panel-t">PayNow</div>
          ${f('UEN or mobile', p.uen, 'Placeholder — replace before going live.')}
          ${f('Account name', p.name, 'Shown to customers on the payment screen.')}
        </div>
        <div class="panel" style="margin-top:18px">
          <div class="panel-t">Contact</div>
          ${f('WhatsApp', c.whatsappDisplay, 'Placeholder.')}
          ${f('Notification address', c.email, 'Where new booking requests land. Placeholder.')}
          ${f('Instagram', '@' + c.instagram)}
        </div>
        <div class="notice notice-info" style="margin-top:18px"><span>◆</span><div>
          Nothing saves yet — this screen shows what Gino would control once the backend is in.</div></div>
      </div>
    </div>`);
}

/* ── wiring ───────────────────────────────────────────── */
function wireChef(h){
  const rerender = () => render();

  $$('[data-bk]').forEach(el => el.addEventListener('click', () => {
    chefSel = el.dataset.bk; rerender();
    if (window.innerWidth <= 900) $('#bkDetail')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }));

  $$('[data-filter]').forEach(el => el.addEventListener('click', () => {
    chefFilter = el.dataset.filter;
    if (el.dataset.status){
      const map = { 'a-req':'req', 'a-conf':'conf', 'a-menu':'menu' };
      chefSel = actionable().find(b => b.status === map[el.dataset.status])?.id || chefSel;
    } else chefSel = null;
    rerender();
  }));

  $$('[data-open]').forEach(el => el.addEventListener('click', () => {
    const b = bookingById(el.dataset.open);
    chefSel = b.id;
    chefFilter = NEEDS_ACTION.includes(b.status) ? 'action' : 'upcoming';
    if (h !== '#/chef') location.hash = '#/chef'; else rerender();
  }));

  $$('[data-do]').forEach(el => el.addEventListener('click', () => {
    const b = bookingById(el.dataset.id);
    const to = { confirm:'conf', menu:'menu', paid:'paid', done:'done' }[el.dataset.do];
    if (el.dataset.do === 'decline'){
      BOOKINGS.splice(BOOKINGS.indexOf(b), 1); chefSel = null;
    } else b.status = to;
    rerender();
  }));

  $$('[data-print]').forEach(el => el.addEventListener('click', () => {
    chefSel = el.dataset.print;
    chefFilter = 'upcoming';
    render();
    requestAnimationFrame(() => window.print());
  }));

  $('#ccPrev')?.addEventListener('click', () => { chefMonth.setMonth(chefMonth.getMonth()-1); rerender(); });
  $('#ccNext')?.addEventListener('click', () => { chefMonth.setMonth(chefMonth.getMonth()+1); rerender(); });
  $$('[data-block]').forEach(el => el.addEventListener('click', () => {
    const d = el.dataset.block;
    BLOCKED.has(d) ? BLOCKED.delete(d) : BLOCKED.add(d);
    rerender();
  }));

  $$('[data-toggle]').forEach(el => el.addEventListener('click', () => {
    const m = byId(el.dataset.toggle); m.active = m.active === false; rerender();
  }));
  $$('[data-price]').forEach(el => el.addEventListener('change', e => {
    const m = byId(el.dataset.price), v = parseFloat(e.target.value);
    if (!isNaN(v) && v >= 0) m.price = v;
    rerender();
  }));
}
