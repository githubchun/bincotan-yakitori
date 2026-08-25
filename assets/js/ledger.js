/* Append-only record of everything that happens to a booking.
   Entries are never edited and never deleted. Each one carries the hash of the
   entry before it, so the whole log is a chain: change any past entry and every
   hash after it stops matching, and verifyChain() says exactly where.

   This is the primary record. The emailed copy is the backup — see emailFor().
   In the real build, appending also POSTs to a transactional mail service so a
   second copy lands in a mailbox nobody can quietly rewrite. */

/* ── SHA-256, self-contained ───────────────────────────
   No dependency and synchronous, so appending can't half-finish. Verified in
   test.js against the standard NIST vectors. */
const sha256 = (() => {
  const K = new Uint32Array([
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  const rr = (x, n) => (x >>> n) | (x << (32 - n));

  function utf8(str){
    const out = [];
    for (let i = 0; i < str.length; i++){
      const c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c <= 0xdbff){
        const cp = 0x10000 + ((c & 0x3ff) << 10) + (str.charCodeAt(++i) & 0x3ff);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }

  return function(str){
    const b = utf8(str), bits = b.length * 8;
    b.push(0x80);
    while (b.length % 64 !== 56) b.push(0);
    b.push(0,0,0,0, (bits >>> 24) & 255, (bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255);

    let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,
        h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
    const w = new Uint32Array(64);

    for (let i = 0; i < b.length; i += 64){
      for (let t = 0; t < 16; t++)
        w[t] = (b[i+t*4] << 24) | (b[i+t*4+1] << 16) | (b[i+t*4+2] << 8) | b[i+t*4+3];
      for (let t = 16; t < 64; t++){
        const s0 = rr(w[t-15],7) ^ rr(w[t-15],18) ^ (w[t-15] >>> 3);
        const s1 = rr(w[t-2],17) ^ rr(w[t-2],19) ^ (w[t-2] >>> 10);
        w[t] = (w[t-16] + s0 + w[t-7] + s1) >>> 0;
      }
      let a=h0,b1=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
      for (let t = 0; t < 64; t++){
        const S1 = rr(e,6) ^ rr(e,11) ^ rr(e,25);
        const t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[t] + w[t]) >>> 0;
        const S0 = rr(a,2) ^ rr(a,13) ^ rr(a,22);
        const t2 = (S0 + ((a & b1) ^ (a & c) ^ (b1 & c))) >>> 0;
        h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b1; b1=a; a=(t1+t2)>>>0;
      }
      h0=(h0+a)>>>0; h1=(h1+b1)>>>0; h2=(h2+c)>>>0; h3=(h3+d)>>>0;
      h4=(h4+e)>>>0; h5=(h5+f)>>>0; h6=(h6+g)>>>0; h7=(h7+h)>>>0;
    }
    return [h0,h1,h2,h3,h4,h5,h6,h7].map(x => x.toString(16).padStart(8,'0')).join('');
  };
})();

/* ── event kinds ───────────────────────────────────────
   Each one names something that actually happened, in Gino's words, and says
   who caused it. `keep` marks the entries that matter in a dispute. */
const EVENTS = {
  'booking.created':   { label:'Date booked',        actor:'customer', keep:true },
  'booking.cancelled': { label:'Booking cancelled',  actor:'chef' },
  'booking.completed': { label:'Event completed',    actor:'chef' },
  'menu.submitted':    { label:'Menu submitted',     actor:'customer', keep:true },
  'menu.reopened':     { label:'Menu reopened',      actor:'chef',     keep:true },
  'payment.claimed':   { label:'Payment sent',       actor:'customer', keep:true },
  'payment.confirmed': { label:'Payment confirmed',  actor:'chef',     keep:true },
  'date.closed':       { label:'Evening closed',     actor:'chef' },
  'date.opened':       { label:'Evening reopened',   actor:'chef' },
  'month.released':    { label:'Month released',     actor:'chef' },
  'month.closed':      { label:'Month closed',       actor:'chef' },
  'price.changed':     { label:'Price changed',      actor:'chef',     keep:true },
  'item.toggled':      { label:'Item availability',  actor:'chef' },
  'item.added':        { label:'Item added',         actor:'chef',     keep:true },
  'item.removed':      { label:'Item removed',       actor:'chef',     keep:true },
  'item.retired':      { label:'Item retired',       actor:'chef',     keep:true },
  'item.restored':     { label:'Item restored',      actor:'chef' },
  'log.started':       { label:'Record opened',      actor:'system' }
};

const GENESIS = '0'.repeat(64);

/** The exact bytes that get hashed. Order matters, so build it in one place. */
const canonical = e =>
  JSON.stringify([e.seq, e.at, e.kind, e.ref || '', e.summary, e.data, e.prev]);

/** Append one entry. Returns it. Never modifies anything already in the log. */
function logEvent(log, kind, { ref = '', summary = '', data = {}, at } = {}){
  const prev = log.length ? log[log.length - 1].hash : GENESIS;
  const e = {
    seq: log.length + 1,
    at: at || new Date().toISOString(),
    kind, ref, summary, data, prev
  };
  e.hash = sha256(canonical(e));
  log.push(e);
  return e;
}

/**
 * Walk the chain and confirm nothing has been altered.
 * @returns {{ok:boolean, checked:number, brokenAt:number|null, reason:string|null}}
 */
function verifyChain(log){
  let prev = GENESIS;
  for (let i = 0; i < log.length; i++){
    const e = log[i];
    if (e.seq !== i + 1)
      return { ok:false, checked:i, brokenAt:i + 1, reason:`entry ${i + 1} is numbered ${e.seq}` };
    if (e.prev !== prev)
      return { ok:false, checked:i, brokenAt:e.seq, reason:`entry ${e.seq} does not follow the one before it` };
    if (sha256(canonical(e)) !== e.hash)
      return { ok:false, checked:i, brokenAt:e.seq, reason:`entry ${e.seq} has been altered since it was written` };
    prev = e.hash;
  }
  return { ok:true, checked:log.length, brokenAt:null, reason:null };
}

/* ── the emailed copy ──────────────────────────────────
   One message per entry, to a dedicated inbox. Subject carries the booking
   reference so a mailbox search on "BY-0434" pulls that event's whole history.
   The body is deliberately plain text: readable in any client, in ten years. */
/* The record has no business depending on the app's date helpers — it must be
   readable on its own, including from a test that loads nothing else. */
const stamp = d => new Date(d + 'T00:00:00').toLocaleDateString('en-SG',
  { weekday:'long', day:'numeric', month:'long', year:'numeric' });

function emailFor(e, booking){
  const meta = EVENTS[e.kind] || { label: e.kind, actor: 'system' };
  const when = new Date(e.at).toLocaleString('en-SG', {
    dateStyle:'medium', timeStyle:'medium', timeZone:'Asia/Singapore' });

  const lines = [];
  lines.push(`${meta.label} — ${e.summary}`);
  lines.push('');
  lines.push(`Recorded    ${when} (SGT)`);
  lines.push(`Entry       #${e.seq}`);
  lines.push(`By          ${meta.actor}`);
  if (e.ref) lines.push(`Booking     ${e.ref}`);

  if (booking){
    lines.push('');
    lines.push('BOOKING');
    lines.push(`  Customer  ${booking.name} · ${booking.phone}`);
    lines.push(`  Event     ${stamp(booking.date)} at ${booking.time}, ${booking.hours} hrs`);
    lines.push(`  Guests    ${booking.pax}`);
    lines.push(`  Where     ${booking.addr}`);
    if (booking.notes) lines.push(`  Note      ${booking.notes}`);
  }

  const d = e.data || {};
  if (Object.keys(d).length){
    lines.push('');
    lines.push('DETAIL');
    for (const [k, v] of Object.entries(d)){
      if (Array.isArray(v)) lines.push(`  ${k.padEnd(9)} ${v.length ? v.join(', ') : '—'}`);
      else if (v && typeof v === 'object')
        lines.push(`  ${k.padEnd(9)} ${Object.entries(v).map(([a,b]) => `${a} × ${b}`).join(', ') || '—'}`);
      else lines.push(`  ${k.padEnd(9)} ${v}`);
    }
  }

  lines.push('');
  lines.push('INTEGRITY');
  lines.push(`  This entry  ${e.hash}`);
  lines.push(`  Follows     ${e.prev}`);
  lines.push('');
  lines.push('Keep this message. If the site is ever unavailable or its records are');
  lines.push('doubted, these emails are the independent copy. The two hashes above');
  lines.push('chain every entry together, so a missing or altered record is detectable.');

  return {
    to: SETTINGS.records.inbox,
    subject: `[${e.ref || 'BINCOTAN'}] ${meta.label} — ${e.summary}`,
    body: lines.join('\n')
  };
}

/** The whole log as plain text, for keeping a copy outside the browser. */
function ledgerText(log, findBooking){
  const v = verifyChain(log);
  const head = [
    'BINCOTAN YAKITORI — TRANSACTION RECORD',
    `Exported  ${new Date().toLocaleString('en-SG', { dateStyle:'full', timeStyle:'medium' })}`,
    `Entries   ${log.length}`,
    `Chain     ${v.ok ? 'intact — every entry verified' : 'BROKEN at entry ' + v.brokenAt + ' — ' + v.reason}`,
    '='.repeat(72), ''
  ].join('\n');
  return head + log.map(e => emailFor(e, findBooking && findBooking(e.ref)).body +
    '\n' + '-'.repeat(72) + '\n').join('\n');
}
