/* Bincotan Yakitori — prototype app.
   Hash-routed, no build step. In the real build these screens become Next.js routes
   and `state` lives in Postgres; the logic in pricing.js is reused verbatim. */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

/* ── state ───────────────────────────────────────────── */
const DEFAULT = {
  booking: { date:null, time:'19:00', pax:10, hours:4, name:'', phone:'', address:'', notes:'' },
  order:   { chicken:[], veg:[], addons:{} },
  paid:    false
};
let state = load();
if (safeSearch().includes('demo') && !state.order.chicken.length) seedDemo();
function seedDemo(){
  const d = new Date(); d.setDate(d.getDate() + 21);
  while (!SETTINGS.serviceDays.includes(d.getDay())) d.setDate(d.getDate() + 1);
  state.booking = { date: iso(d), time:'19:00', pax:12, hours:5,
    name:'Rachel Tan', phone:'+65 9123 4567', address:'42 Jalan Kayu, Singapore',
    notes:'One guest is allergic to shellfish. It’s my father’s 60th.' };
  state.order = { chicken:['thigh-leek','skin','tail','meatball','liver','wing','neck'],
    veg:['asparagus','white-corn'],
    addons:{ 'pb-shisho':12, 'wagyu':10, 'king-prawn':12, 'sake-dassai-23':1, 'uni':1 } };
  state.paid = false; save();
}
function load(){ try { return { ...structuredClone(DEFAULT), ...JSON.parse(localStorage.getItem('bincotan') || '{}') }; }
                 catch { return structuredClone(DEFAULT); } }
function safeSearch(){ try { return location.search || ''; } catch { return ''; } }
/* Sandboxed embeds can block storage entirely — the app must still work without it. */
function save(){ try { localStorage.setItem('bincotan', JSON.stringify(state)); } catch {} }
function reset(){ state = structuredClone(DEFAULT); save(); go('#/'); }

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
      ${opts.noPrice ? '' : priceLine(m)}
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
/* Open on the current month, unless it has almost nothing left to offer. */
const calMonth = (() => {
  const t = new Date(); t.setHours(0,0,0,0);
  const m = new Date(t.getFullYear(), t.getMonth(), 1);
  let open = 0, d = new Date(t);
  const end = new Date(t.getFullYear(), t.getMonth() + 1, 0);
  for (; d <= end; d.setDate(d.getDate() + 1))
    if (SETTINGS.serviceDays.includes(d.getDay()) && !unavailableDates().has(iso(d))) open++;
  if (open < 3) m.setMonth(m.getMonth() + 1);
  return m;
})();

