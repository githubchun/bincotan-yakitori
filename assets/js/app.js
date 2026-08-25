/* Bincotan Yakitori — prototype app.
   Hash-routed, no build step. In the real build these screens become Next.js routes
   and `state` lives in Postgres; the logic in pricing.js is reused verbatim. */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

/* ── state ──────────────────────────────────────────────
   The customer's in-progress date/party details live here only until they
   submit; from that moment on the booking record in the store is the truth,
   and both sides of the app read it. */
let draft = { date:null, time:'19:00', pax:SETTINGS.minPax, hours:SETTINGS.chefServiceHours,
              name:'', phone:'', addr:'', notes:'' };

/* ── shared chrome ───────────────────────────────────── */
const NAVLINKS = [['#/menu','Menu'],['#/reserve','Reserve'],['#/order','Build a Menu'],['#/chef','Chef']];

function nav(active){
  return `<header class="nav"><div class="wrap nav-in">
    <a href="#/" class="brand">
      <img src="${asset('mark-rooster')}" alt="">
      <span class="brand-txt">BINCOTAN<small>YAKITORI</small></span>
    </a>
    <button class="nav-toggle" id="navToggle" aria-label="Menu">☰</button>
    <nav class="nav-links" id="navLinks">
      ${NAVLINKS.map(([h,l]) => `<a class="lnk ${active===h?'on':''}" href="${h}">${l}</a>`).join('')}
      <a class="btn btn-primary" href="#/reserve">Reserve a night</a>
    </nav>
  </div></header>`;
}

function foot(){
  const c = SETTINGS.contact;
  return `<footer class="foot"><div class="wrap">
    <div class="foot-in">
      <div class="foot-brand" style="max-width:300px">
        <img src="${asset('cal-bincotan-light')}" alt="備長炭">
        <p class="muted" style="font-size:.85rem;line-height:1.7">Charcoal-grilled yakitori, cooked at your table.
        Private events across Singapore, Tuesday to Saturday.</p>
      </div>
      <div><h4>Explore</h4>
        ${NAVLINKS.map(([h,l]) => `<a href="${h}">${l}</a>`).join('')}
      </div>
      <div><h4>Contact</h4>
        <a href="https://instagram.com/${c.instagram}" target="_blank" rel="noopener">@${c.instagram}</a>
        <a href="https://wa.me/${c.whatsapp}" target="_blank" rel="noopener"><span class="ph" title="Placeholder — swap in the real number">${c.whatsappDisplay}</span></a>
        <a href="#/reserve">Request a date</a>
      </div>
      <div><h4>Good to know</h4>
        <a href="#/menu">Minimum 10 guests</a>
        <a href="#/menu">Tuesday to Saturday</a>
        <a href="#/reserve">50% deposit on confirmation</a>
      </div>
    </div>
    <div class="foot-note">
      <span>© ${new Date().getFullYear()} Bincotan Yakitori · Singapore</span>
      <span>Prototype — details marked <span class="ph">like this</span> are placeholders.</span>
    </div>
  </div></footer>`;
}

/* ── item cards ──────────────────────────────────────── */
function tagFor(m){
  if (m.mustTry) return '<span class="tag tag-must">Must try</span>';
  if (m.rec)     return '<span class="tag tag-rec">Chef’s pick</span>';
  if (m.price === 'ask') return '<span class="tag tag-ask">On request</span>';
  return '';
}
function priceLine(m){
  if (m.price === null) return '<div class="card-price" style="color:var(--text-3)">Included in set</div>';
  if (m.price === 'ask') return '<div class="card-price" style="color:var(--text-3)">Ask the chef</div>';
  return `<div class="card-price">+${money(m.price)} <span class="per">/ ${m.unit}</span></div>` +
         (m.min > 1 ? `<div class="card-min">min ${m.min}</div>` : '');
}
function itemCard(m, opts = {}){
  return `<article class="card ${opts.cls||''}" ${opts.attr||''}>
    <div class="card-img">
      ${tagFor(m)}${m.flag ? `<span class="flag">${m.flag}</span>` : ''}
      ${opts.pick ? '<span class="pick">✓</span>' : ''}
      <img src="${imgOf(m)}" alt="${esc(m.en)}" loading="lazy">
    </div>
    <div class="card-body">
      <div class="card-en">${esc(m.en)}</div>
      <div class="card-cn">${esc(m.cn)}</div>
      ${opts.foot !== undefined ? opts.foot : (opts.noPrice ? '' : priceLine(m))}
    </div>
  </article>`;
}
function sakeRow(m){
  return `<article class="card sake">
    <div class="sake-img"><img src="${imgOf(m)}" alt="${esc(m.en)}" loading="lazy"></div>
    <div class="sake-body">
      ${m.mustTry ? '<span class="tag tag-must" style="position:static;display:inline-block;margin-bottom:6px">Must try</span>' : ''}
      <div class="sake-en">${esc(m.en)}</div>
      <div class="sake-cn">${esc(m.cn)}</div>
      <div class="sake-meta">${esc(m.region)} · ${esc(m.size)}</div>
    </div>
    <div class="sake-price">${money(m.price)}${m.was ? `<s>${money(m.was)}</s>` : ''}</div>
  </article>`;
}

