/* The chef's side. A tool, not a page — scanned and operated, mostly on a phone
   between jobs. Summary before detail; state readable at a glance. */

const CHEF_TABS = [
  ['#/chef',          'Bookings'],
  ['#/chef/records',  'Records'],
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
  <main class="wrap chef-main">${body}</main>`;
}

/* ── Bookings ─────────────────────────────────────────── */
function ChefBookings(){
  const todo = actionable();
  const counts = {};
  todo.forEach(b => { const k = stage(b); counts[k] = (counts[k] || 0) + 1; });

  const list = chefFilter === 'past' ? past()
             : chefFilter === 'upcoming' ? upcoming()
             : todo;
  if (!chefSel || !list.some(b => b.id === chefSel)) chefSel = list[0]?.id || null;
  const sel = bookingById(chefSel);

  const alert = (k, label, cls) => counts[k]
    ? `<button class="alert ${cls}" data-filter="action" data-stage="${k}">
         <b>${counts[k]}</b><span>${label}</span></button>` : '';

  return chefShell('#/chef', `
    <div class="chef-top">
      <div>
        <h1 class="display chef-h1">Bookings</h1>
        <p class="muted" style="font-size:.88rem">
          ${todo.length ? `${todo.length} need${todo.length===1?'s':''} something from you.` : 'Nothing waiting on you.'}
        </p>
      </div>
      <div class="alerts">
        ${alert('hold',     counts.hold === 1 ? 'deposit to confirm' : 'deposits to confirm', 'a-req')}
        ${alert('building', 'choosing a menu', 'a-conf')}
        ${alert('menuIn',   'not paid to 50%', 'a-conf')}
        ${alert('menuPaid', 'payment to confirm', 'a-menu')}
        ${todo.length ? '' : '<span class="alert a-ok"><b>✓</b><span>all clear</span></span>'}
      </div>
    </div>

    <section class="cal-block">
      <div class="cal-block-head">
        <div>
          <div class="eyebrow">Your calendar</div>
          <p class="muted" style="font-size:.82rem;margin-top:4px">
            Release a month to let people book it, then close any evenings you want back.</p>
        </div>
        <div id="monthBtn"></div>
      </div>
      <div id="ccalMount">${chefCalGrid()}</div>
      <div class="cal-legend" style="margin-top:14px">
        <span><i class="dot" style="background:var(--ember)"></i>Booked</span>
        <span><i class="dot" style="background:var(--gold)"></i>Needs you</span>
        <span><i class="dot" style="background:var(--surface-2);border:1px solid var(--line)"></i>Open to book</span>
        <span><i class="dot" style="background:var(--line)"></i>Closed by you</span>
      </div>
    </section>

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

const first  = b => esc(b.name.split(' ')[0]);
const waText = {
  confirm: b => `Hi ${b.name.split(' ')[0]}! Your yakitori night on ${prettyDate(b.date)} is confirmed. Here's your private link to choose your 7 chicken + 2 vegetable skewers: ${orderUrl(b.id)}`,
  nudge:   b => `Hi ${b.name.split(' ')[0]}! Just a reminder to pick your skewers for ${prettyDate(b.date)} — here's your link: ${orderUrl(b.id)}`,
  deposit: b => `Hi ${b.name.split(' ')[0]}! Got your menu, thank you. To lock in ${prettyDate(b.date)}, the 50% deposit is ${money(quote({hours:b.hours,addons:b.addons}).deposit)} via PayNow — reference ${b.id}.`,
  checkin: b => `Hi ${b.name.split(' ')[0]}! Looking forward to ${prettyDate(b.date)}. Just checking you'll have a table for the grill, lighting, and a portable gas stove ready. See you at ${b.time}.`
};
const waLink = (b, kind) =>
  `https://wa.me/${b.phone.replace(/\D/g,'')}?text=${encodeURIComponent(waText[kind](b))}`;

function bookingRow(b){
  const s = statusOf(b);
  return `<button class="bk ${b.id===chefSel?'on':''}" data-bk="${b.id}">
    <div class="bk-top">
      <span class="bk-name">${esc(b.name)}</span>
      <span class="pill ${s.cls}">${s.label}</span>
    </div>
    <div class="bk-date">${shortDate(b.date)} · ${b.pax} pax · ${b.time}</div>
    ${stage(b) === 'menuPaid' || stage(b) === 'hold'
        ? `<div class="bk-todo hot">${s.todo}</div>`
        : s.todo ? `<div class="bk-todo">${s.todo}</div>` : ''}
  </button>`;
}

function bookingDetail(b){
  const p = paymentPlan(b);
  const s = statusOf(b);
  const st = stage(b);
  const chips = (ids, included) => ids.length
    ? ids.map((id, i) => { const m = byId(id); return `<span class="mchip ${i >= included ? 'x' : ''}">
        <img src="${imgOf(m)}" alt=""><span>${esc(m.en)}</span>${i >= included ? '<em>extra</em>' : ''}</span>`; }).join('')
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
      <div><small>Total</small><b>${money(p.subtotal)}</b></div>
    </div>

    <div class="kv"><span>Where</span><b>${esc(b.addr)}</b></div>
    ${b.notes ? `<div class="dnote"><small>Their note</small>${esc(b.notes)}</div>` : ''}

    <div class="dacts">${detailActions(b)}</div>
    ${!b.completed
      ? `<div class="linkbox"><small>Their private menu link</small><code>${esc(orderUrl(b.id))}</code></div>` : ''}
    ${st === 'hold' || st === 'menuPaid'
      ? `<div class="notice notice-info" style="margin-bottom:14px"><span>◆</span><div>
          <b>${esc(first(b))} says ${money(p.pending)} is sent.</b> Check PayNow for reference
          <b>${b.id}</b>, then confirm above.</div></div>` : ''}

    <div class="dsec"><small>Money</small>
      <div class="sched">
        <div class="sched-r ${p.paid >= p.hold ? 'ok' : 'due'}">
          <span>Holding deposit</span><b>${money(p.hold)}</b>
          <em>${p.paid >= p.hold ? 'in' : 'pending'}</em></div>
        <div class="sched-r ${st === 'set' ? 'ok' : p.outstanding > 0 ? 'due' : 'wait'}">
          <span>To reach 50%</span><b>${money(Math.max(0, p.byMenu - p.hold))}</b>
          <em>${st === 'set' ? 'in' : p.pending ? 'pending' : 'owed'}</em></div>
        <div class="sched-r"><span>On the night</span><b>${money(p.balance)}</b><em>later</em></div>
      </div>
      <div class="kv" style="margin-top:8px"><span>Received so far</span>
        <b class="${p.paid >= p.byMenu ? 'ok' : 'warn'}">${money(p.paid)} of ${money(p.byMenu)}</b></div>
    </div>

    <div class="dsec"><small>Their menu ${b.menuLocked ? '🔒 locked' : '· still open to them'}</small>
      <div class="mchips">${chips(b.chicken, SETTINGS.includedChicken)}</div>
      <div class="mchips" style="margin-top:8px">${chips(b.veg, SETTINGS.includedVeg)}</div>
      ${b.menuLocked && !b.completed
        ? `<button class="btn btn-ghost" style="margin-top:12px;padding:9px 16px;font-size:.78rem"
             data-unlock="${b.id}">Reopen their menu</button>
           <p class="hint" style="margin-top:8px">They can change their choices again. Anything already
           paid stays credited — only the shortfall is re-collected.</p>` : ''}
    </div>

    ${addonRows ? `<div class="dsec"><small>Add-ons</small>${addonRows}</div>` : ''}

    ${b.chicken.length ? prepPanel(b) : ''}
    ${historyPanel(b.id)}
  </div>`;
}

function detailActions(b){
  const p = paymentPlan(b);
  const wa = (kind, label, cls='btn-ghost') =>
    `<a class="btn ${cls}" href="${waLink(b, kind)}" target="_blank" rel="noopener">${label}</a>`;
  switch (stage(b)){
    case 'hold':     return `<button class="btn btn-primary" data-pay="hold" data-id="${b.id}">Confirm ${money(p.hold)} landed</button>
                             ${wa('confirm', `Message ${first(b)}`)}
                             <button class="btn btn-ghost danger" data-do="decline" data-id="${b.id}">Cancel booking</button>`;
    case 'building': return `${wa('nudge', 'Nudge them to pick', 'btn-primary')}
                             <a class="btn btn-ghost" href="${orderPath(b.id)}">Open their menu</a>`;
    case 'menuIn':   return `${wa('deposit', `Ask for ${money(p.dueNow)}`, 'btn-primary')}
                             <button class="btn btn-ghost" data-pay="menu" data-id="${b.id}">Mark ${money(p.dueNow)} received</button>`;
    case 'menuPaid': return `<button class="btn btn-primary" data-pay="menu" data-id="${b.id}">Confirm ${money(p.pending)} landed</button>
                             ${wa('deposit', `Message ${first(b)}`)}`;
    case 'set':      return `${wa('checkin', `Message ${first(b)}`, 'btn-primary')}
                             <button class="btn btn-ghost" data-print="${b.id}">Print prep sheet</button>
                             <button class="btn btn-ghost" data-done="${b.id}">Mark done</button>`;
    default:         return `<span class="muted" style="font-size:.84rem">Completed ${whenLabel(b.date).toLowerCase()}.</span>`;
  }
}

/** What happened to this booking, oldest first. Read-only, always. */
function historyPanel(ref){
  const evs = logFor(ref);
  if (!evs.length) return '';
  return `<div class="dsec"><small>History · ${evs.length} record${evs.length===1?'':'s'}</small>
    <ol class="tl">
      ${evs.map(e => {
        const m = EVENTS[e.kind] || { label:e.kind, actor:'system' };
        return `<li class="tl-i ${m.keep ? 'keep' : ''}">
          <div class="tl-h">
            <span class="tl-l">${m.label}</span>
            <span class="tl-t">${new Date(e.at).toLocaleString('en-SG',{dateStyle:'medium',timeStyle:'short'})}</span>
          </div>
          <div class="tl-s">${esc(e.summary)}</div>
          <button class="tl-m" data-mail="${e.seq}">View the email that was sent →</button>
        </li>`;
      }).join('')}
    </ol>
    <p class="hint" style="margin-top:10px">Entries are never edited or deleted. Each is chained
    to the one before it, and a copy of every one is emailed to
    <span class="ph">${esc(SETTINGS.records.inbox)}</span>.</p>
  </div>`;
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

function monthControl(){
  const m = monthKey(iso(chefMonth));
  const open = isReleased(m);
  const label = chefMonth.toLocaleDateString('en-SG', { month:'long' });
  return `<button class="btn ${open ? 'btn-ghost' : 'btn-primary'}" data-month="${m}">
    ${open ? `Close ${label}` : `Release ${label}`}</button>`;
}

function chefCalGrid(){
  const y = chefMonth.getFullYear(), mo = chefMonth.getMonth();
  const start = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
  const today = addDays(0), minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const m = monthKey(iso(new Date(y, mo, 1)));
  const released = isReleased(m);
  const cells = [];
  for (let i = 0; i < start; i++) cells.push('<div></div>');

  for (let d = 1; d <= days; d++){
    const date = new Date(y, mo, d), key = iso(date);
    const past = date < today;
    const bk = bookingOn(key);
    let cls = 'ccell', inner = `<span class="cnum">${d}</span>`, attr = '';

    if (bk){
      cls += NEEDS_ACTION.includes(stage(bk)) ? ' c-todo' : ' c-booked';
      inner += `<span class="cname">${esc(bk.name.split(' ')[0])}</span><span class="cpax">${bk.pax} pax</span>`;
      attr = `data-open="${bk.id}"`;
    } else if (!released || past){
      cls += ' c-off';
    } else if (isBlocked(key)){
      cls += ' c-blocked'; inner += '<span class="cname">Closed</span>';
      attr = `data-block="${key}"`;
    } else {
      cls += ' c-open'; attr = `data-block="${key}"`;
    }
    cells.push(`<${attr ? 'button' : 'div'} class="${cls}" ${attr}>${inner}</${attr ? 'button' : 'div'}>`);
  }

  return `<div class="ccal ${released ? '' : 'closed'}">
    <div class="cal-head">
      <button type="button" id="ccPrev" ${chefMonth <= minMonth ? 'disabled' : ''}>‹</button>
      <strong>${chefMonth.toLocaleDateString('en-SG',{month:'long',year:'numeric'})}
        ${released ? '' : '<span class="mclosed">not released</span>'}</strong>
      <button type="button" id="ccNext">›</button>
    </div>
    <div class="ccal-grid">
      ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<div class="cal-dow">${d}</div>`).join('')}
      ${cells.join('')}
    </div>
    ${released ? '' : `<p class="cal-closed" style="padding:14px 0 2px">
      Nobody can book this month until you release it.</p>`}
  </div>`;
}

/* ── Records ──────────────────────────────────────────
   The whole log, newest first, with the chain checked on every view. */
let recFilter = '';
let mailOpen  = null;

function ChefRecords(){
  const all = ledger();
  const v = chainState();
  const refs = [...new Set(all.map(e => e.ref).filter(Boolean))].sort().reverse();
  const evs = (recFilter ? all.filter(e => e.ref === recFilter) : all).slice().reverse();

  return chefShell('#/chef/records', `
    <div class="chef-top"><div>
      <h1 class="display chef-h1">Records</h1>
      <p class="muted" style="font-size:.88rem">Every booking, menu and payment, in the order it happened.
      Nothing here can be edited or removed — not by you, not by a customer.</p>
    </div></div>

    <div class="chain ${v.ok ? 'ok' : 'bad'}">
      <div class="chain-i">${v.ok ? '✓' : '!'}</div>
      <div>
        <b>${v.ok ? 'All ' + v.checked + ' entries verified' : 'Record altered at entry ' + v.brokenAt}</b>
        <div class="chain-s">${v.ok
          ? 'Each entry carries the fingerprint of the one before it, and every fingerprint matches. Nothing has been changed since it was written.'
          : esc(v.reason) + '. Entries before that point are still trustworthy.'}</div>
      </div>
      <div class="chain-a">
        <button class="btn btn-ghost" id="recCopy">Copy all</button>
        <button class="btn btn-ghost" id="recDownload">Download</button>
      </div>
    </div>

    <div class="cfilters" style="margin:20px 0 16px">
      <button class="chip ${recFilter ? '' : 'on'}" data-ref="">Everything (${all.length})</button>
      ${refs.map(r => `<button class="chip ${recFilter===r?'on':''}" data-ref="${r}">${r}</button>`).join('')}
    </div>

    <div class="recs">
      ${evs.length ? evs.map(e => recRow(e)).join('')
        : '<div class="notice notice-info"><span>◆</span><div>Nothing recorded for that booking.</div></div>'}
    </div>`);
}

function recRow(e){
  const m = EVENTS[e.kind] || { label:e.kind, actor:'system' };
  const open = mailOpen === e.seq;
  const mail = emailFor(e, bookingById(e.ref));
  return `<article class="rec ${m.keep ? 'keep' : ''} ${open ? 'open' : ''}">
    <div class="rec-h">
      <span class="rec-n">#${e.seq}</span>
      <span class="rec-l">${m.label}</span>
      <span class="rec-ref">${e.ref || '—'}</span>
      <span class="rec-t">${new Date(e.at).toLocaleString('en-SG',{dateStyle:'medium',timeStyle:'short'})}</span>
      <span class="rec-by">${m.actor}</span>
    </div>
    <div class="rec-s">${esc(e.summary)}</div>
    <div class="rec-f">
      <code title="This entry's fingerprint">${e.hash.slice(0,16)}…</code>
      <button class="tl-m" data-mail="${e.seq}">${open ? 'Hide the email' : 'View the email that was sent'}</button>
    </div>
    ${open ? `<div class="mail">
      <div class="mail-h"><span>To</span><b>${esc(mail.to)}</b></div>
      <div class="mail-h"><span>Subject</span><b>${esc(mail.subject)}</b></div>
      <pre class="mail-b">${esc(mail.body)}</pre>
      <button class="btn btn-ghost" data-mailcopy="${e.seq}" style="margin-top:10px">Copy this email</button>
    </div>` : ''}
  </article>`;
}

/* ── Menu manager ─────────────────────────────────────── */
/* Three bits of screen state. None of it is persisted — it is what Gino is
   part-way through doing, not something he has decided. */
let addingIn  = null;   // category whose add form is open
let removeAsk = null;   // item id waiting on an inline yes/no
let removedTip = null;  // { item, action } — the undo strip after a removal

const UNITS = ['skewer','pc','order','pax','bottle','box'];

/* Chicken and vegetables come with the set; everything else carries a price. */
const defaultMode = cat => (cat === 'chicken' || cat === 'vegetable') ? 'set' : 'fixed';

function removeConfirm(m){
  const used = itemInUse(m.id);
  return `<div class="mconfirm">
    <p>${used.length
      ? `<b>${used.length} booking${used.length === 1 ? '' : 's'}</b> already ${
          used.length === 1 ? 'lists' : 'list'} this — ${
          esc(used.map(b => b.name).join(', '))}. It comes off both menus, but stays on
         ${used.length === 1 ? 'that bill' : 'those bills'} at the price they were quoted.`
      : `Nothing has been ordered with this. It will be deleted.`}</p>
    <div class="mconfirm-a">
      <button class="btn btn-sm" data-rmyes="${m.id}">${used.length ? 'Retire it' : 'Delete it'}</button>
      <button class="btn btn-ghost btn-sm" data-rmno="1">Keep it</button>
    </div>
  </div>`;
}

function addForm(cat){
  const mode = defaultMode(cat);
  const opt = (v, label) => `<option value="${v}"${v === mode ? ' selected' : ''}>${label}</option>`;
  return `<form class="madd" data-addcat="${cat}" data-mode="${mode}">
    <div class="madd-g">
      <label class="madd-f">Name<input name="en" required maxlength="60" autocomplete="off" placeholder="Okra"></label>
      <label class="madd-f">Japanese / Chinese<input name="cn" maxlength="60" autocomplete="off" placeholder="秋葵"></label>
    </div>
    <div class="madd-g">
      <label class="madd-f">Charged<select name="mode">
        ${opt('fixed','At a price')}${opt('set','Included in the set')}${opt('ask','Quoted on request')}
      </select></label>
      <label class="madd-f madd-p">Price<input name="price" type="number" step="0.5" min="0" value="5"></label>
      <label class="madd-f madd-p">Per<select name="unit">${
        UNITS.map(u => `<option${u === 'skewer' ? ' selected' : ''}>${u}</option>`).join('')}</select></label>
      <label class="madd-f madd-p">Minimum<input name="min" type="number" step="1" min="1" value="10"></label>
    </div>
    <label class="madd-rec"><input type="checkbox" name="rec"> Chef’s pick</label>
    <p class="madd-err" data-adderr hidden></p>
    <div class="madd-a">
      <button class="btn btn-sm" type="submit">Add to ${CATS[cat].label}</button>
      <button class="btn btn-ghost btn-sm" type="button" data-addcancel="1">Cancel</button>
    </div>
  </form>`;
}

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
      <button class="mrow-x" data-rm="${m.id}" aria-label="Remove ${esc(m.en)}">&times;</button>
    </div>
    ${removeAsk === m.id ? removeConfirm(m) : ''}`;
  };

  const retiredBlock = cat => {
    const gone = retiredIn(cat);
    if (!gone.length) return '';
    return `<details class="mret">
      <summary>${gone.length} retired item${gone.length === 1 ? '' : 's'}</summary>
      <p class="mret-w">Off both menus. Kept only so the bookings that ordered them still add up.</p>
      ${gone.map(m => `<div class="mrow off">
        <img src="${imgOf(m)}" alt="">
        <div class="mrow-b">
          <div class="mrow-en">${esc(m.en)}</div>
          <div class="mrow-cn">${esc(itemInUse(m.id).map(b => b.id).join(', ')) || '—'}</div>
        </div>
        <button class="btn btn-ghost btn-sm" data-restore="${m.id}">Put it back</button>
      </div>`).join('')}
    </details>`;
  };

  return chefShell('#/chef/menu', `
    <div class="chef-top"><div>
      <h1 class="display chef-h1">Menu</h1>
      <p class="muted" style="font-size:.88rem">
        Change a price, switch an item off when it isn’t in season, or add one of your own.
        Customers see this immediately; bookings already placed keep the price they were quoted.</p>
    </div></div>
    ${removedTip ? `<div class="mundo">
      <span><b>${esc(removedTip.item.en)}</b> ${removedTip.action === 'retired' ? 'retired' : 'removed'}.</span>
      <button class="btn btn-ghost btn-sm" data-undo="1">Undo</button>
    </div>` : ''}
    ${Object.entries(CATS).map(([k,c]) => `
      <section class="msec">
        <h2 class="msec-t">${c.label} <span class="jp muted">${c.cn}</span></h2>
        ${inCatAll(k).map(row).join('')}
        ${addingIn === k ? addForm(k) : `<button class="madd-o" data-add="${k}">+ Add an item</button>`}
        ${retiredBlock(k)}
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
          ${f('Extra skewer', '$' + SETTINGS.extraSkewerPrice, 'Placeholder — per skewer, beyond the included 7 + 2.')}
          ${f('Minimum per extra type', SETTINGS.extraSkewerMinQty + ' skewers')}
        </div>
        <div class="row">
          ${f('To hold a date', SETTINGS.holdPct * 100 + '% of ' + money(minimumSpend()))}
          ${f('Paid by menu confirmation', SETTINGS.byMenuPct * 100 + '% of the total')}
        </div>
        ${f('Change cut-off', SETTINGS.cutoffHours + ' hours')}
        <div class="notice notice-info" style="margin-top:4px"><span>◆</span><div>
          Availability is no longer a fixed set of weekdays. You release a month on the
          Bookings screen, then close whichever evenings you want back.</div></div>
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
function wireChef(path){
  const rerender = () => render();

  $$('[data-bk]').forEach(el => el.addEventListener('click', () => {
    chefSel = el.dataset.bk; rerender();
    if (window.innerWidth <= 900) $('#bkDetail')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }));

  $$('[data-filter]').forEach(el => el.addEventListener('click', () => {
    chefFilter = el.dataset.filter;
    if (el.dataset.stage) chefSel = actionable().find(b => stage(b) === el.dataset.stage)?.id || chefSel;
    else chefSel = null;
    rerender();
  }));

  $$('[data-open]').forEach(el => el.addEventListener('click', () => {
    const b = bookingById(el.dataset.open);
    chefSel = b.id;
    chefFilter = NEEDS_ACTION.includes(stage(b)) ? 'action' : (b.completed ? 'past' : 'upcoming');
    rerender();
    $('#bkDetail')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }));

  $$('[data-pay]').forEach(el => el.addEventListener('click', () => {
    confirmPayment(el.dataset.id, el.dataset.pay); rerender();
  }));
  $$('[data-done]').forEach(el => el.addEventListener('click', () => {
    markComplete(el.dataset.done); rerender();
  }));
  $$('[data-unlock]').forEach(el => el.addEventListener('click', () => {
    if (!confirm('Reopen this menu?\n\nThey can change their choices again. Anything already confirmed stays credited.')) return;
    reopenMenu(el.dataset.unlock); rerender();
  }));
  $$('[data-do=decline]').forEach(el => el.addEventListener('click', () => {
    if (!confirm('Cancel this booking and free the evening?')) return;
    declineBooking(el.dataset.id); chefSel = null; rerender();
  }));

  $$('[data-copy]').forEach(el => el.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(orderUrl(el.dataset.copy)); el.textContent = 'Copied ✓'; }
    catch { el.textContent = 'Copy failed — select it below'; }
    setTimeout(() => { el.textContent = 'Copy link'; }, 2200);
  }));

  $$('[data-print]').forEach(el => el.addEventListener('click', () => {
    chefSel = el.dataset.print; render();
    requestAnimationFrame(() => window.print());
  }));

  /* calendar */
  $('#monthBtn') && ($('#monthBtn').innerHTML = monthControl());
  $('#ccPrev')?.addEventListener('click', () => { chefMonth.setMonth(chefMonth.getMonth()-1); rerender(); });
  $('#ccNext')?.addEventListener('click', () => { chefMonth.setMonth(chefMonth.getMonth()+1); rerender(); });
  $$('[data-month]').forEach(el => el.addEventListener('click', () => {
    toggleMonth(el.dataset.month); rerender();
  }));
  $$('[data-block]').forEach(el => el.addEventListener('click', () => {
    toggleBlocked(el.dataset.block); rerender();
  }));

  /* records */
  $$('[data-ref]').forEach(el => el.addEventListener('click', () => {
    recFilter = el.dataset.ref; mailOpen = null; rerender();
  }));
  $$('[data-mail]').forEach(el => el.addEventListener('click', () => {
    const n = +el.dataset.mail;
    mailOpen = mailOpen === n ? null : n;
    if (pathOf() !== 'chef/records'){ recFilter = ''; location.hash = '#/chef/records'; }
    else rerender();
  }));
  $$('[data-mailcopy]').forEach(el => el.addEventListener('click', async () => {
    const e = ledger().find(x => x.seq === +el.dataset.mailcopy);
    const m = emailFor(e, bookingById(e.ref));
    try { await navigator.clipboard.writeText(`To: ${m.to}\nSubject: ${m.subject}\n\n${m.body}`);
          el.textContent = 'Copied ✓'; }
    catch { el.textContent = 'Copy failed — select the text above'; }
    setTimeout(() => { el.textContent = 'Copy this email'; }, 2200);
  }));
  $('#recCopy')?.addEventListener('click', async e => {
    try { await navigator.clipboard.writeText(ledgerText(ledger(), bookingById));
          e.target.textContent = 'Copied ✓'; }
    catch { e.target.textContent = 'Copy failed'; }
    setTimeout(() => { e.target.textContent = 'Copy all'; }, 2200);
  });
  $('#recDownload')?.addEventListener('click', () => {
    const blob = new Blob([ledgerText(ledger(), bookingById)], { type:'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bincotan-records-${iso(new Date())}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  /* menu manager — every one of these goes through the store, so it survives a
     reload and shows up in the record. Nothing here edits MENU directly. */
  const menuDid = fn => { removedTip = null; removeAsk = null; fn(); rerender(); };

  $$('[data-toggle]').forEach(el => el.addEventListener('click', () =>
    menuDid(() => toggleItem(el.dataset.toggle))));

  $$('[data-price]').forEach(el => el.addEventListener('change', e =>
    menuDid(() => setItemPrice(el.dataset.price, parseFloat(e.target.value)))));

  $$('[data-rm]').forEach(el => el.addEventListener('click', () => {
    removedTip = null;
    removeAsk = removeAsk === el.dataset.rm ? null : el.dataset.rm;
    rerender();
  }));
  $('[data-rmno]')?.addEventListener('click', () => { removeAsk = null; rerender(); });
  $$('[data-rmyes]').forEach(el => el.addEventListener('click', () => {
    const out = removeMenuItem(el.dataset.rmyes);
    removeAsk = null;
    removedTip = out ? { item:out.item, action:out.action } : null;
    rerender();
  }));
  $('[data-undo]')?.addEventListener('click', () => {
    const { item, action } = removedTip;
    action === 'retired' ? restoreItem(item.id) : undoRemove(item);
    removedTip = null;
    rerender();
  });
  $$('[data-restore]').forEach(el => el.addEventListener('click', () =>
    menuDid(() => restoreItem(el.dataset.restore))));

  /* add form */
  $$('[data-add]').forEach(el => el.addEventListener('click', () => {
    removedTip = null; removeAsk = null;
    addingIn = el.dataset.add;
    rerender();
  }));
  $('[data-addcancel]')?.addEventListener('click', () => { addingIn = null; rerender(); });

  const form = $('[data-addcat]');
  if (form) {
    /* Show the price fields only when there is a price. Done without a rerender
       so whatever he has already typed stays put. */
    form.mode.addEventListener('change', () => { form.dataset.mode = form.mode.value; });
    form.en.focus();
    form.addEventListener('submit', e => {
      e.preventDefault();
      const err = $('[data-adderr]');
      const say = msg => { err.textContent = msg; err.hidden = false; };
      const en = form.en.value.trim();
      if (!en) return say('It needs a name.');

      const mode  = form.mode.value;
      const price = mode === 'set' ? null : mode === 'ask' ? 'ask' : parseFloat(form.price.value);
      if (mode === 'fixed' && !(price >= 0)) return say('Give it a price, or change how it is charged.');

      const min = parseInt(form.min.value, 10);
      addMenuItem({ cat: form.dataset.addcat, en, cn: form.cn.value.trim(), price,
                    unit: mode === 'fixed' ? form.unit.value : undefined,
                    min:  mode === 'fixed' && min > 1 ? min : undefined,
                    rec:  form.rec.checked });
      addingIn = null;
      rerender();
    });
  }
}