function Reserve(){
  return `${nav('#/reserve')}
  <section style="padding:56px 0 20px"><div class="wrap">
    <div class="rule"></div><div class="eyebrow">Step 1 of 2 · Request a date</div>
    <h1 class="display" style="font-size:clamp(2.1rem,4.5vw,3.1rem);margin:12px 0 12px">When are we grilling?</h1>
    <p class="lede">Nothing is charged yet. Gino confirms your date personally, then sends a private link
    where you choose your skewers.</p>
  </div></section>
  <section style="padding-bottom:80px"><div class="wrap">
    <div class="split">
      <div>
        <div id="calMount"></div>
        <div class="notice notice-info" style="margin-top:18px">
          <span>◆</span><div>Evenings only, Tuesday to Saturday. Minimum ${SETTINGS.minPax} guests
          or ${money(SETTINGS.sessionFee + SETTINGS.chefServiceFee)}, whichever is greater.</div>
        </div>
      </div>
      <form id="resForm" class="panel">
        <div class="panel-t">Your details</div>
        <div class="row">
          <div class="field"><label>Guests</label>
            <input class="input" type="number" name="pax" min="${SETTINGS.minPax}" value="${state.booking.pax}"></div>
          <div class="field"><label>Start time</label>
            <select class="input" name="time">
              ${['17:00','18:00','18:30','19:00','19:30','20:00'].map(t =>
                `<option ${state.booking.time===t?'selected':''}>${t}</option>`).join('')}
            </select></div>
        </div>
        <div class="field"><label>Chef hours</label>
          <select class="input" name="hours">
            ${[4,5,6,7].map(h => `<option value="${h}" ${state.booking.hours==h?'selected':''}>${h} hours${h>4?` — +${money((h-4)*SETTINGS.extraHourFee)}`:' — included'}</option>`).join('')}
          </select>
          <div class="hint">${money(SETTINGS.extraHourFee)} per additional hour beyond ${SETTINGS.chefServiceHours}.</div>
        </div>
        <div class="row">
          <div class="field"><label>Name</label><input class="input" name="name" placeholder="Your name" value="${esc(state.booking.name)}"></div>
          <div class="field"><label>WhatsApp</label><input class="input" name="phone" placeholder="+65 …" value="${esc(state.booking.phone)}"></div>
        </div>
        <div class="field"><label>Where</label>
          <input class="input" name="address" placeholder="Address or area" value="${esc(state.booking.address)}">
          <div class="hint">Singapore-wide, no travel charge.</div></div>
        <div class="field"><label>Anything else</label>
          <textarea class="input" name="notes" placeholder="Allergies, occasion, special requests — Gino reads every one.">${esc(state.booking.notes)}</textarea></div>
        <div id="resErr"></div>
        <button class="btn btn-primary btn-lg" style="width:100%;margin-top:8px" type="submit">Request this date</button>
        <p class="hint" style="text-align:center;margin-top:12px">No payment now. You'll hear back from Gino directly.</p>
      </form>
    </div>
  </div></section>${foot()}`;
}

