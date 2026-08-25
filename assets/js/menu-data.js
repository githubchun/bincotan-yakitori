/* Bincotan Yakitori — menu + settings
   Transcribed from "Bincotan Yakitori Event new menu 2025 (5).pdf".
   Prices in SGD. `price: null` = included in the set. `price: 'ask'` = chef quotes on request. */

const SETTINGS = {
  currency: 'SGD',
  sessionFee: 500,          // per session
  chefServiceFee: 200,      // 4 hours included
  chefServiceHours: 4,
  extraHourFee: 50,
  minPax: 10,
  includedChicken: 7,       // included in the set; more are billed as add-ons
  includedVeg: 2,
  extraSkewerPrice: 5,     // PLACEHOLDER — per skewer, for types beyond the included set
  extraSkewerMinQty: 10,
  holdPct: 0.10,           // of the minimum spend, paid to take a date
  byMenuPct: 0.50,         // cumulative share due once the menu is confirmed
  cutoffHours: 72,
  /* No fixed service days. Gino releases a month, then blocks individual
     evenings inside it — see releasedMonths / blocked in store.js. */
  // ---- PLACEHOLDERS — replace with the chef's real details ----
  paynow: { uen: 'T00XXXXXXX', name: 'BINCOTAN YAKITORI (PLACEHOLDER)' },
  records: {
    // Every transaction is emailed here as an independent copy of the ledger.
    inboxUser: 'records',
    inboxDomain: 'placeholder.invalid'
  },
  contact: {
    whatsapp: '6580000000',
    whatsappDisplay: '+65 8000 0000',
    emailUser: 'hello',
    emailDomain: 'placeholder.invalid',
    instagram: 'yakitori_punch_life'
  }
};
SETTINGS.contact.email = SETTINGS.contact.emailUser + '@' + SETTINGS.contact.emailDomain;
SETTINGS.records.inbox = SETTINGS.records.inboxUser + '@' + SETTINGS.records.inboxDomain;