/* ══ HOME ════════════════════════════════════════════ */
function Home(){
  const heroPics = [
    ['thigh-leek', 'left:2%;  top:4%;  width:31%; --rot:-8deg;  animation-delay:0s'],
    ['tail',       'right:4%; top:0%;  width:26%; --rot:11deg;  animation-delay:.9s'],
    ['skin',       'left:26%; top:38%; width:36%; --rot:4deg;   animation-delay:1.8s'],
    ['meatball',   'right:0%; top:44%; width:33%; --rot:-5deg;  animation-delay:1.2s'],
    ['asparagus',  'left:0%;  bottom:2%;width:28%; --rot:9deg;  animation-delay:2.4s'],
    ['wagyu',      'right:12%;bottom:0%;width:30%; --rot:-12deg;animation-delay:.4s']
  ];
  const grillPicks = ['liver','heart','thigh','neck-skin','white-corn','king-prawn','shishito','wagyu','fillet','shiitake','quail-egg','baby-potato'];

  return `${nav('#/')}
  <section class="hero"><div class="wrap hero-grid">
    <div>
      <div class="eyebrow">Private Yakitori · Singapore</div>
      <div class="cn-mark jp">備長炭 焼き鳥</div>
      <h1 class="display">Yakitori is<br>an attitude.</h1>
      <p class="lede" style="margin-top:20px">One chef, one charcoal grill, set up in your home.
        Every part of the bird over binchōtan — salt, smoke, and nothing to hide behind.</p>
      <div class="hero-cta">
        <a class="btn btn-primary btn-lg" href="#/reserve">Reserve a night</a>
        <a class="btn btn-ghost btn-lg" href="#/menu">See the menu</a>
      </div>
      <div class="hero-facts">
        <div class="fact"><strong>${money(SETTINGS.sessionFee + SETTINGS.chefServiceFee)}</strong><span>From, serves ${SETTINGS.minPax}</span></div>
        <div class="fact"><strong>7 + 2</strong><span>Skewers you choose</span></div>
        <div class="fact"><strong>Tue–Sat</strong><span>Available evenings</span></div>
      </div>
    </div>
    <div class="collage">
      ${heroPics.map(([id, css]) => `<img src="${asset(id)}" alt="" style="${css}">`).join('')}
    </div>
  </div></section>

  <section class="sec"><div class="wrap">
    <div class="sec-head rv narrow">
      <div class="rule"></div><div class="eyebrow">焼き鳥匠修行 · The craft</div>
      <h2 class="display">Salt, charcoal, and one pair of hands.</h2>
      <p class="lede">Binchōtan burns hot and clean, with almost no flame. It sears the skin and leaves the
      inside alone. There's no sauce to correct a mistake and no second chef to hide behind — which is the
      whole point. Every skewer is cut, threaded and turned by Gino, in front of you.</p>
    </div>
    <div class="grid grid-6 rv">${grillPicks.map(id => itemCard(byId(id), { noPrice:true })).join('')}</div>
    <p style="margin-top:24px"><a class="btn btn-ghost" href="#/menu">All 22 set skewers, plus add-ons →</a></p>
  </div></section>

  <section class="sec" style="background:var(--ink)"><div class="wrap">
    <div class="sec-head rv"><div class="rule"></div><div class="eyebrow">How it works</div>
      <h2 class="display">Four steps, no group chat.</h2></div>
    <div class="steps rv">
      <div class="step"><div class="step-n">01</div><h3>Request your date</h3>
        <p>Pick an evening, tell us how many are coming and where. Tuesday to Saturday, minimum ${SETTINGS.minPax} guests.</p></div>
      <div class="step"><div class="step-n">02</div><h3>Gino confirms</h3>
        <p>He checks the date and comes back to you personally — usually the same day — with a private link to your menu.</p></div>
      <div class="step"><div class="step-n">03</div><h3>Build your menu</h3>
        <p>Choose your 7 chicken and 2 vegetable skewers, add wagyu, prawns or saké. The price updates as you go.</p></div>
      <div class="step"><div class="step-n">04</div><h3>Pay 50%, and eat</h3>
        <p>A 50% deposit by PayNow holds the night. Gino arrives with the grill; you handle the drinks.</p></div>
    </div>
  </div></section>

  <section class="sec"><div class="wrap">
    <div class="split-wide">
      <div class="rv">
        <div class="rule"></div><div class="eyebrow">What’s included</div>
        <h2 class="display" style="margin:12px 0 18px">${money(SETTINGS.sessionFee + SETTINGS.chefServiceFee)}, for ten.</h2>
        <div class="panel">
          <div class="line"><div><b>Yakitori session</b><div class="l-sub">Serves ${SETTINGS.minPax} guests</div></div><div class="l-amt">${money(SETTINGS.sessionFee)}</div></div>
          <div class="line"><div><b>Chef service</b><div class="l-sub">${SETTINGS.chefServiceHours} hours · ${money(SETTINGS.extraHourFee)} per additional hour</div></div><div class="l-amt">${money(SETTINGS.chefServiceFee)}</div></div>
          <div class="total"><b>From</b><span class="t-amt">${money(SETTINGS.sessionFee + SETTINGS.chefServiceFee)}</span></div>
          <p class="hint" style="margin-top:14px">Includes ${SETTINGS.includedChicken} chicken skewers and ${SETTINGS.includedVeg} vegetable
          skewers of your choosing. Add-ons — makimono, wagyu, seafood, saké — are charged on top.</p>
        </div>
        <div class="notice notice-info" style="margin-top:18px">
          <span>◆</span><div><b>Please arrange</b> a space with lighting, a table for the grill, and a portable gas stove.
          Everything else comes with Gino.</div>
        </div>
      </div>
      <div class="rv">
        <div class="panel">
          <div class="panel-t">Cancellation policy</div>
          <p style="font-size:.86rem;color:var(--text-2);line-height:1.75">
            A 50% deposit is collected once your event is confirmed.<br><br>
            To reschedule or reduce numbers without charge, let Gino know at least
            <b style="color:var(--text)">${SETTINGS.cutoffHours} hours</b> before your booking.<br><br>
            Cancellations within ${SETTINGS.cutoffHours} hours forfeit the deposit, which is non-refundable.
          </p>
        </div>
        <div class="panel" style="margin-top:18px;text-align:center">
          <img src="${asset('cal-yakitori-light')}" alt="焼き鳥" style="height:110px;margin:6px auto 18px;width:auto">
          <p class="muted" style="font-size:.85rem">Questions before you book?</p>
          <a class="btn btn-ghost" style="margin-top:12px" href="https://wa.me/${SETTINGS.contact.whatsapp}" target="_blank" rel="noopener">Message Gino</a>
        </div>
      </div>
    </div>
  </div></section>

  <section class="sec" style="background:var(--ink);text-align:center">
    <div class="wrap narrow rv">
      <img src="${asset('mark-rooster')}" alt="" style="height:88px;width:auto;margin:0 auto 24px">
      <h2 class="display">Book the grill.</h2>
      <p class="lede" style="margin:14px auto 30px">Tuesday to Saturday, across Singapore. Minimum ${SETTINGS.minPax} guests.</p>
      <a class="btn btn-primary btn-lg" href="#/reserve">Reserve a night</a>
    </div>
  </section>
  ${foot()}`;
}

