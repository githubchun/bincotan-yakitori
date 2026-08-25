/* The transaction record: it must be append-only, and any interference with a
   past entry must be detectable. */
let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
};

// ── the hash itself ──
t('sha256 of the empty string', sha256(''),
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
t('sha256("abc") matches the NIST vector', sha256('abc'),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
t('sha256 handles the 56-byte block boundary', sha256('a'.repeat(56)).length, 64);
t('sha256 handles Japanese text', sha256('醸し人九平次').length, 64);
t('a one-character change changes the hash', sha256('BY-0434') === sha256('BY-0435'), false);

// ── appending ──
const log = [];
logEvent(log, 'log.started',     { summary:'opened' });
logEvent(log, 'booking.created', { ref:'BY-9001', summary:'A booked 1 Jan', data:{ guests:12 } });
logEvent(log, 'menu.submitted',  { ref:'BY-9001', summary:'A submitted a menu',
                                   data:{ chicken:['Liver','Skin'], total:'$930' } });
logEvent(log, 'payment.claimed', { ref:'BY-9001', summary:'A sent $70', data:{ amount:'$70' } });

t('every append lands', log.length, 4);
t('entries are numbered from one', log.map(e => e.seq), [1,2,3,4]);
t('the first entry follows the genesis value', log[0].prev, '0'.repeat(64));
t('each entry points at the one before it',
  log.slice(1).every((e, i) => e.prev === log[i].hash), true);
t('an intact chain verifies', verifyChain(log).ok, true);
t('and reports how many it checked', verifyChain(log).checked, 4);

// ── tampering ──
const clone = () => JSON.parse(JSON.stringify(log));

let bad = clone();
bad[2].summary = 'A submitted a completely different menu';
t('editing what an entry says is caught', verifyChain(bad).ok, false);
t('and it names the entry', verifyChain(bad).brokenAt, 3);

bad = clone();
bad[2].data.chicken = ['Liver','Skin','Wagyu'];
t('quietly adding a skewer to a past menu is caught', verifyChain(bad).ok, false);

bad = clone();
bad[2].data.total = '$1,930';
t('changing a recorded total is caught', verifyChain(bad).ok, false);

bad = clone();
bad[1].at = '2020-01-01T00:00:00.000Z';
t('back-dating an entry is caught', verifyChain(bad).ok, false);

bad = clone();
bad.splice(2, 1);
t('deleting an entry from the middle is caught', verifyChain(bad).ok, false);

bad = clone();
bad.splice(2, 0, { ...bad[2], seq:3, summary:'invented' });
t('inserting an entry is caught', verifyChain(bad).ok, false);

bad = clone();
[bad[1], bad[2]] = [bad[2], bad[1]];
t('reordering entries is caught', verifyChain(bad).ok, false);

bad = clone();
bad[2].summary = 'altered';
bad[2].hash = sha256(JSON.stringify([bad[2].seq, bad[2].at, bad[2].kind, bad[2].ref,
                                      bad[2].summary, bad[2].data, bad[2].prev]));
t('recomputing the hash still breaks the following entry', verifyChain(bad).ok, false);
t('and the break is reported at the next entry', verifyChain(bad).brokenAt, 4);

bad = clone();
bad.pop();
t('removing the newest entry alone is NOT detectable by the chain', verifyChain(bad).ok, true);

// ── the emailed copy ──
const mail = emailFor(log[2], { name:'A Customer', phone:'+65 8000 0000', date:'2027-01-01',
  time:'19:00', hours:4, pax:12, addr:'Somewhere', notes:'No shellfish' });
t('subject carries the booking reference', mail.subject.includes('BY-9001'), true);
t('subject names what happened', mail.subject.includes('Menu submitted'), true);
t('it goes to the records inbox', mail.to, SETTINGS.records.inbox);
t('body lists the skewers', mail.body.includes('Liver, Skin'), true);
t('body carries the total', mail.body.includes('$930'), true);
t('body repeats the guest count', mail.body.includes('12'), true);
t('body carries the allergy note', mail.body.includes('No shellfish'), true);
t('body carries this entry\'s fingerprint', mail.body.includes(log[2].hash), true);
t('body carries the previous fingerprint', mail.body.includes(log[2].prev), true);

// ── the export ──
const txt = ledgerText(log, () => null);
t('export states the entry count', txt.includes('Entries   4'), true);
t('export says the chain is intact', txt.includes('intact'), true);
const badTxt = ledgerText((() => { const c = clone(); c[2].summary = 'x'; return c; })(), () => null);
t('export flags a broken chain instead', badTxt.includes('BROKEN at entry 3'), true);

console.log(`\n${pass} passed, ${fail} failed`);
__done(fail);