const MENU = [
  // ───────────── CHICKEN — choose 7 ─────────────
  { id:'liver',         cat:'chicken', en:'Liver',              cn:'鶏肝',           price:null },
  { id:'gizzard',       cat:'chicken', en:'Gizzard',            cn:'鶏胗',           price:null },
  { id:'heart',         cat:'chicken', en:'Heart',              cn:'鶏心',           price:null },
  { id:'soft-bone',     cat:'chicken', en:'Soft Bone',          cn:'鶏软骨',         price:null },
  { id:'neck',          cat:'chicken', en:'Neck',               cn:'鶏颈肉',         price:null },
  { id:'wing',          cat:'chicken', en:'Wing',               cn:'鶏翅',           price:null },
  { id:'thigh-leek',    cat:'chicken', en:'Thigh with Leek',    cn:'鶏腿肉与葱',      price:null, rec:true },
  { id:'tail',          cat:'chicken', en:'Tail',               cn:'鶏尾',           price:null, rec:true },
  { id:'skin',          cat:'chicken', en:'Skin',               cn:'鶏皮',           price:null, rec:true },
  { id:'thigh',         cat:'chicken', en:'Thigh',              cn:'鶏上腿',         price:null },
  { id:'breast-shisho', cat:'chicken', en:'Breast with Shiso',  cn:'鶏胸肉与紫苏叶',  price:null },
  { id:'comb',          cat:'chicken', en:'Comb',               cn:'鶏冠',           price:'ask' },
  { id:'neck-skin',     cat:'chicken', en:'Neck Skin',          cn:'鶏颈皮',         price:null },
  { id:'meatball',      cat:'chicken', en:'Meatball',           cn:'鶏肉丸',         price:null, rec:true },
  { id:'fillet',        cat:'chicken', en:'Fillet',             cn:'鶏里脊',         price:null },

  // ───────────── VEGETABLE — choose 2 ─────────────
  { id:'asparagus',     cat:'vegetable', en:'Asparagus',         cn:'芦笋',          price:null },
  { id:'cherry-tomato', cat:'vegetable', en:'Cherry Tomato',     cn:'小番茄',        price:null },
  { id:'shiitake',      cat:'vegetable', en:'Shiitake Mushroom', cn:'蘑菇',          price:null },
  { id:'zucchini',      cat:'vegetable', en:'Zucchini',          cn:'西葫芦',        price:null },
  { id:'shishito',      cat:'vegetable', en:'Shishito',          cn:'青椒',          price:null },
  { id:'white-corn',    cat:'vegetable', en:'White Corn',        cn:'金马伦白玉米',   price:null },
  { id:'baby-potato',   cat:'vegetable', en:'Baby Potato',       cn:'土豆',          price:null },

  // ───────────── MAKIMONO — pork belly rolls, min 10 each ─────────────
  { id:'pb-shisho',        cat:'makimono', en:'Pork Belly with Shiso Leaf',              cn:'五花肉与紫苏叶卷',   price:6.5, unit:'skewer', min:10, rec:true },
  { id:'pb-pepper-cheese', cat:'makimono', en:'Pork Belly, Green Pepper & Mozzarella',   cn:'五花肉与青椒，起司', price:6.5, unit:'skewer', min:10, rec:true },
  { id:'pb-tomato',        cat:'makimono', en:'Pork Belly with Tomato',                  cn:'五花肉与番茄',       price:5,   unit:'skewer', min:10 },
  { id:'pb-king-oyster',   cat:'makimono', en:'Pork Belly with King Oyster Mushroom',    cn:'五花肉与杏鲍菇',     price:5,   unit:'skewer', min:10 },
  { id:'pb-asparagus',     cat:'makimono', en:'Pork Belly with Asparagus',               cn:'五花肉与芦笋',       price:5,   unit:'skewer', min:10 },
  { id:'pb-shiitake',      cat:'makimono', en:'Pork Belly with Shiitake Mushroom',       cn:'五花肉与蘑菇',       price:5,   unit:'skewer', min:10 },
  { id:'pb-enoki',         cat:'makimono', en:'Pork Belly with Enoki Mushroom',          cn:'五花肉与金针菇',     price:5,   unit:'skewer', min:10 },
  { id:'pb-zucchini',      cat:'makimono', en:'Pork Belly with Zucchini',                cn:'五花肉与西葫芦',     price:5,   unit:'skewer', min:10 },

  // ───────────── PREMIUM ─────────────
  { id:'wagyu',         cat:'premium', en:'Japan Wagyu Skewer',                     cn:'日本黑毛和牛',        price:25,  unit:'skewer', min:10, rec:true, flag:'🇯🇵' },
  { id:'lamb-rack',     cat:'premium', en:'Premium Australian Lamb Rack',           cn:'优质澳洲羊排',        price:25,  unit:'pc',     min:10, rec:true, flag:'🇦🇺' },
  { id:'king-prawn',    cat:'premium', en:'King Prawn in Pork Belly & Shiso',       cn:'老虎虾与猪肉紫苏叶卷', price:12,  unit:'skewer', min:10, rec:true },
  { id:'iberico-jowl',  cat:'premium', en:'Spanish Iberico Pork Jowl',              cn:'黑猪脸颊肉',          price:8,   unit:'skewer', min:10, flag:'🇪🇸' },
  { id:'iberico-belly', cat:'premium', en:'Spanish Iberico Pork Belly',             cn:'黑猪五花肉',          price:6.5, unit:'skewer', min:10, flag:'🇪🇸' },
  { id:'quail-egg',     cat:'premium', en:'Quail Egg',                              cn:'鹌鹑蛋',              price:5,   unit:'skewer', min:10 },
  { id:'kinki',         cat:'premium', en:'Charcoal Grilled Kinki',                 cn:'碳烤金吉鱼',          price:75,  unit:'pc',     min:2 },
  { id:'squid',         cat:'premium', en:'Charcoal Grilled Squid Ika Ichiyaboshi', cn:'碳烤一夜干鱿鱼',      price:35,  unit:'order',  min:2 },
  { id:'sashimi-5',     cat:'premium', en:'5-kind Sashimi Moriwase',                cn:'五种刺身盛合',        price:30,  unit:'pax',    min:10, img:'sashimi' },
  { id:'sashimi-7',     cat:'premium', en:'7-kind Sashimi Moriwase',                cn:'七种刺身盛合',        price:50,  unit:'pax',    min:10, img:'sashimi' },
  { id:'sting-ray',     cat:'premium', en:'Eihire Sting Ray Fin',                   cn:'烤鳐鱼翅',            price:20,  unit:'order',  min:1, note:'Good with alcohol' },
  { id:'mentaiko',      cat:'premium', en:'Grilled Mentaiko Cod Roe',               cn:'烤明太子鱼卵',        price:10,  unit:'pc',     min:2, note:'Good with saké' },
  { id:'uni',           cat:'premium', en:'Bafun Uni, 250g',                        cn:'马粪海胆',            price:'ask', unit:'box' },

  // ───────────── SAKE ─────────────
  { id:'sake-kuheiji-kurodasho',   cat:'sake', en:'Kamoshibito Kuheiji Junmai Daiginjo Kurodasho ni Umarete', cn:'醸し人九平次 純米大吟醸 黒田庄に生まれて', price:80,  unit:'bottle', region:'Aichi 愛知',           size:'720ml' },
  { id:'sake-suigei',              cat:'sake', en:'Suigei Junmai Hattanishiki',                               cn:'酔鯨 純米 八反錦',                        price:65,  unit:'bottle', region:'Kochi 高知 · SMV +7',  size:'720ml' },
  { id:'sake-nanbubijin-sakemirai',cat:'sake', en:'Nanbu Bijin Junmai Daiginjo Sakemirai',                     cn:'南部美人 純米大吟醸 酒未来',               price:80,  unit:'bottle', region:'Iwate 岩手 · SMV +1',  size:'720ml' },
  { id:'sake-masumi-nanago',       cat:'sake', en:'Masumi Nanago Junmai Daiginjo',                             cn:'真澄 七號 純米大吟醸',                     price:130, unit:'bottle', region:'Nagano 長野 · SMV −1', size:'720ml' },
  { id:'sake-kuheiji-betsuatsurae',cat:'sake', en:'Kamoshibito Kuheiji Junmai Daiginjo Betsuatsurae',          cn:'醸し人九平次 純米大吟醸 別誂',             price:100, unit:'bottle', region:'Aichi 愛知',           size:'720ml', check:true },
  { id:'sake-hakuryu',             cat:'sake', en:'Hakuryu Tokusen Daiginjo Sasaya Mozaemon',                  cn:'白龍 笹屋茂左衛門 特撰 大吟醸',            price:150, unit:'bottle', region:'Niigata 新潟 · SMV +4',size:'720ml' },
  { id:'sake-dassai-23',           cat:'sake', en:'Dassai Migaki Niwari Sanbu 23 Junmai Daiginjo',             cn:'獺祭 純米大吟醸 二割三分',                 price:150, unit:'bottle', region:'Yamaguchi 山口 · SMV +4', size:'720ml' },
  { id:'sake-katsuyama',           cat:'sake', en:'Katsuyama Tokubetsu Junmai En',                             cn:'勝山 特別純米 縁',                         price:70,  unit:'bottle', region:'Miyagi 宮城',          size:'720ml' },
  { id:'sake-rumiko',              cat:'sake', en:'Rumiko no Sake Junmai Ginjo',                               cn:'るみ子の酒 純米吟醸',                      price:85,  unit:'bottle', region:'Mie 三重 · SMV +4',    size:'720ml' },
  { id:'sake-kuheiji-1800',        cat:'sake', en:'Kamoshibito Kuheiji Junmai Daiginjo Yamadanishiki',         cn:'醸し人九平次 純米大吟醸 山田錦',           price:200, was:280, unit:'bottle', region:'Aichi 愛知 · SMV ±0 · 50% · 15%', size:'1800ml', mustTry:true,
    note:'Banjo Jozo’s flagship. Melon, pear and apple on the nose, a hint of lychee and Japanese cypress. Balanced between white-chocolate sweetness and mandarin peel.' },
  { id:'sake-nanbubijin-1800',     cat:'sake', en:'Nanbu Bijin Tokubetsu Junmai',                              cn:'南部美人 特別純米',                        price:150, unit:'bottle', region:'Iwate 岩手 · SMV +4 · 55% · 15%', size:'1800ml',
    note:'Slightly dry, full in flavour, and a perfect saké to enjoy with food.' }
];