/* ══ MENU ════════════════════════════════════════════ */
function Menu(){
  const sec = (key) => {
    const c = CATS[key], items = inCat(key);
    const body = key === 'sake'
      ? `<div class="grid grid-3">${items.map(sakeRow).join('')}</div>`
      : `<div class="grid grid-6">${items.map(m => itemCard(m)).join('')}</div>`;
    return `<section class="sec" id="cat-${key}" style="padding-top:40px"><div class="wrap">
      <div class="sec-head" style="margin-bottom:26px">
        <div class="rule"></div>
        <h2 class="display" style="margin-bottom:6px">${c.label} <span class="jp" style="color:var(--text-3);font-size:.6em">${c.cn}</span></h2>
        <p class="muted" style="font-size:.9rem">${c.blurb}</p>
      </div>${body}
    </div></section>`;
  };
  return `${nav('#/menu')}
  <section style="padding:56px 0 8px"><div class="wrap">
    <div class="rule"></div><div class="eyebrow">The menu · お品書き</div>
    <h1 class="display" style="font-size:clamp(2.2rem,5vw,3.4rem);margin:12px 0 14px">Everything off the grill.</h1>
    <p class="lede">Your set includes ${SETTINGS.includedChicken} chicken and ${SETTINGS.includedVeg} vegetable skewers —
    choose any from the first two sections. Everything below that is an add-on.</p>
    <div class="cat-nav" style="margin-top:28px">
      ${Object.entries(CATS).map(([k,c]) =>
        `<a class="chip" href="#cat-${k}">${c.label}<span class="cn jp">${c.cn}</span></a>`).join('')}
    </div>
  </div></section>
  ${Object.keys(CATS).map(sec).join('')}
  <section class="sec" style="text-align:center;background:var(--ink)"><div class="wrap narrow">
    <h2 class="display">Ready to pick your nine?</h2>
    <p class="lede" style="margin:12px auto 26px">Request a date first — Gino confirms, then sends you a private link to build the menu.</p>
    <a class="btn btn-primary btn-lg" href="#/reserve">Reserve a night</a>
  </div></section>
  ${foot()}`;
}

/* ══ RESERVE ═════════════════════════════════════════ */
/* Open on the first month that still has evenings to offer. */
let calMonth = (() => {
  const t = addDays(0);
  for (let i = 0; i < 12; i++){
    const m = new Date(t.getFullYear(), t.getMonth() + i, 1);
    const last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    let open = 0;
    for (const d = new Date(m); d <= last; d.setDate(d.getDate() + 1))
      if (isBookable(iso(d))) open++;
    if (open > 0) return m;
  }
  return new Date(t.getFullYear(), t.getMonth(), 1);
})();

function Reserve(){
  return `${nav('#/reserve')}
  <section style="padding:56px 0 20px"><div class="wrap">
    <div class="rule"></div><div class="eyebrow">Step 1 of 2 · Request a date</div>
    <h1 class="display" style="font-size:clamp(2.1rem,4.5vw,3.1rem);margin:12px 0 12px">When are we grilling?</h1>
    <p class="lede">A ${money(round2(SETTINGS.holdPct * minimumSpend()))} holding deposit takes the evening —
    ${SETTINGS.holdPct * 100}% of the minimum spend. You choose your skewers straight afterwards.</p>
  </div></section>
  <section style="padding-bottom:80px"><div class="wrap">
    <div class="split">
      <div>
        <div id="calMount"></div>
        <div class="notice notice-info" style="margin-top:18px">
          <span>◆</span><div>Minimum ${SETTINGS.minPax} guests or ${money(minimumSpend())}, whichever is greater.
          Available evenings are the ones Gino has opened — if a month looks closed, it isn't released yet.</div>
        </div>
      </div>
      <form id="resForm" class="panel">
        <div class="panel-t">Your details</div>
        <div class="row">
          <div class="field"><label>Guests</label>
            <input class="input" type="number" name="pax" min="${SETTINGS.minPax}" value="${draft.pax}"></div>
          <div class="field"><label>Start time</label>
            <select class="input" name="time">
              ${['17:00','18:00','18:30','19:00','19:30','20:00'].map(t =>
                `<option ${draft.time===t?'selected':''}>${t}</option>`).join('')}
            </select></div>
        </div>
        <div class="field"><label>Chef hours</label>
          <select class="input" name="hours">
            ${[4,5,6,7].map(h => `<option value="${h}" ${draft.hours==h?'selected':''}>${h} hours${
              h>4?` — +${money((h-4)*SETTINGS.extraHourFee)}`:' — included'}</option>`).join('')}
          </select>
          <div class="hint">${money(SETTINGS.extraHourFee)} per additional hour beyond ${SETTINGS.chefServiceHours}.</div>
        </div>
        <div class="row">
          <div class="field"><label>Name</label><input class="input" name="name" placeholder="Your name" value="${esc(draft.name)}"></div>
          <div class="field"><label>WhatsApp</label><input class="input" name="phone" placeholder="+65 …" value="${esc(draft.phone)}"></div>
        </div>
        <div class="field"><label>Where</label>
          <input class="input" name="addr" placeholder="Address or area" value="${esc(draft.addr)}">
          <div class="hint">Singapore-wide, no travel charge.</div></div>
        <div class="field"><label>Anything else</label>
          <textarea class="input" name="notes" placeholder="Allergies, occasion, special requests — Gino reads every one.">${esc(draft.notes)}</textarea></div>
        <div id="resErr"></div>
        <button class="btn btn-primary btn-lg" style="width:100%;margin-top:8px" type="submit">
          Hold this date · ${money(round2(SETTINGS.holdPct * minimumSpend()))}</button>
        <p class="hint" style="text-align:center;margin-top:12px">The evening is yours as soon as you book.
        You'll pay another 40% when your menu is set, and the last 50% to Gino on the night.</p>
      </form>
    </div>
  </div></section>${foot()}`;
}