function calendar(){
  const unavail = unavailableDates();
  const first = new Date(calMonth), today = new Date(); today.setHours(0,0,0,0);
  const y = first.getFullYear(), mo = first.getMonth();
  const start = new Date(y, mo, 1).getDay(), days = new Date(y, mo+1, 0).getDate();
  const min = new Date(today.getFullYear(), today.getMonth(), 1);
  const cells = [];
  for (let i = 0; i < start; i++) cells.push('<div></div>');
  for (let d = 1; d <= days; d++){
    const date = new Date(y, mo, d), s = iso(date);
    let cls = 'off';
    if (date >= today && SETTINGS.serviceDays.includes(date.getDay())) cls = unavail.has(s) ? 'booked' : 'avail';
    if (state.booking.date === s) cls = 'on';
    cells.push(`<button type="button" class="cal-day ${cls}" data-d="${s}" ${cls==='off'||cls==='booked'?'disabled':''}>${d}</button>`);
  }
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

/* ══ ORDER BUILDER ═══════════════════════════════════ */
function Order(){
  const o = state.order;
  const grid = (cat, limit, key) => {
    const full = o[key].length >= limit;
    return `<div class="grid grid-6">${inCat(cat).map(m => {
      const on = o[key].includes(m.id);
      return itemCard(m, {
        cls: `sel-able ${on?'on':''} ${!on && full ? 'dim':''}`,
        attr: `data-pick="${key}" data-id="${m.id}" role="checkbox" tabindex="0" aria-checked="${on}"`,
        pick: true, noPrice: m.price !== 'ask'
      });
    }).join('')}</div>`;
  };
  const addonGrid = cat => `<div class="grid grid-4">${inCat(cat).map(qtyCard).join('')}</div>`;

  return `${nav('#/order')}
  <section style="padding:48px 0 10px"><div class="wrap">
    <div class="rule"></div><div class="eyebrow">Step 2 of 2 · Your private menu</div>
    <h1 class="display" style="font-size:clamp(2.1rem,4.5vw,3.1rem);margin:12px 0 12px">Choose your nine.</h1>
    <p class="lede">${SETTINGS.includedChicken} chicken and ${SETTINGS.includedVeg} vegetable skewers are included in your set.
    Everything after that is an add-on — the total updates as you go.</p>
    <div class="rail" style="margin-top:28px">
      <span class="rail-s ${o.chicken.length===7?'done':'on'}"><i>${o.chicken.length===7?'✓':'1'}</i>Chicken</span><span class="rail-line"></span>
      <span class="rail-s ${o.veg.length===2?'done':''}"><i>${o.veg.length===2?'✓':'2'}</i>Vegetable</span><span class="rail-line"></span>
      <span class="rail-s"><i>3</i>Add-ons</span><span class="rail-line"></span>
      <span class="rail-s"><i>4</i>Confirm</span>
    </div>
    ${state.booking.date ? `<div class="notice notice-ok" style="margin-bottom:8px"><span>✓</span><div>
      <b>${prettyDate(state.booking.date)}</b> at ${state.booking.time} · ${state.booking.pax} guests · confirmed by Gino.
      You can change your menu until ${SETTINGS.cutoffHours} hours before.</div></div>`
    : `<div class="notice notice-info"><span>◆</span><div>You haven't picked a date yet — in the real site you'd
       arrive here from Gino's private link. <a href="#/reserve" style="color:var(--ember)">Request a date</a>,
       or keep exploring the builder.</div></div>`}
  </div></section>

  <section class="sec" style="padding:34px 0"><div class="wrap">
    <div class="sec-head" style="margin-bottom:20px"><div class="rule"></div>
      <h2 class="display" style="margin-bottom:4px">Chicken <span class="jp" style="color:var(--text-3);font-size:.55em">鶏肉</span></h2>
      <p class="muted" style="font-size:.9rem">Choose exactly ${SETTINGS.includedChicken}.</p></div>
    ${grid('chicken', SETTINGS.includedChicken, 'chicken')}
  </div></section>

  <section class="sec" style="padding:34px 0"><div class="wrap">
    <div class="sec-head" style="margin-bottom:20px"><div class="rule"></div>
      <h2 class="display" style="margin-bottom:4px">Vegetable <span class="jp" style="color:var(--text-3);font-size:.55em">野菜</span></h2>
      <p class="muted" style="font-size:.9rem">Choose exactly ${SETTINGS.includedVeg}.</p></div>
    ${grid('vegetable', SETTINGS.includedVeg, 'veg')}
  </div></section>

  <section class="sec" style="padding:34px 0;background:var(--ink)"><div class="wrap">
    <div class="sec-head" style="margin-bottom:20px"><div class="rule"></div>
      <h2 class="display" style="margin-bottom:4px">Makimono <span class="jp" style="color:var(--text-3);font-size:.55em">巻き物</span></h2>
      <p class="muted" style="font-size:.9rem">${CATS.makimono.blurb}</p></div>
    ${addonGrid('makimono')}
  </div></section>

  <section class="sec" style="padding:34px 0;background:var(--ink)"><div class="wrap">
    <div class="sec-head" style="margin-bottom:20px"><div class="rule"></div>
      <h2 class="display" style="margin-bottom:4px">Premium <span class="jp" style="color:var(--text-3);font-size:.55em">特選</span></h2>
      <p class="muted" style="font-size:.9rem">${CATS.premium.blurb}</p></div>
    ${addonGrid('premium')}
  </div></section>

  <section class="sec" style="padding:34px 0 60px;background:var(--ink)"><div class="wrap">
    <div class="sec-head" style="margin-bottom:20px"><div class="rule"></div>
      <h2 class="display" style="margin-bottom:4px">Saké <span class="jp" style="color:var(--text-3);font-size:.55em">日本酒</span></h2>
      <p class="muted" style="font-size:.9rem">${CATS.sake.blurb}</p></div>
    ${addonGrid('sake')}
  </div></section>

  <div class="bar"><div class="wrap bar-in" id="orderBar"></div></div>
  ${foot()}`;
}

function qtyCard(m){
  const q = state.order.addons[m.id] || 0;
  const ask = m.price === 'ask';
  return `<article class="card qcard ${q?'on':''}" data-q="${m.id}">
    <div class="card-img"><img src="${imgOf(m)}" alt="${esc(m.en)}" loading="lazy"></div>
    <div class="qcard-body">
      <div class="card-en" style="font-size:.83rem">${m.flag||''} ${esc(m.en)}</div>
      <div class="card-cn" style="font-size:.72rem">${esc(m.cn)}</div>
      <div class="card-price" style="margin-top:5px">
        ${ask ? '<span style="color:var(--text-3)">Ask the chef</span>'
              : `${money(m.price)} <span class="per">/ ${m.unit}</span>${m.min>1?` <span class="card-min" style="display:inline">· min ${m.min}</span>`:''}`}
      </div>
    </div>
    ${ask ? `<button class="btn btn-ghost" style="padding:8px 15px;font-size:.75rem" data-ask="${m.id}">${q?'Requested ✓':'Request'}</button>`
          : `<div class="qty">
              <button data-step="-1" ${q?'':'disabled'}>−</button>
              <input type="number" value="${q}" min="0" data-qin="${m.id}">
              <button data-step="1">+</button>
            </div>`}
  </article>`;
}

function renderBar(){
  const bar = $('#orderBar'); if (!bar) return;
  const o = state.order;
  const q = quote({ hours: state.booking.hours, addons: o.addons });
  const v = validate({ ...o, pax: state.booking.pax });
  const cls = (n, need) => n === need ? 'done' : n > need ? 'over' : '';
  bar.innerHTML = `
    <div class="bar-counts">
      <span class="bar-c ${cls(o.chicken.length,7)}"><b>${o.chicken.length}/${SETTINGS.includedChicken}</b> chicken</span>
      <span class="bar-c ${cls(o.veg.length,2)}"><b>${o.veg.length}/${SETTINGS.includedVeg}</b> vegetable</span>
      <span class="bar-c"><b>${Object.values(o.addons).filter(Boolean).length}</b> add-ons</span>
    </div>
    <div class="bar-total"><small>Total · deposit ${money(q.deposit)}</small><b>${money(q.subtotal)}</b></div>
    <button class="btn btn-primary" id="toSummary" ${v.ok?'':'disabled'}>
      ${v.ok ? 'Review & confirm →' : `${7-o.chicken.length>0?`${7-o.chicken.length} chicken`:''}${(7-o.chicken.length>0&&2-o.veg.length>0)?', ':''}${2-o.veg.length>0?`${2-o.veg.length} vegetable`:''} to go`}
    </button>`;
  $('#toSummary')?.addEventListener('click', () => go('#/summary'));
}

/* ══ SUMMARY ═════════════════════════════════════════ */
function Summary(){
  const o = state.order, b = state.booking;
  const q = quote({ hours: b.hours, addons: o.addons });
  const chips = ids => ids.map(id => { const m = byId(id); return `
    <div style="display:flex;align-items:center;gap:9px;padding:7px 12px;background:var(--raise);border-radius:999px">
      <img src="${imgOf(m)}" alt="" style="width:26px;height:26px;object-fit:contain">
      <span style="font-size:.8rem">${esc(m.en)}</span></div>`; }).join('');

  return `${nav('#/order')}
  <section style="padding:48px 0 10px"><div class="wrap narrow">
    <div class="rule"></div><div class="eyebrow">Almost there</div>
    <h1 class="display" style="font-size:clamp(2rem,4vw,2.8rem);margin:12px 0 10px">Your night, in full.</h1>
    <p class="lede">Check it over, then secure the date with a 50% deposit.</p>
  </div></section>
  <section style="padding-bottom:80px"><div class="wrap narrow">
    <div class="panel" style="margin-bottom:20px">
      <div class="panel-t">The booking</div>
      <div class="kv"><span>Date</span><b>${prettyDate(b.date)}</b></div>
      <div class="kv"><span>Time</span><b>${esc(b.time)} · ${b.hours} hours</b></div>
      <div class="kv"><span>Guests</span><b>${b.pax}</b></div>
      <div class="kv"><span>Where</span><b>${esc(b.address) || '<span class="muted">Not set</span>'}</b></div>
      ${b.notes ? `<div class="kv"><span>Notes</span><b>${esc(b.notes)}</b></div>` : ''}
    </div>

    <div class="panel" style="margin-bottom:20px">
      <div class="panel-t">Your ${SETTINGS.includedChicken + SETTINGS.includedVeg} set skewers
        <a href="#/order" style="font-size:.78rem;color:var(--ember);font-family:var(--sans)">Change</a></div>
      <div style="font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--text-3);margin-bottom:9px">Chicken</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px">${chips(o.chicken)}</div>
      <div style="font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--text-3);margin-bottom:9px">Vegetable</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${chips(o.veg)}</div>
    </div>

    <div class="panel" style="margin-bottom:20px">
      <div class="panel-t">The bill</div>
      ${q.lines.map(l => `<div class="line"><div><b>${esc(l.label)}</b><div class="l-sub">${esc(l.sub)}</div></div>
        <div class="l-amt">${money(l.amount)}</div></div>`).join('')}
      <div class="total"><b>Total</b><span class="t-amt">${money(q.subtotal)}</span></div>
      ${q.askItems.length ? `<div class="notice notice-info" style="margin-top:14px"><span>◆</span><div>
        <b>${q.askItems.map(m => esc(m.en)).join(', ')}</b> — priced on request. Gino will confirm before the night
        and it isn't in the total above.</div></div>` : ''}
      <div class="deposit-box">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <div><b style="font-size:.9rem">Deposit due now</b><div class="hint" style="margin:2px 0 0">50% · balance ${money(q.balance)} on the night</div></div>
          <div class="d-amt">${money(q.deposit)}</div>
        </div>
      </div>
    </div>

    ${state.paid ? `<div class="notice notice-ok"><span>✓</span><div><b>Deposit screenshot received.</b>
      Gino will confirm within a few hours and your date is locked in. See you on ${prettyDate(b.date)}.</div></div>
      <p style="margin-top:22px;text-align:center"><button class="btn btn-ghost" id="resetAll">Start a new booking</button></p>`
    : `<div class="panel">
      <div class="panel-t">Pay the deposit · PayNow</div>
      <div class="pay-grid">
        ${fakeQR()}
        <div style="flex:1;min-width:230px">
          <div class="kv"><span>UEN</span><b><span class="ph" title="Placeholder">${SETTINGS.paynow.uen}</span></b></div>
          <div class="kv"><span>Account</span><b><span class="ph" title="Placeholder">${SETTINGS.paynow.name}</span></b></div>
          <div class="kv"><span>Amount</span><b style="color:var(--ember)">${money(q.deposit)}</b></div>
          <div class="kv"><span>Reference</span><b>BY-${(b.date||'').replace(/-/g,'').slice(2)||'XXXXXX'}</b></div>
        </div>
      </div>
      <div class="drop" id="drop" style="margin-top:20px">
        <div class="ic">⇪</div>
        <p style="font-size:.88rem;margin-top:8px"><b>Upload your payment screenshot</b></p>
        <p class="hint">Gino checks it against the reference and confirms.</p>
      </div>
      <button class="btn btn-primary btn-lg" style="width:100%;margin-top:18px" id="markPaid">I've paid the deposit</button>
      <p class="hint" style="text-align:center;margin-top:10px">Prototype — this just marks the booking as paid locally.</p>
    </div>`}
  </div></section>${foot()}`;
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

/* ── router ──────────────────────────────────────────── */
const ROUTES = {
  '#/':Home, '#/menu':Menu, '#/reserve':Reserve, '#/order':Order, '#/summary':Summary,
  '#/chef':ChefBookings, '#/chef/calendar':ChefCalendar, '#/chef/menu':ChefMenu, '#/chef/settings':ChefSettings
};
const isChef = h => h.startsWith('#/chef');
function go(h){ if (location.hash === h) render(); else location.hash = h; }

function render(){
  let h = location.hash || '#/';
  if (h === '#/demo'){ seedDemo(); location.replace('#/summary'); h = '#/summary'; }
  if (h.startsWith('#cat-')){ document.getElementById(h.slice(1))?.scrollIntoView({behavior:'smooth'}); return; }
  const view = ROUTES[h] || Home;
  $('#app').innerHTML = view();
  window.scrollTo(0,0);
  wire(h);
  observe();
}

function wire(h){
  $('#navToggle')?.addEventListener('click', () => $('#navLinks').classList.toggle('open'));

  if (h === '#/reserve'){
    const mount = () => { $('#calMount').innerHTML = calendar(); bindCal(); };
    const bindCal = () => {
      $('#calPrev')?.addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth()-1); mount(); });
      $('#calNext')?.addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth()+1); mount(); });
      $$('.cal-day.avail, .cal-day.on').forEach(el => el.addEventListener('click', () => {
        state.booking.date = el.dataset.d; save(); mount();
      }));
    };
    mount();
    $('#resForm').addEventListener('submit', e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      Object.assign(state.booking, { ...f, pax:+f.pax, hours:+f.hours });
      const errs = [];
      if (!state.booking.date) errs.push('Pick a date from the calendar.');
      if (state.booking.pax < SETTINGS.minPax) errs.push(`Minimum ${SETTINGS.minPax} guests.`);
      if (!state.booking.name?.trim()) errs.push('We need a name.');
      if (!state.booking.phone?.trim()) errs.push('We need a WhatsApp number to reach you.');
      if (errs.length){
        $('#resErr').innerHTML = `<div class="notice notice-warn" style="margin-bottom:14px"><span>!</span>
          <div><b>Almost —</b><ul>${errs.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`;
        return;
      }
      save();
      $('#resErr').innerHTML = `<div class="notice notice-ok" style="margin-bottom:14px"><span>✓</span><div>
        <b>Request sent.</b> Gino has your details for ${prettyDate(state.booking.date)} and will confirm shortly.
        <br><span class="muted">Prototype: jumping you straight to the private menu link he'd send.</span></div></div>`;
      setTimeout(() => go('#/order'), 1500);
    });
  }

  if (h === '#/order'){
    $$('[data-pick]').forEach(el => {
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); el.click(); }
      });
      el.addEventListener('click', () => {
      const { pick, id } = el.dataset;
      const limit = pick === 'chicken' ? SETTINGS.includedChicken : SETTINGS.includedVeg;
      const arr = state.order[pick], i = arr.indexOf(id);
      if (i > -1) arr.splice(i,1);
      else if (arr.length < limit) arr.push(id);
      else return;
      save(); render();
      });
    });

    $$('[data-q]').forEach(card => {
      const id = card.dataset.q, m = byId(id);
      const set = n => {
        n = Math.max(0, n);
        if (n > 0 && m.min && n < m.min) n = m.min;   // first tap jumps to the minimum
        if (n) state.order.addons[id] = n; else delete state.order.addons[id];
        save();
        const inp = $('[data-qin]', card); if (inp) inp.value = n;
        card.classList.toggle('on', !!n);
        $('[data-step="-1"]', card)?.toggleAttribute('disabled', !n);
        renderBar();
      };
      $('[data-step="1"]', card)?.addEventListener('click', () => set((state.order.addons[id]||0) + (state.order.addons[id] ? 1 : (m.min||1))));
      $('[data-step="-1"]', card)?.addEventListener('click', () => {
        const cur = state.order.addons[id] || 0;
        set(cur <= (m.min||1) ? 0 : cur - 1);
      });
      $('[data-qin]', card)?.addEventListener('change', e => set(+e.target.value || 0));
      $('[data-ask]', card)?.addEventListener('click', () => { set(state.order.addons[id] ? 0 : 1); render(); });
    });
    renderBar();
  }

  if (h === '#/summary'){
    $('#drop')?.addEventListener('click', () => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*';
      i.onchange = () => { if (i.files[0]) $('#drop').innerHTML =
        `<div class="ic" style="color:var(--green)">✓</div><p style="font-size:.88rem;margin-top:8px">
         <b>${esc(i.files[0].name)}</b></p><p class="hint">Ready to send with your booking.</p>`; };
      i.click();
    });
    $('#markPaid')?.addEventListener('click', () => { state.paid = true; save(); render(); });
    $('#resetAll')?.addEventListener('click', reset);
  }

  if (isChef(h)) wireChef(h);
}

/* reveal-on-scroll */
let io;
function observe(){
  io?.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')), { threshold:.08 });
  $$('.rv').forEach(el => io.observe(el));
}

window.addEventListener('hashchange', render);
render();