const CATS = {
  chicken:   { label:'Chicken',   cn:'鶏肉',   blurb:'Choose 7 — every part of the bird, over binchōtan.' },
  vegetable: { label:'Vegetable', cn:'野菜',   blurb:'Choose 2.' },
  makimono:  { label:'Makimono',  cn:'巻き物', blurb:'Pork belly rolled around vegetables. Minimum 10 per type.' },
  premium:   { label:'Premium',   cn:'特選',   blurb:'The good stuff, alongside your set.' },
  sake:      { label:'Saké',      cn:'日本酒', blurb:'Bottles brought to your table.' }
};

/* Three lookups, three jobs. `byId` deliberately sees everything — including
   retired items — because an old bill has to keep resolving what it was sold. */
const byId      = id => MENU.find(m => m.id === id);
const inCat     = c => MENU.filter(m => m.cat === c && !m.retired && m.active !== false);
const inCatAll  = c => MENU.filter(m => m.cat === c && !m.retired);
const retiredIn = c => MENU.filter(m => m.cat === c && m.retired);

const asset = id => `assets/img/${id}.webp`;

/* Gino's 54 items each have a cutout from his PDF. Anything he adds himself has
   no photo yet, so it gets a drawn skewer in a grey that reads on either theme.
   `m.photo` is the seam for real uploads — see docs/HANDOFF.md. */
const NO_PHOTO = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
  `<line x1="20" y1="84" x2="82" y2="22" stroke="#9a9a95" stroke-width="3.5" stroke-linecap="round" opacity=".5"/>` +
  `<g fill="#9a9a95" opacity=".34">` +
  `<circle cx="41" cy="63" r="11"/><circle cx="56" cy="48" r="11"/><circle cx="71" cy="33" r="11"/>` +
  `</g></svg>`);

const imgOf = m => m.photo || (m.noImg ? NO_PHOTO : asset(m.img || m.id));