function calendar(){
  const unavail = unavailableDates();
  const first = new Date(calMonth), today = addDays(0);
  const y = first.getFullYear(), mo = first.getMonth();
  const start = new Date(y, mo, 1).getDay(), days = new Date(y, mo+1, 0).getDate();
  const min = new Date(today.getFullYear(), today.getMonth(), 1);
  const cells = [];
  for (let i = 0; i < start; i++) cells.push('<div></div>');
  const released = isReleased(monthKey(iso(new Date(y, mo, 1))));
  for (let d = 1; d <= days; d++){
    const date = new Date(y, mo, d), key = iso(date);
    let cls = 'off';
    if (released && date >= today) cls = unavail.has(key) ? 'booked' : 'avail';
    if (draft.date === key) cls = 'on';
    cells.push(`<button type="button" class="cal-day ${cls}" data-d="${key}"
      ${cls==='off'||cls==='booked'?'disabled':''}>${d}</button>`);
  }
  if (!released) cells.push(`<div class="cal-closed">Gino hasn’t opened this month yet.</div>`);
  return `<div class="cal">
    <div class="cal-head">
      <button type="button" id="calPrev" ${first <= min ? 'disabled' : ''}>‹</button>
      <strong>${first.toLocaleDateString('en-SG',{month:'long',year:'numeric'})}</strong>
      <button type="button" id="calNext">›</button>
    </div>
    <div class="cal-grid">
      ${['S','M','T','W','T','F','S'].map(d => `<div class="cal-dow">${d}</div>`).join('')}
      ${cells.join('')}
    </div>
    <div class="cal-legend">
      <span><i class="dot" style="background:var(--ember)"></i>Selected</span>
      <span><i class="dot" style="background:var(--surface-2);border:1px solid var(--line)"></i>Available</span>
      <span><i class="dot" style="background:var(--line)"></i>Booked / closed</span>
    </div>
  </div>`;
}

/* ══ THANKS — pay the holding deposit ════════════════ */
function Thanks(id){
  const b = bookingById(id);
  if (!b) return NotFound('thanks/' + id);
  const p = paymentPlan(b);
  const held = stage(b) !== 'hold';

  return `${nav('#/reserve')}
  <section class="sec" style="padding-bottom:40px"><div class="wrap narrow">
    <div class="notice notice-ok" style="margin-bottom:26px"><span>✓</span><div>
      <b>${prettyDate(b.date)} is yours.</b> The evening came off the calendar the moment you booked —
      nobody else can take it.</div></div>
    <div class="rule"></div><div class="eyebrow">Reference ${b.id}</div>
    <h1 class="display" style="font-size:clamp(1.9rem,4vw,2.7rem);margin:12px 0 14px">
      ${esc(b.name.split(' ')[0])}, you’re booked.</h1>
    <p class="lede">${prettyDate(b.date)} at ${b.time} · ${b.pax} guests · ${esc(b.addr)}</p>

    <div class="panel" style="margin:28px 0 20px">
      <div class="panel-t">How the money works</div>
      <div class="sched">
        <div class="sched-r ${held ? 'ok' : 'due'}">
          <span>1 · Now, to hold the date</span><b>${money(p.hold)}</b>
          <em>${held ? 'received' : 'due'}</em></div>
        <div class="sched-r"><span>2 · When your menu is set</span><b>40%</b><em>later</em></div>
        <div class="sched-r"><span>3 · On the night, with Gino</span><b>50%</b><em>later</em></div>
      </div>
      <p class="hint" style="margin-top:14px">The holding deposit is ${SETTINGS.holdPct * 100}% of the
      ${money(minimumSpend())} minimum. Steps 2 and 3 are worked out from your final menu.</p>
    </div>

    ${held
      ? `<div class="notice notice-ok" style="margin-bottom:22px"><span>✓</span><div>
          <b>Deposit received.</b> Your menu is open — take your time.</div></div>
         <a class="btn btn-primary btn-lg" href="${orderPath(b.id)}">Choose your skewers →</a>`
      : `${payPanel(b, 'hold', p.hold, `Pay ${money(p.hold)}`,
            'Gino confirms it landed. You can start choosing your menu right away.')}
         <div class="notice notice-info" style="margin-top:22px"><span>◆</span><div>
           No need to wait — <a href="${orderPath(b.id)}" style="color:var(--ember)">start choosing your skewers</a>
           while the transfer clears.</div></div>`}
  </div></section>${foot()}`;
}

/* ══ ORDER BUILDER ═══════════════════════════════════ */

/* Landing on the private-link screen without an id: explain, and (as a prototype
   convenience) offer the confirmed bookings that a link would exist for. */
function OrderIndex(){
  const open = upcoming().filter(b => !b.completed);
  return `${nav('#/order')}
  <section class="sec"><div class="wrap narrow">
    <div class="rule"></div><div class="eyebrow">Private link</div>
    <h1 class="display" style="font-size:clamp(1.9rem,4vw,2.7rem);margin:12px 0 14px">This screen opens from Gino’s message.</h1>
    <p class="lede">Once he confirms your date he sends a link that opens your own menu.
    There's nothing to see here without one.</p>
    ${open.length ? `<div class="panel" style="margin-top:26px">
      <div class="panel-t">Bookings you can open <span class="muted" style="font-size:.74rem;font-family:var(--sans)">prototype shortcut</span></div>
      ${open.map(b => `<a class="line" style="text-decoration:none" href="${orderPath(b.id)}">
        <div><b>${esc(b.name)}</b><div class="l-sub">${shortDate(b.date)} · ${b.pax} guests · ${b.id}</div></div>
        <div class="l-amt" style="color:var(--ember)">Open →</div></a>`).join('')}
    </div>` : `<div class="notice notice-info" style="margin-top:22px"><span>◆</span><div>
      No bookings yet. <a href="#/reserve" style="color:var(--ember)">Book an evening</a> to get one.</div></div>`}
  </div></section>${foot()}`;
}

function Order(id){
  const b = bookingById(id);
  if (!b) return NotFound('order/' + id);

  const st = stage(b);
  const locked = b.menuLocked;
  const plan = paymentPlan(b);
  const extraQty = extraQtyFor(b.pax);

  const grid = (cat, included, key) => {
    const chosen = b[key];
    return `<div class="grid grid-6">${inCat(cat).map(m => {
      const i = chosen.indexOf(m.id);
      const on = i > -1;
      const extra = on && i >= included;
      return itemCard(m, {
        cls: `sel-able ${on?'on':''} ${extra?'xtra':''} ${locked?'locked':''}`,
        attr: locked ? '' : `data-pick="${key}" data-id="${m.id}" role="checkbox" tabindex="0" aria-checked="${on}"`,
        pick: true, noPrice: true,
        foot: extra
          ? `<div class="card-price">+${money(SETTINGS.extraSkewerPrice)} × ${extraQty} = ${money(SETTINGS.extraSkewerPrice*extraQty)}</div>`
          : on ? '<div class="card-price" style="color:var(--green)">Included</div>'
               : `<div class="card-price" style="color:var(--text-3)">${
                    chosen.length >= included ? `+${money(SETTINGS.extraSkewerPrice)} / skewer` : 'Included'}</div>`
      });
    }).join('')}</div>`;
  };
  const addonGrid = cat => `<div class="grid grid-4">${inCat(cat).map(m => qtyCard(m, b, locked)).join('')}</div>`;

  const overC = Math.max(0, b.chicken.length - SETTINGS.includedChicken);
  const overV = Math.max(0, b.veg.length - SETTINGS.includedVeg);

  return `${nav('#/order')}
  <section style="padding:48px 0 10px"><div class="wrap">
    <div class="rule"></div><div class="eyebrow">${esc(b.name.split(' ')[0])}’s menu · ${b.id}</div>
    <h1 class="display" style="font-size:clamp(2.1rem,4.5vw,3.1rem);margin:12px 0 12px">
      ${locked ? 'Your menu is set.' : 'Choose your nine — or more.'}</h1>
    <p class="lede">${SETTINGS.includedChicken} chicken and ${SETTINGS.includedVeg} vegetable skewers come with your set.
    Take as many extra types as you like at ${money(SETTINGS.extraSkewerPrice)} a skewer,
    ${extraQty} of each for your ${b.pax} guests.</p>

    <div class="rail" style="margin-top:28px">
      <span class="rail-s ${b.chicken.length>=7?'done':'on'}"><i>${b.chicken.length>=7?'✓':'1'}</i>Chicken</span><span class="rail-line"></span>
      <span class="rail-s ${b.veg.length>=2?'done':''}"><i>${b.veg.length>=2?'✓':'2'}</i>Vegetable</span><span class="rail-line"></span>
      <span class="rail-s"><i>3</i>Add-ons</span><span class="rail-line"></span>
      <span class="rail-s ${locked?'done':''}"><i>${locked?'✓':'4'}</i>Pay 40%</span>
    </div>

    ${locked
      ? `<div class="notice notice-ok"><span>🔒</span><div><b>Locked in.</b>
          ${st === 'set' ? 'Paid and confirmed.' : st === 'menuPaid'
            ? 'Gino is checking for your payment.'
            : `<a href="#/order/${b.id}/summary" style="color:var(--ember)">${money(plan.dueNow)} still to pay</a>.`}
          To change anything, message Gino and he'll reopen it for you.
          <a href="${waChef(b)}" target="_blank" rel="noopener" style="color:var(--ember)">Message Gino</a></div></div>`
      : `<div class="notice notice-ok"><span>✓</span><div>
          <b>${prettyDate(b.date)}</b> at ${b.time} · ${b.pax} guests · your date is held.
          Change your menu freely until you submit it.</div></div>`}
  </div></section>

  <section class="sec" style="padding:34px 0"><div class="wrap">
    <div class="sec-head" style="margin-bottom:20px"><div class="rule"></div>
      <h2 class="display" style="margin-bottom:4px">Chicken <span class="jp" style="color:var(--text-3);font-size:.55em">鶏肉</span></h2>
      <p class="muted" style="font-size:.9rem">${SETTINGS.includedChicken} included${
        overC ? ` · ${overC} extra × ${money(SETTINGS.extraSkewerPrice*extraQty)}` : ''}</p></div>
    ${grid('chicken', SETTINGS.includedChicken, 'chicken')}
  </div></section>

  <section class="sec" style="padding:34px 0"><div class="wrap">
    <div class="sec-head" style="margin-bottom:20px"><div class="rule"></div>
      <h2 class="display" style="margin-bottom:4px">Vegetable <span class="jp" style="color:var(--text-3);font-size:.55em">野菜</span></h2>
      <p class="muted" style="font-size:.9rem">${SETTINGS.includedVeg} included${
        overV ? ` · ${overV} extra × ${money(SETTINGS.extraSkewerPrice*extraQty)}` : ''}</p></div>
    ${grid('vegetable', SETTINGS.includedVeg, 'veg')}
  </div></section>

  ${['makimono','premium','sake'].map(cat => `
  <section class="sec" style="padding:34px 0;background:var(--ink)"><div class="wrap">
    <div class="sec-head" style="margin-bottom:20px"><div class="rule"></div>
      <h2 class="display" style="margin-bottom:4px">${CATS[cat].label}
        <span class="jp" style="color:var(--text-3);font-size:.55em">${CATS[cat].cn}</span></h2>
      <p class="muted" style="font-size:.9rem">${CATS[cat].blurb}</p></div>
    ${addonGrid(cat)}
  </div></section>`).join('')}

  <div class="bar"><div class="wrap bar-in" id="orderBar" data-id="${b.id}"></div></div>
  ${foot()}`;
}

const waChef = b => `https://wa.me/${SETTINGS.contact.whatsapp}?text=${encodeURIComponent(
  `Hi Gino, this is ${b.name} (${b.id}, ${prettyDate(b.date)}). I'd like to change my menu — could you reopen it?`)}`;

function qtyCard(m, b, locked){
  const q = b.addons[m.id] || 0;
  const ask = m.price === 'ask';
  return `<article class="card qcard ${q?'on':''} ${locked?'dim':''}" data-q="${m.id}">
    <div class="card-img"><img src="${imgOf(m)}" alt="${esc(m.en)}" loading="lazy"></div>
    <div class="qcard-body">
      <div class="card-en" style="font-size:.83rem">${m.flag||''} ${esc(m.en)}</div>
      <div class="card-cn" style="font-size:.72rem">${esc(m.cn)}</div>
      <div class="card-price" style="margin-top:5px">
        ${ask ? '<span style="color:var(--text-3)">Ask the chef</span>'
              : `${money(m.price)} <span class="per">/ ${m.unit}</span>${
                  m.min>1?` <span class="card-min" style="display:inline">· min ${m.min}</span>`:''}`}
      </div>
    </div>
    ${ask ? `<button class="btn btn-ghost" style="padding:8px 15px;font-size:.75rem" data-ask="${m.id}" ${locked?'disabled':''}>${q?'Requested ✓':'Request'}</button>`
          : `<div class="qty">
              <button data-step="-1" ${q && !locked?'':'disabled'}>−</button>
              <input type="number" value="${q}" min="0" data-qin="${m.id}" ${locked?'disabled':''}>
              <button data-step="1" ${locked?'disabled':''}>+</button>
            </div>`}
  </article>`;
}

function renderBar(){
  const bar = $('#orderBar'); if (!bar) return;
  const b = bookingById(bar.dataset.id); if (!b) return;
  const plan = paymentPlan(b);
  const v = validate({ chicken:b.chicken, veg:b.veg, addons:b.addons, pax:b.pax });
  const overC = b.chicken.length - SETTINGS.includedChicken;
  const overV = b.veg.length - SETTINGS.includedVeg;
  const cls = n => n === 0 ? 'done' : n > 0 ? 'xtra' : '';
  const need = [ overC < 0 ? `${-overC} chicken` : '', overV < 0 ? `${-overV} vegetable` : '' ]
                 .filter(Boolean).join(', ');

  bar.innerHTML = `
    <div class="bar-counts">
      <span class="bar-c ${cls(overC)}"><b>${b.chicken.length}</b> chicken${overC > 0 ? ` <i>+${overC}</i>` : ''}</span>
      <span class="bar-c ${cls(overV)}"><b>${b.veg.length}</b> vegetable${overV > 0 ? ` <i>+${overV}</i>` : ''}</span>
      <span class="bar-c"><b>${Object.values(b.addons).filter(Boolean).length}</b> add-ons</span>
    </div>
    <div class="bar-total"><small>Total · ${money(plan.dueNow)} due on submit</small><b>${money(plan.subtotal)}</b></div>
    <button class="btn btn-primary" id="toSummary" ${v.ok && !b.menuLocked ? '' : 'disabled'}>
      ${b.menuLocked ? 'Menu locked' : v.ok ? 'Submit &amp; pay →' : `${need} to go`}</button>`;

  $('#toSummary')?.addEventListener('click', () => {
    if (!confirm('Submit this menu?\n\nIt locks once submitted — Gino can reopen it for you if you need to change something.')) return;
    submitMenu(b.id);
    go(`#/order/${b.id}/summary`);
  });
}

/* ══ SUMMARY ═════════════════════════════════════════ */
function Summary(id){
  const b = bookingById(id);
  if (!b) return NotFound(`order/${id}/summary`);
  const p  = paymentPlan(b);
  const st = stage(b);
  const chips = (ids, included) => ids.map((x, i) => { const m = byId(x); return `
    <div class="mchip ${i >= included ? 'x' : ''}">
      <img src="${imgOf(m)}" alt=""><span>${esc(m.en)}</span>${i >= included ? '<em>extra</em>' : ''}</div>`; }).join('');

  return `${nav('#/order')}
  <section style="padding:48px 0 10px"><div class="wrap narrow">
    <div class="rule"></div><div class="eyebrow">${b.id} · ${esc(b.name)}</div>
    <h1 class="display" style="font-size:clamp(2rem,4vw,2.8rem);margin:12px 0 10px">Your night, in full.</h1>
    <p class="lede">${st === 'set' ? 'Paid to 50% and locked in — nothing left to do until the night.'
      : st === 'menuPaid' ? 'Gino is checking for your payment.'
      : `Settle ${money(p.dueNow)} now and the night is confirmed.`}</p>
  </div></section>
  <section style="padding-bottom:80px"><div class="wrap narrow">
    <div class="panel" style="margin-bottom:20px">
      <div class="panel-t">The booking</div>
      <div class="kv"><span>Date</span><b>${prettyDate(b.date)}</b></div>
      <div class="kv"><span>Time</span><b>${esc(b.time)} · ${b.hours} hours</b></div>
      <div class="kv"><span>Guests</span><b>${b.pax}</b></div>
      <div class="kv"><span>Where</span><b>${esc(b.addr) || '<span class="muted">Not set</span>'}</b></div>
      ${b.notes ? `<div class="kv"><span>Notes</span><b>${esc(b.notes)}</b></div>` : ''}
    </div>

    <div class="panel" style="margin-bottom:20px">
      <div class="panel-t">Your skewers
        ${b.menuLocked ? '<span class="muted" style="font-size:.74rem;font-family:var(--sans)">🔒 locked</span>'
                       : `<a href="${orderPath(b.id)}" style="font-size:.78rem;color:var(--ember);font-family:var(--sans)">Change</a>`}</div>
      <div style="font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--text-3);margin-bottom:9px">Chicken</div>
      <div class="mchips" style="margin-bottom:18px">${chips(b.chicken, SETTINGS.includedChicken)}</div>
      <div style="font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--text-3);margin-bottom:9px">Vegetable</div>
      <div class="mchips">${chips(b.veg, SETTINGS.includedVeg)}</div>
      ${b.menuLocked ? `<p class="hint" style="margin-top:14px">Need a change?
        <a href="${waChef(b)}" target="_blank" rel="noopener" style="color:var(--ember)">Message Gino</a> and he'll reopen it.</p>` : ''}
    </div>

    <div class="panel" style="margin-bottom:20px">
      <div class="panel-t">The bill</div>
      ${p.lines.map(l => `<div class="line"><div><b>${esc(l.label)}</b><div class="l-sub">${esc(l.sub)}</div></div>
        <div class="l-amt">${money(l.amount)}</div></div>`).join('')}
      <div class="total"><b>Total</b><span class="t-amt">${money(p.subtotal)}</span></div>
      ${p.askItems.length ? `<div class="notice notice-info" style="margin-top:14px"><span>◆</span><div>
        <b>${p.askItems.map(m => esc(m.en)).join(', ')}</b> — priced on request. Gino confirms these separately
        and they aren't in the total above.</div></div>` : ''}

      <div class="sched">
        <div class="sched-r ${p.paid >= p.hold ? 'ok' : 'wait'}">
          <span>1 · Holding deposit</span><b>${money(p.hold)}</b>
          <em>${p.paid >= p.hold ? 'received' : 'awaiting Gino'}</em></div>
        <div class="sched-r ${st === 'set' ? 'ok' : p.dueNow ? 'due' : 'wait'}">
          <span>2 · On confirming your menu</span><b>${money(Math.max(0, p.byMenu - p.hold))}</b>
          <em>${st === 'set' ? 'received' : st === 'menuPaid' ? 'awaiting Gino' : 'due now'}</em></div>
        <div class="sched-r">
          <span>3 · On the night, with Gino</span><b>${money(p.balance)}</b><em>later</em></div>
      </div>
    </div>

    ${st === 'set'
      ? `<div class="notice notice-ok"><span>✓</span><div><b>All settled to 50%.</b> Gino has ${money(p.paid)}.
          The remaining ${money(p.balance)} is paid on the night. See you on ${prettyDate(b.date)}.</div></div>`
      : st === 'menuPaid'
        ? `<div class="notice notice-info"><span>◆</span><div><b>Thanks — Gino is checking for your transfer.</b>
            Reference <b>${b.id}</b>. He'll confirm shortly.</div></div>
           <div class="notice notice-info" style="margin-top:14px"><span>◆</span><div><b>Testing the flow?</b>
            Open <a href="#/chef" style="color:var(--ember)">Gino's side</a> and confirm the payment.</div></div>`
        : p.dueNow > 0
          ? payPanel(b, 'menu', p.dueNow, `Pay ${money(p.dueNow)}`,
              `Brings you to 50% of ${money(p.subtotal)}. The rest is settled on the night.`)
          : `<div class="notice notice-ok"><span>✓</span><div>Nothing further due right now.</div></div>`}
  </div></section>${foot()}`;
}

/** The PayNow panel, used for both the holding deposit and the 40% top-up. */
function payPanel(b, kind, amount, heading, note){
  return `<div class="panel">
    <div class="panel-t">${heading} · PayNow</div>
    <div class="pay-grid">
      ${fakeQR()}
      <div style="flex:1;min-width:230px">
        <div class="kv"><span>UEN</span><b><span class="ph" title="Placeholder">${SETTINGS.paynow.uen}</span></b></div>
        <div class="kv"><span>Account</span><b><span class="ph" title="Placeholder">${SETTINGS.paynow.name}</span></b></div>
        <div class="kv"><span>Amount</span><b style="color:var(--ember)">${money(amount)}</b></div>
        <div class="kv"><span>Reference</span><b>${b.id}</b></div>
      </div>
    </div>
    <div class="drop" id="drop" style="margin-top:20px">
      <div class="ic">⇪</div>
      <p style="font-size:.88rem;margin-top:8px"><b>Upload your payment screenshot</b></p>
      <p class="hint">Gino checks it against the reference and confirms.</p>
    </div>
    <button class="btn btn-primary btn-lg" style="width:100%;margin-top:18px"
      id="markPaid" data-id="${b.id}" data-kind="${kind}" data-amount="${amount}">I've paid ${money(amount)}</button>
    <p class="hint" style="text-align:center;margin-top:10px">${note}</p>
  </div>`;
}

/* Decorative stand-in for the real PayNow QR (generated server-side in the real build). */
function fakeQR(){
  let r = 7; const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648;
  const N = 21, c = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
    const fin = (a,b) => x>=a && x<a+7 && y>=b && y<b+7 &&
      (x===a||x===a+6||y===b||y===b+6 || (x>=a+2&&x<=a+4&&y>=b+2&&y<=b+4));
    if (fin(0,0)||fin(14,0)||fin(0,14)) { c.push([x,y]); continue; }
    const inFin = (x<8&&y<8)||(x>13&&y<8)||(x<8&&y>13);
    if (!inFin && rnd() > .52) c.push([x,y]);
  }
  return `<div class="qr"><svg viewBox="0 0 21 21" shape-rendering="crispEdges" role="img" aria-label="PayNow QR placeholder">
    ${c.map(([x,y]) => `<rect x="${x}" y="${y}" width="1" height="1" fill="#111"/>`).join('')}
    <rect x="6.5" y="8.5" width="8" height="4" rx=".6" fill="#E8622A"/>
    <text x="10.5" y="11.4" font-size="2" fill="#fff" text-anchor="middle" font-family="sans-serif" font-weight="bold">DEMO</text>
  </svg></div>`;
}

/* ── router ─────────────────────────────────────────── */
const ROUTES = [
  [/^$/,                        () => Home()],
  [/^menu$/,                    () => Menu()],
  [/^reserve$/,                 () => Reserve()],
  [/^thanks\/([\w-]+)$/,         id => Thanks(id)],
  [/^order$/,                   () => OrderIndex()],
  [/^order\/([\w-]+)$/,         id => Order(id)],
  [/^order\/([\w-]+)\/summary$/, id => Summary(id)],
  [/^chef$/,                    () => ChefBookings()],
  [/^chef\/menu$/,              () => ChefMenu()],
  [/^chef\/settings$/,          () => ChefSettings()]
];
const isChef = path => path.startsWith('chef');
function go(h){ if (location.hash === h) render(); else location.hash = h; }

let lastPath = null;
function pathOf(){ return (location.hash || '#/').replace(/^#\/?/, '').split('?')[0]; }

function render(){
  let path = pathOf();

  if (path === 'reset'){ resetStore(); draft = { date:null, time:'19:00', pax:SETTINGS.minPax,
    hours:SETTINGS.chefServiceHours, name:'', phone:'', addr:'', notes:'' };
    location.replace('#/'); path = ''; }

  if (path.startsWith('cat-')){ document.getElementById(path)?.scrollIntoView({behavior:'smooth'}); return; }

  let html = null;
  for (const [re, view] of ROUTES){
    const m = path.match(re);
    if (m){ html = view(m[1]); break; }
  }
  if (html === null) html = NotFound(path);

  /* Only jump to the top when the screen actually changes. Re-rendering after a
     selection must leave the reader where they were. */
  const samePage = path === lastPath;
  const y = samePage ? window.scrollY : 0;
  lastPath = path;

  $('#app').innerHTML = demoBar(path) + html;
  wire(path);
  observe();
  /* Explicitly instant: html{scroll-behavior:smooth} would otherwise animate a
     route change, and animate the restore after a selection. */
  window.scrollTo({ top: samePage ? y : 0, behavior: 'instant' });
}

function NotFound(path){
  return `${nav('')}<section class="sec"><div class="wrap narrow" style="text-align:center">
    <div class="eyebrow">Not found</div>
    <h1 class="display" style="margin:14px 0">That link doesn’t lead anywhere.</h1>
    <p class="lede" style="margin:0 auto 26px">No page at <code>#/${esc(path)}</code>.</p>
    <a class="btn btn-primary" href="#/">Back to the start</a>
  </div></section>${foot()}`;
}

/* A prototype convenience: hop between the two points of view without hunting
   for URLs, and wipe the sample data to run the whole flow again. */
function demoBar(path){
  const chef = isChef(path);
  return `<div class="demobar">
    <span class="demobar-t">Prototype</span>
    <a class="${chef?'':'on'}" href="#/">Customer</a>
    <a class="${chef?'on':''}" href="#/chef">Gino</a>
    <button id="demoReset" title="Wipe every booking and start the flow again">Reset data</button>
    <span class="demobar-note">${chef
      ? 'Sample bookings — nothing here sends a real message.'
      : 'Bookings are saved in this browser only.'}</span>
  </div>`;
}

function wire(path){
  $('#navToggle')?.addEventListener('click', () => $('#navLinks').classList.toggle('open'));
  $('#demoReset')?.addEventListener('click', () => {
    if (confirm('Wipe every booking and start the flow again from scratch?')) go('#/reset');
  });

  if (path === 'reserve'){
    const mount = () => { $('#calMount').innerHTML = calendar(); bindCal(); };
    const bindCal = () => {
      $('#calPrev')?.addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth()-1); mount(); });
      $('#calNext')?.addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth()+1); mount(); });
      $$('.cal-day.avail, .cal-day.on').forEach(el => el.addEventListener('click', () => {
        draft.date = el.dataset.d; mount();
      }));
    };
    mount();

    $('#resForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      Object.assign(draft, f, { pax:+f.pax, hours:+f.hours });

      const errs = [];
      if (!draft.date) errs.push('Pick a date from the calendar.');
      else if (!isBookable(draft.date)) errs.push('That evening isn’t available — please pick another.');
      if (draft.pax < SETTINGS.minPax) errs.push(`Minimum ${SETTINGS.minPax} guests.`);
      if (!draft.name.trim())  errs.push('We need a name.');
      if (!draft.phone.trim()) errs.push('We need a WhatsApp number to reach you.');
      if (!draft.addr.trim())  errs.push('We need to know where you are.');
      if (errs.length){
        $('#resErr').innerHTML = `<div class="notice notice-warn" style="margin-bottom:14px"><span>!</span>
          <div><b>Almost —</b><ul>${errs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`;
        return;
      }
      if (!isBookable(draft.date)){
        $('#resErr').innerHTML = `<div class="notice notice-warn" style="margin-bottom:14px"><span>!</span>
          <div>That evening was taken while you were filling this in. Please choose another.</div></div>`;
        return;
      }
      const b = createBooking({ ...draft });
      draft = { date:null, time:'19:00', pax:SETTINGS.minPax, hours:SETTINGS.chefServiceHours,
                name:'', phone:'', addr:'', notes:'' };
      go(`#/thanks/${b.id}`);
    });
  }

  if (/^order\/[\w-]+$/.test(path)){
    const id = path.split('/')[1];

    $$('[data-pick]').forEach(el => {
      const act = () => {
        const b = bookingById(id); if (!b || b.menuLocked) return;
        const { pick, id: itemId } = el.dataset;
        /* No cap: anything past the included count is billed as an extra type. */
        const arr = b[pick].slice(), i = arr.indexOf(itemId);
        i > -1 ? arr.splice(i, 1) : arr.push(itemId);
        saveMenu(id, { [pick]: arr });
        render();
      };
      el.addEventListener('click', act);
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); act(); }
      });
    });

    $$('[data-q]').forEach(card => {
      const itemId = card.dataset.q, m = byId(itemId);
      const set = n => {
        const b = bookingById(id); if (!b) return;
        n = Math.max(0, n);
        if (n > 0 && m.min && n < m.min) n = m.min;   // first tap jumps to the minimum
        const addons = { ...b.addons };
        if (n) addons[itemId] = n; else delete addons[itemId];
        saveMenu(id, { addons });
        const inp = $('[data-qin]', card); if (inp) inp.value = n;
        card.classList.toggle('on', !!n);
        $('[data-step="-1"]', card)?.toggleAttribute('disabled', !n);
        renderBar();
      };
      const cur = () => bookingById(id)?.addons[itemId] || 0;
      $('[data-step="1"]', card)?.addEventListener('click', () => set(cur() ? cur() + 1 : (m.min || 1)));
      $('[data-step="-1"]', card)?.addEventListener('click', () => {
        const c = cur(); set(c <= (m.min || 1) ? 0 : c - 1);
      });
      $('[data-qin]', card)?.addEventListener('change', e => set(+e.target.value || 0));
      $('[data-ask]', card)?.addEventListener('click', () => { set(cur() ? 0 : 1); render(); });
    });
    renderBar();
  }

  if (/^thanks\/[\w-]+$/.test(path) || /^order\/[\w-]+\/summary$/.test(path)){
    $('#drop')?.addEventListener('click', () => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
      i.onchange = () => { if (i.files[0]) $('#drop').innerHTML =
        `<div class="ic" style="color:var(--green)">✓</div><p style="font-size:.88rem;margin-top:8px">
         <b>${esc(i.files[0].name)}</b></p><p class="hint">Ready to send with your booking.</p>`; };
      i.click();
    });
    $('#markPaid')?.addEventListener('click', e => {
      const { id, kind, amount } = e.target.dataset;
      claimPayment(id, kind, +amount); render();
    });
  }

  if (isChef(path)) wireChef(path);
}

/* reveal-on-scroll */
let io;
function observe(){
  io?.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')), { threshold:.08 });
  $$('.rv').forEach(el => {
    // Already on screen at render time? Show it now rather than waiting for a scroll.
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) el.classList.add('in');
    io.observe(el);
  });
}

window.addEventListener('hashchange', render);
render();
