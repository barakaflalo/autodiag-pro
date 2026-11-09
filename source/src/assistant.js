// AutoDiag Pro — offline assistant engine.
// Answers from what's inside the app: the code database, typical circuits, troubleshooting trees,
// technical reference, sensor values, the current vehicle, the last scan, and the user's own notes/log.
// No internet, no key. The same retrieved context is handed to an online AI when the user connects one.
import { CODES_DB, SYMPTOMS, SENSOR_REF, WIRE_COLORS, DICT, BATTERY_TABLE, relatedCodes, circuitFor, FAMILY } from "./data.js";
import { CODES_EN, SAFE_EN, SYMPTOMS_EN, SENSORS_EN, WIRE_COLORS_EN } from "./data_en.js";
import { CIRCUITS } from "./circuits.js";
import { TREES } from "./trees.js";
import { DIN, WIRES, FUSES, PROTOCOLS, SECTIONS } from "./techref.js";
import { REF5_FAMS } from "./codes_gen.js";

let EN = false;
const L = (he, en) => EN ? en : he;
const LX = o => o ? (EN ? o.en : o.he) : "";

// ─── text normalisation (Hebrew + English) ───
const FINALS = { "ך":"כ", "ם":"מ", "ן":"נ", "ף":"פ", "ץ":"צ" };
function norm(s){
  return String(s||"").toLowerCase()
    .replace(/[֑-ׇ]/g,"")                 // niqqud / cantillation
    .replace(/[ךםןףץ]/g, ch=>FINALS[ch])
    .replace(/[״"׳'`]/g,"")
    .replace(/[^a-z0-9א-ת%.+\-/ ]+/g," ")
    .replace(/\s+/g," ").trim();
}
// phrases → one canonical token (so "חיישן חמצן" and "o2" and "lambda" meet)
const PHRASES = [
  [["חיישן חמצנ","חיישנ חמצנ","oxygen sensor","o2 sensor","lambda","למבדה","חמצנ","o2"],"_o2"],
  [["משאבת דלק","משאבת הדלק","fuel pump"],"_fpump"],[["לחצ דלק","fuel pressure"],"_fpress"],
  [["לא מתניע","לא מניע","לא נדלק","no start","wont start","won t start","doesnt start"],"_nostart"],
  [["מסתובב ולא","cranks but","crank no start","crank but"],"_crankno"],
  [["נורית מנוע","נורת מנוע","check engine","mil"],"_mil"],[["נורית טעינה","נורת טעינה","charge light","battery light"],"_chargelamp"],
  [["זרמ זליגה","זליגה","מתרוקנ","מתרוקן","parasitic","drain","drains"],"_drain"],
  [["מפל מתח","voltage drop"],"_vdrop"],[["חוק אומ","חוק אוהמ","ohms law","ohm s law"],"_ohm"],
  [["סליל הצתה","קויל","coil","coils","סלילימ"],"_coil"],[["פלאג","מצתימ","spark plug","plugs"],"_plug"],
  [["מצערת","throttle","tps","גופ מצערת"],"_throttle"],[["דוושת גז","דוושה","pedal","app sensor"],"_pedal"],
  [["גל ארכובה","ckp","crank sensor","crankshaft"],"_ckp"],[["גל זיזימ","cmp","cam sensor","camshaft"],"_cmp"],
  [["מתנע","סטרטר","starter"],"_starter"],[["אלטרנטור","דינמו","alternator","טעינה","charging","charge"],"_charge"],
  [["מצבר","מצברימ","battery","batt"],"_batt"],[["ממסר","ממסרימ","ריליי","relay","relays"],"_relay"],
  [["נתיכ","נתיכימ","פיוז","fuse","fuses"],"_fuse"],[["אדמה","הארקה","הארקות","אדמות","ground","grounds","gnd"],"_gnd"],
  [["מאוורר","ונטה","fan","fans"],"_fan"],[["מזגנ","מיזוג","מדחס","קומפרסור","a/c","ac","aircon","compressor"],"_ac"],
  [["אימובילייזר","אימובליזר","immobilizer","immo","קודנ"],"_immo"],[["מזרק","מזרקימ","injector","injectors"],"_inj"],
  [["פספוס","פספוסימ","מקרטע","רועד","רעידות","misfire","misfires"],"_misfire"],[["מתחממ","התחממות","overheat","overheating"],"_overheat"],
  [["קטליזטור","ממיר קטליטי","catalyst","catalytic","cat"],"_cat"],[["מסננ חלקיקימ","dpf","חלקיקימ"],"_dpf"],
  [["טורבו","turbo","boost","בוסט"],"_turbo"],[["תיבת הילוכימ","תיבה","גיר","gearbox","transmission"],"_trans"],
  [["כריות אוויר","כרית אוויר","airbag","airbags","srs"],"_srs"],[["רשת can","קאנ","can bus","can"],"_can"],
  [["מצב לימפ","limp mode","limp"],"_limp"],[["שקע obd","obd"],"_obd"],[["חלונ חשמלי","חלונות","window","windows"],"_window"],
  [["נעילה מרכזית","מנעול","locking","central lock","lock"],"_lock"],[["פנס","פנסימ","אורות","תאורה","headlight","lights","lamp"],"_light"],
  [["מולטימטר","מודד","multimeter","meter"],"_meter"],[["סכמה","סכמות","שרטוט","diagram","diagrams","wiring diagram"],"_diagram"],
  [["היברידי","חשמלי","hybrid","ev","high voltage","מתח גבוה"],"_hv"],[["חיישנ","sensor","sensors"],"_sensor"],
  [["מתח","וולט","voltage","volt","volts"],"_volt"],
  [["בודקימ","לבדוק","בדיקה","בודק","test","testing","check"],"_test"],
  [["טויוטה"],"toyota"],[["קורולה"],"corolla"],[["יאריס"],"yaris"],[["אוריס"],"auris"],[["ראב 4","ראב4"],"rav4"],[["פריוס"],"prius"],[["יונדאי","היונדאי"],"hyundai"],[["טוסונ"],"tucson"],[["איוניק"],"ioniq"],[["קיה","הקיה"],"kia"],[["ספורטאז"],"sportage"],[["פיקנטו"],"picanto"],[["ריו"],"rio"],[["נירו"],"niro"],
  [["מאזדה"],"mazda"],[["סקודה"],"skoda"],[["אוקטביה"],"octavia"],[["פביה"],"fabia"],[["פולקסווגנ","פולקסווגן"],"volkswagen"],[["גולפ","גולף"],"golf"],[["פולו"],"polo"],[["ניסאנ","ניסן"],"nissan"],[["קשקאי"],"qashqai"],[["מיקרה"],"micra"],
  [["מיצובישי"],"mitsubishi"],[["לנסר"],"lancer"],[["אאוטלנדר"],"outlander"],[["סוזוקי"],"suzuki"],[["סוויפט"],"swift"],[["הונדה"],"honda"],[["סיוויק"],"civic"],[["גאז"],"jazz"],[["שברולט"],"chevrolet"],[["פורד"],"ford"],[["פוקוס"],"focus"],
  [["רנו"],"renault"],[["פיגו","פגו"],"peugeot"],[["סיטרואנ"],"citroen"],[["מרצדס"],"mercedes"],[["במוו","ב מ וו"],"bmw"],[["אאודי"],"audi"],[["סובארו"],"subaru"],[["אמ גי","מג"],"mg"],[["שיאומי"],"xiaomi"],[["ביואידי","בי וואי די"],"byd"],[["טסלה"],"tesla"],[["דאציה","דצ'יה"],"dacia"],[["סיאט"],"seat"],[["אופל"],"opel"],[["פיאט"],"fiat"],[["גיפ"],"jeep"],[["התנגדות","אומ","אוהמ","resistance","ohm","ohms"],"_res"],
  [["דל","lean"],"_lean"],[["עשיר","rich"],"_rich"],[["ואקומ","vacuum"],"_vac"],[["egr"],"_egr"],[["abs","esp"],"_abs"],
];
const PH = []; for(const [arr, tok] of PHRASES) for(const p of arr) PH.push([norm(p), tok]);
PH.sort((a,b)=>b[0].length-a[0].length);
const PREF = ["וה","שה","מה","בה","לה","כש","וב","ול","ומ","וש","ו","ה","ב","ל","מ","ש","כ"];
const STOP0 = ["של","את","על","עם","זה","זאת","מה","איך","למה","האם","יש","אני","לי","אתה","הוא","היא","או","גמ","כל","לא","כנ","אבל","רק","עוד","כמה","מתי","איפה","the","a","an","is","are","what","how","why","to","of","in","on","and","or","for","my","it","this","does","do","with","i","בבקשה","תגיד","תסביר","אפשר","צריכ","רוצה","please","tell","explain","can","need","want","about","מישהו","ממש","בדיוק"];
const STOP = new Set(STOP0.map(w=>norm(w)));
export function tokens(s){
  let t = " " + norm(s) + " ";
  for(const [p, tok] of PH){ if(p.length < 2) continue; t = t.split(" "+p+" ").join(" "+tok+" "); }
  const out = [];
  for(const w of t.split(" ")){
    if(!w || STOP.has(w)) continue;
    if(w[0]==="_"){ out.push(w); continue; }
    out.push(w);
    if(/^[א-ת]/.test(w) && w.length>=4){
      for(const p of PREF){ if(w.startsWith(p) && w.length-p.length>=3){ const r = w.slice(p.length); out.push(r); const hit = PH.find(x=>x[0]===r); if(hit) out.push(hit[1]); break; } }
      if(/(ימ|ות)$/.test(w) && w.length>=5) out.push(w.slice(0,-2));
    }
  }
  return out;
}

// ─── knowledge index ───
let IDX = null;
function buildIndex(){
  const docs = [];
  const add = (d) => { d.tok = {}; const tt = tokens(d.title); const bt = tokens(d.body); for(const x of tt) d.tok[x] = (d.tok[x]||0) + 3; for(const x of bt) d.tok[x] = (d.tok[x]||0) + 1; d.len = tt.length*3 + bt.length; docs.push(d); };
  for(const c in CODES_DB){ const d = CODES_DB[c], e = CODES_EN[c]||{}; add({ kind:"code", id:c, title:`${c} ${d.he} ${d.en}`, body:[d.desc, (d.causes||[]).join(" "), e.desc||"", (e.causes||[]).join(" ")].join(" "), w:0.8 }); }
  for(const cc of CIRCUITS) add({ kind:"circuit", id:cc.id, title:cc.he.title+" "+cc.en.title, body:[cc.he.desc, cc.en.desc, cc.he.tests.join(" "), cc.en.tests.join(" ")].join(" "), w:1.25 });
  for(const tr of TREES){ const txt = Object.values(tr.nodes).map(n=>[n.q&&n.q.he, n.q&&n.q.en, n.end&&n.end.he, n.end&&n.end.en].filter(Boolean).join(" ")).join(" "); add({ kind:"tree", id:tr.id, title:tr.title.he+" "+tr.title.en, body:txt, w:1.35 }); }
  for(const s of SECTIONS) add({ kind:"ref", id:s.id, title:s.title.he+" "+s.title.en, body:s.items.map(i=>i.he+" "+i.en).join(" "), w:1.15 });
  add({ kind:"din", id:"din", title:"מספרי הדקים DIN 72552 terminal numbers הדק", body:DIN.map(([k,v])=>`${k} ${v.he} ${v.en}`).join(" "), w:1.1 });
  add({ kind:"wires", id:"wires", title:"עובי חוט מול זרם wire size gauge AWG mm2 חתך", body:"wire current amp ampacity חוט זרם", w:1.1 });
  add({ kind:"fuses", id:"fuses", title:"צבעי נתיכים fuse colours colors", body:FUSES.map(f=>f[0]+" "+f[2].he+" "+f[2].en).join(" "), w:1.1 });
  add({ kind:"proto", id:"proto", title:"פרוטוקולי OBD protocols", body:PROTOCOLS.map(p=>p[0]+" "+p[2].he+" "+p[2].en).join(" "), w:1.1 });
  SENSOR_REF.forEach((s,i)=>{ const e = SENSORS_EN[i]||{}; add({ kind:"sensor", id:i, title:s.name+" "+(e.name||""), body:[s.voltage, s.resist, s.notes, e.notes||""].join(" "), w:1.2 }); });
  SYMPTOMS.forEach(s=>{ const e = SYMPTOMS_EN[s.id]||{}; add({ kind:"symptom", id:s.id, title:s.text+" "+(e.text||""), body:s.tip+" "+(e.tip||"")+" "+s.codes.join(" "), w:1.2 }); });
  DICT.forEach((d,i)=> add({ kind:"dict", id:i, title:d.en+" "+d.he, body:"", w:0.9 }));
  for(const h of HELP) add({ kind:"help", id:h.id, title:h.he.q+" "+h.en.q, body:h.he.a+" "+h.en.a+" "+(h.k||""), w:1.3 });
  const df = {}; for(const d of docs) for(const k in d.tok) df[k] = (df[k]||0) + 1;
  const avg = docs.reduce((a,d)=>a+d.len,0)/docs.length;
  IDX = { docs, df, N:docs.length, avg };
}
export function search(q, extra=[], n=6){
  if(!IDX) buildIndex();
  const qt = [...new Set(tokens(q))]; if(!qt.length) return [];
  const all = IDX.docs.concat(extra.map(d=>{ if(!d.tok){ d.tok = {}; for(const x of tokens(d.title)) d.tok[x]=(d.tok[x]||0)+3; for(const x of tokens(d.body)) d.tok[x]=(d.tok[x]||0)+1; d.len = Object.values(d.tok).reduce((a,b)=>a+b,0); } return d; }));
  const res = [];
  for(const d of all){
    let s = 0, hit = 0;
    for(const t of qt){ const f = d.tok[t]; if(!f) continue; hit++; const idf = Math.log(1 + (IDX.N - (IDX.df[t]||0) + 0.5)/((IDX.df[t]||0) + 0.5)); s += idf * (f*2.2)/(f + 1.2*(0.25 + 0.75*d.len/IDX.avg)); }
    if(!hit) continue;
    s *= (d.w||1) * (0.55 + 0.45*hit/qt.length);
    res.push({ d, s, frac: hit/qt.length });
  }
  res.sort((a,b)=>b.s-a.s);
  return res.slice(0,n);
}

// ─── how-to about the app itself ───
const HELP = [
  { id:"scan", k:"scanner connect bluetooth elm327 vgate סורק חיבור בלוטות מתאם", he:{ q:"איך מחברים את הסורק?", a:"חבר מתאם ELM327 BLE לשקע ה-OBD, הדלק הצתה, הפעל Bluetooth ומיקום בטלפון, ובמסך הסורק לחץ 'התחבר לסורק' ובחר את המתאם (למשל IOS-Vlink). עובד ב-Chrome באנדרואיד. מתאם Bluetooth קלאסי או WiFi לא יתחבר מהדפדפן." }, en:{ q:"How do I connect the scanner?", a:"Plug an ELM327 BLE adapter into the OBD socket, switch the ignition on, enable Bluetooth and location on the phone, then on the Scanner screen tap 'Connect' and choose the adapter (e.g. IOS-Vlink). Works in Chrome on Android. Classic Bluetooth or WiFi adapters can't connect from a browser." }, act:{ type:"tab", id:"scan" } },
  { id:"demo", k:"demo הדגמה try without car", he:{ q:"אפשר לנסות את הסורק בלי רכב?", a:"כן — במסך הסורק לחץ 'הדגמה'. מופיע רכב מדומה עם קודים, VIN, מוכנות, Freeze Frame ונתונים חיים." }, en:{ q:"Can I try the scanner without a car?", a:"Yes — tap 'Demo' on the Scanner screen. A simulated car appears with codes, VIN, readiness, freeze frame and live data." }, act:{ type:"tab", id:"scan" } },
  { id:"plate", k:"plate license registry מספר רישוי משרד התחבורה רכב חיפוש", he:{ q:"איך מוצאים רכב לפי מספר רישוי?", a:"בדף הבית הקלד את המספר בשדה הצהוב ולחץ חפש. הפרטים מגיעים ממאגר משרד התחבורה (צריך אינטרנט): דגם, שנה, קוד מנוע, נפח, VIN ועוד. עובד מהכתובת autodiag-pro.pages.dev." }, en:{ q:"How do I find a car by plate?", a:"On Home type the number in the yellow box and tap Search. Details come from the Ministry of Transport registry (needs internet): model, year, engine code, displacement, VIN and more. Works from autodiag-pro.pages.dev." }, act:{ type:"tab", id:"home" } },
  { id:"diag", k:"diagram pdf upload סכמה העלאה שמירה", he:{ q:"איך שומרים סכמת חשמל?", a:"בעוד ← סכמות חשמל ← 'הוסף סכמה'. בוחרים PDF או תמונות, יצרן, דגם, שנים ומערכת. הסכמה נשמרת בטלפון ונפתחת בלי אינטרנט, ואפשר לסמן עליה נקודות עם הערות." }, en:{ q:"How do I save a wiring diagram?", a:"More → Wiring diagrams → 'Add diagram'. Choose a PDF or images, make, model, years and system. It's stored on the phone, opens offline, and you can pin notes on it." }, act:{ type:"sub", id:"lib" } },
  { id:"report", k:"customer report print דוח לקוח הדפסה", he:{ q:"איך מוציאים דוח ללקוח?", a:"ביומן, בכל רשומה יש כפתור 📄 'דוח ללקוח' — דוח להדפסה או PDF עם פרטי הרכב, הקודים, העבודה, העלות, תמונות ושורות חתימה." }, en:{ q:"How do I make a customer report?", a:"In the Log, every entry has a 📄 'Customer report' button — a printable report (or PDF) with vehicle details, codes, work, cost, photos and signature lines." }, act:{ type:"tab", id:"log" } },
  { id:"backup", k:"backup restore גיבוי שחזור", he:{ q:"איך מגבים את הנתונים?", a:"בעוד ← 'גיבוי לקובץ' שומר יומן, הערות, מועדפים ורכבים. סכמות החשמל מגובות בנפרד במסך הסכמות (ייצוא לקובץ) כי הן כבדות." }, en:{ q:"How do I back up my data?", a:"More → 'Backup to file' saves the log, notes, favourites and vehicles. Wiring diagrams are backed up separately on the diagrams screen (Export to file) because they're large." }, act:{ type:"sub", id:"settings" } },
  { id:"clear", k:"clear codes erase מחיקת קודים", he:{ q:"איך מוחקים קודים?", a:"בסורק, אחרי חיבור, 'מחק קודים'. שים לב: מחיקה מאפסת את בדיקות המוכנות (Readiness) — הרכב צריך נסיעה כדי שהן יושלמו, וטסט לא יעבור לפני כן. קוד שחוזר מיד = התקלה עדיין שם." }, en:{ q:"How do I clear codes?", a:"In the Scanner, once connected, 'Clear codes'. Note: clearing resets the readiness monitors — the car needs a drive cycle to complete them, and it won't pass inspection before that. A code that returns right away = the fault is still there." }, act:{ type:"tab", id:"scan" } },
  { id:"ai", k:"key api gemini openai מפתח בינה", he:{ q:"מה העוזר יודע לעשות?", a:"העוזר עונה מתוך כל המידע שבאפליקציה, גם בלי אינטרנט: קודים ושילובי קודים, ניתוח הסריקה האחרונה, עצי אבחון, סכמות טיפוסיות, ערכי חיישנים, חישובים, ההערות והיומן שלך. אם מחברים מפתח AI (בהגדרות העוזר) הוא יכול להוסיף תשובה מורחבת מהרשת." }, en:{ q:"What can the assistant do?", a:"The assistant answers from everything in the app, even offline: codes and code combinations, the last scan, troubleshooting trees, typical circuits, sensor values, calculations, your notes and log. With an AI key (in the assistant settings) it can add an extended online answer." } },
];

// ─── helpers for code text ───
function codeT(c){ const d = CODES_DB[c]; if(!d) return null; const e = CODES_EN[c]; return { code:c, title: EN ? d.en : d.he, desc: EN && e ? e.desc : d.desc, causes: EN && e ? e.causes : d.causes, steps: EN && e ? e.steps : d.steps, loc: EN && e ? e.location : d.location, sev:d.severity, safe: EN ? (SAFE_EN[d.safe] || d.safe) : d.safe }; }
const SEV_EN = { "נמוכה":"Low", "בינונית":"Medium", "גבוהה":"High", "קריטית":"Critical" };
const sevT = s => EN ? (SEV_EN[s]||s) : s;
const CODE_RE = /(?:^|[^A-Za-z0-9])([PCBUpcbu])\s?-?([0-9A-Fa-f]{4})(?![0-9A-Za-z])/g;
export function findCodes(q){ const out = []; let m; CODE_RE.lastIndex = 0; while((m = CODE_RE.exec(q))) { const c = (m[1]+m[2]).toUpperCase(); if(!out.includes(c)) out.push(c); } return out; }
const cylOf = c => { const m = /^P03(0[1-9]|1[0-2])$/.exec(c); return m ? parseInt(m[1]) : 0; };
const injCyl = c => { const n = parseInt(c.slice(1),10); if(c[0]==="P" && n>=201 && n<=212) return n-200; if(c[0]==="P" && n>=261 && n<=296) return Math.floor((n-261)/3)+1; return 0; };
const coilCyl = c => { const n = parseInt(c.slice(1),10); if(c[0]==="P" && n>=351 && n<=362) return n-350; if(c[0]==="P" && n>=2300 && n<=2335) return Math.floor((n-2300)/3)+1; return 0; };

// ─── code combinations: what codes say together ───
function comboRules(codes){
  const S = new Set(codes); const has = (...a) => a.some(c=>S.has(c)); const out = [];
  const mis = codes.filter(c=>cylOf(c)); const lean = has("P0171","P0174"), rich = has("P0172","P0175");
  if(S.has("P0171") && S.has("P0174")) out.push(L("דל בשני הבנקים יחד → הסיבה משותפת לשני הצדדים: דליפת ואקום (צינור PCV, אטם סעפת, בוסטר בלמים), MAF מלוכלך, או לחץ דלק נמוך. חיישני החמצן כמעט אף פעם לא האשמים כששני הבנקים דלים.","Lean on both banks → a cause shared by both sides: a vacuum leak (PCV hose, intake gasket, brake booster), a dirty MAF, or low fuel pressure. O2 sensors are almost never the cause when both banks are lean."));
  else if(lean) out.push(L("תערובת דלה: התחל מ-Fuel Trim בסרק מול 2500 סל\"ד — אם התיקון גבוה רק בסרק זו דליפת ואקום; אם גם בסל\"ד גבוה — MAF או לחץ דלק.","Lean mixture: start with fuel trim at idle vs 2500 RPM — high only at idle = vacuum leak; high at higher RPM too = MAF or fuel pressure."));
  if(S.has("P0172") && S.has("P0175")) out.push(L("עשיר בשני הבנקים → לחץ דלק גבוה (רגולטור), מזרקים דולפים, MAF שמודד יותר מדי, או חיישן טמפרטורה שמראה 'קר'.","Rich on both banks → high fuel pressure (regulator), leaking injectors, a MAF over-reading, or a temperature sensor reading 'cold'."));
  if(lean && mis.length) out.push(L("דל + פספוסים: תערובת דלה גורמת לפספוסים — טפל קודם בדליפה / לחץ הדלק, לא בסלילים.","Lean + misfires: a lean mixture causes misfires — fix the leak / fuel pressure first, not the coils."));
  if(mis.length >= 2 || (S.has("P0300") && mis.length)) out.push(L(`פספוסים בכמה צילינדרים (${mis.map(cylOf).join(", ")||"אקראי"}) → חפש סיבה משותפת: לחץ דלק, דליפת ואקום גדולה, EGR תקוע פתוח, תזמון, או הזנה משותפת לסלילים/מזרקים. אם הצילינדרים צמודים — בדוק אטם ראש.`,`Misfires on several cylinders (${mis.map(cylOf).join(", ")||"random"}) → look for a shared cause: fuel pressure, a large vacuum leak, EGR stuck open, timing, or a shared supply to the coils/injectors. If the cylinders are adjacent — check the head gasket.`));
  for(const m of mis){ const n = cylOf(m); if(codes.some(c=>injCyl(c)===n)) out.push(L(`פספוס בצילינדר ${n} יחד עם קוד מזרק של אותו צילינדר → התחל מהמזרק והחיווט שלו.`,`Misfire on cylinder ${n} with an injector code for the same cylinder → start with that injector and its wiring.`)); if(codes.some(c=>coilCyl(c)===n)) out.push(L(`פספוס בצילינדר ${n} יחד עם קוד סליל של אותו צילינדר → התחל מהסליל, המחבר והפלאג שלו.`,`Misfire on cylinder ${n} with a coil code for the same cylinder → start with that coil, its connector and spark plug.`)); }
  if(has("P0420","P0430") && (mis.length || has("P0300"))) out.push(L("קטליזטור + פספוסים: קודם מתקנים את הפספוסים — הם מה שהורס את הקטליזטור. אחרי התיקון מוחקים קוד ובודקים אם P0420 חוזר.","Catalyst + misfires: fix the misfires first — they're what destroys the catalyst. Then clear and see if P0420 returns."));
  if(has("P0420","P0430") && codes.some(c=>/^P01(3[6-9]|4[0-1]|5[6-9]|6[01])$/.test(c))) out.push(L("קטליזטור + קוד בחיישן החמצן האחורי: בדוק קודם את החיישן האחורי — הוא זה שמודד את הקטליזטור.","Catalyst + a rear O2 sensor code: check the rear sensor first — it's what measures the catalyst."));
  if((has("P0335","P0336") && has("P0340","P0341","P0345")) || S.has("P0016") || S.has("P0017")) out.push(L("חיישני ארכובה וזיזים / קוד מיתאם → חשוד תזמון (שרשרת מתוחה או קפצה שן), או אות משותף. בדוק סימני תזמון לפני החלפת חיישנים.","Crank and cam sensor codes / a correlation code → suspect timing (stretched or jumped chain) or a shared signal problem. Check timing marks before replacing sensors."));
  const ref = codes.filter(c=>REF5_FAMS.has(FAMILY[c]) && /(Low|High)/.test((CODES_DB[c]||{}).en||""));
  const refFams = new Set(ref.map(c=>FAMILY[c]));
  if(refFams.size >= 2 || S.has("P0641") || S.has("P0651")) out.push(L("כמה חיישני 5V שונים במתח נמוך/גבוה בבת אחת → כמעט תמיד בעיה ברפרנס 5V המשותף: קצר באחד החיישנים או בחיווט. מדוד 5V ונתק חיישנים אחד-אחד.","Several different 5V sensors low/high at once → almost always the shared 5V reference: a short in one sensor or its wiring. Measure the 5V and unplug sensors one by one."));
  const u = codes.filter(c=>c[0]==="U");
  if(u.length >= 2) out.push(L(`${u.length} קודי תקשורת → לפני שמחפשים מודול: טען / בדוק את המצבר (מתח נמוך בזמן התנעה משאיר קודי U), בדוק אדמות ראשיות, ומדוד 60Ω בין פין 6 ל-14.`,`${u.length} communication codes → before hunting a module: charge / test the battery (low voltage while cranking leaves U codes), check the main grounds, and measure 60Ω between pins 6 and 14.`));
  if(has("P0560","P0561","P0562","P0563") && codes.length > 1) out.push(L("יש קוד מתח מערכת — תקן קודם את המתח (מצבר / טעינה / אדמות). מתח לא תקין גורם לקודים 'מזויפים' אחרים.","There's a system voltage code — fix voltage first (battery / charging / grounds). Bad voltage causes other 'false' codes."));
  if(codes.filter(c=>/^P0(12[0-4]|22[0-9])$|^P21(2[0-9]|3[0-8])$/.test(c)).length >= 2) out.push(L("כמה קודי מצערת / דוושה יחד → בדוק את מחברי גוף המצערת והדוושה ואת רפרנס ה-5V שלהם, נקה מצערת ובצע לימוד.","Several throttle / pedal codes together → check the throttle body and pedal connectors and their 5V reference, clean the throttle and run a relearn."));
  const heat = codes.filter(c=>/^P0(135|141|147|155|161|167|030|036|050|056)$/.test(c));
  if(heat.length >= 2) out.push(L("כמה קודי חימום של חיישני חמצן → בדוק קודם את הנתיך והממסר המשותפים לחימום.","Several O2 heater codes → check the shared heater fuse and relay first."));
  if(codes.filter(c=>/^P07(5[0-9]|6[0-9]|7[0-4])$/.test(c)).length >= 2) out.push(L("כמה סולנואידים בתיבה יחד → חשוד מחבר התיבה, רתמה פנימית או הזנה למחשב התיבה — לא כל הסולנואידים התקלקלו יחד.","Several transmission solenoids at once → suspect the gearbox connector, internal harness or TCM supply — they didn't all fail together."));
  if(codes.filter(c=>/^P0(01[0-9]|02[0-2])$/.test(c)).length && has("P0016","P0017","P0011","P0012","P0021","P0022")) out.push(L("קודי VVT + תזמון → התחל ממפלס ואיכות השמן ומסננת ה-OCV, אחר כך שרשרת.","VVT + timing codes → start with oil level and quality and the OCV screen, then the chain."));
  if(codes.filter(c=>/^P04(4[0-9]|5[0-7])$/.test(c)).length >= 2) out.push(L("כמה קודי EVAP → התחל ממכסה הדלק ומהצינורות ליד מיכל הפחם, ואז בדיקת עשן.","Several EVAP codes → start with the fuel cap and the hoses by the canister, then a smoke test."));
  if(codes.filter(c=>/^C00(3[5-9]|4[0-9]|50)$/.test(c)).length >= 2) out.push(L("כמה חיישני ABS יחד → בדוק הזנה ואדמה של מחשב ה-ABS ומתח מצבר לפני שמחליפים חיישנים.","Several ABS wheel sensors at once → check ABS module supply/ground and battery voltage before replacing sensors."));
  return out;
}

// ─── reading a scan ───
function num(v){ const n = parseFloat(String(v||"").replace(",",".")); return isFinite(n) ? n : null; }
function scanFindings(scan){
  const f = []; if(!scan) return f;
  const lv = scan.live || {};
  const rpm = num(lv["0C"]), ect = num(lv["05"]), st = num(lv["06"]), lt = num(lv["07"]), bat = num(lv.batt), ecuV = num(lv["42"]);
  const v = bat ?? ecuV;
  if(v !== null){ if(rpm > 400 && v < 13.2) f.push(L(`מתח ${v}V עם מנוע עובד — נמוך: בדוק טעינה.`,`${v}V with the engine running — low: check charging.`)); else if(rpm > 400 && v > 15) f.push(L(`מתח ${v}V — טעינת יתר.`,`${v}V — overcharging.`)); else if(!(rpm > 400) && v < 12.2) f.push(L(`מתח ${v}V — המצבר חלש / לא טעון. מתח נמוך גורם לקודים מטעים.`,`${v}V — the battery is weak / not charged. Low voltage causes misleading codes.`)); }
  const trim = (st||0) + (lt||0);
  if(lt !== null || st !== null){ if(trim > 10) f.push(L(`תיקון דלק כולל +${trim.toFixed(0)}% → המחשב מוסיף דלק: המנוע 'רואה' תערובת דלה (ואקום, MAF, לחץ דלק).`,`Total fuel trim +${trim.toFixed(0)}% → the ECU is adding fuel: the engine 'sees' a lean mixture (vacuum, MAF, fuel pressure).`)); else if(trim < -10) f.push(L(`תיקון דלק כולל ${trim.toFixed(0)}% → המחשב מוריד דלק: תערובת עשירה (מזרק דולף, לחץ גבוה, MAF).`,`Total fuel trim ${trim.toFixed(0)}% → the ECU is removing fuel: rich mixture (leaking injector, high pressure, MAF).`)); }
  if(ect !== null && rpm > 400){ const rt = num(lv["1F"]); if(ect < 70 && rt !== null && rt > 900) f.push(L(`טמפ' מנוע ${ect}°C אחרי ${Math.round(rt/60)} דק' — כנראה תרמוסטט פתוח.`,`Engine temp ${ect}°C after ${Math.round(rt/60)} min — likely a stuck-open thermostat.`)); if(ect > 105) f.push(L(`טמפ' מנוע ${ect}°C — גבוהה! בדוק קירור.`,`Engine temp ${ect}°C — high! Check cooling.`)); }
  if(scan.ff && scan.ff.vals){ const fv = scan.ff.vals; const p = []; if(fv["05"]) p.push(L(`טמפ' ${fv["05"]}°C`,`temp ${fv["05"]}°C`)); if(fv["0C"]) p.push(L(`${fv["0C"]} סל"ד`,`${fv["0C"]} RPM`)); if(fv["04"]) p.push(L(`עומס ${fv["04"]}%`,`load ${fv["04"]}%`)); if(fv["0D"]) p.push(L(`${fv["0D"]} קמ"ש`,`${fv["0D"]} km/h`));
    if(p.length) f.push(L(`הקוד ${scan.ff.code||""} נשמר כשהמנוע היה ב: ${p.join(", ")}. נסה לשחזר את אותם תנאים בנסיעת מבחן.`,`Code ${scan.ff.code||""} was stored at: ${p.join(", ")}. Try to recreate those conditions on a test drive.`));
    const fe = num(fv["05"]); if(fe !== null && fe < 50) f.push(L("התקלה נשמרה במנוע קר — תקלה שמופיעה בקור (חיישן טמפ', מזרק, חימום חיישן חמצן).","The fault was stored on a cold engine — a cold-only fault (temp sensor, injector, O2 heater).")); }
  if(scan.ready){ const inc = scan.ready.monitors.filter(m=>!m.done).length; if(inc) f.push(L(`${inc} בדיקות מוכנות לא הושלמו — אם הקודים נמחקו לאחרונה, הרכב צריך עוד נסיעה (וגם טסט לא יעבור עדיין).`,`${inc} readiness monitors incomplete — if codes were cleared recently the car needs more driving (and won't pass inspection yet).`)); if(scan.ready.mil) f.push(L("נורית המנוע דולקת.","The check-engine lamp is on.")); }
  return f;
}

// ─── calculators in plain language ───
const N = "(\\d+(?:[.,]\\d+)?)";
const rx = (s, re) => { const m = re.exec(s); return m ? parseFloat(m[1].replace(",",".")) : null; };
function calc(q){
  const s = " " + q.toLowerCase().replace(/[״"]/g,'"') + " ";
  const out = [];
  // voltage drop
  const area = rx(s, new RegExp(N+"\\s*(?:mm2|mm²|mm\\^2|ממ\"ר|ממר|מ\"מ|ממ|mm)(?![a-zא-ת])"));
  const s2 = area !== null ? s.replace(new RegExp(N+"\\s*(?:mm2|mm²|mm\\^2|ממ\"ר|ממר|מ\"מ|ממ|mm)"),"") : s;
  const len = rx(s2, new RegExp(N+"\\s*(?:m|מ'|מטר|מטרים|meters?|metres?)(?![a-zא-ת])"));
  const amp = rx(s, new RegExp(N+"\\s*(?:a|amp|amps|אמפר|אמפרים|אמפ)(?![a-zא-ת])"));
  const volt = rx(s, new RegExp(N+"\\s*(?:v|וולט|volt|volts)(?![a-zא-ת])"));
  const ohm = (()=>{ const m = new RegExp(N+"\\s*(k)?\\s*(?:Ω|ohm|ohms|אום|אוהם|אומ)").exec(s); return m ? parseFloat(m[1].replace(",","."))*(m[2]?1000:1) : null; })();
  if(area && len && amp !== null){
    const vd = amp*0.0175*len/area, pct = vd/12*100; const minA = [0.35,0.5,0.75,1,1.5,2.5,4,6,10,16,25,35,50].find(a=>amp*0.0175*len/a <= 0.36);
    out.push({ t:L(`מפל מתח: ${vd.toFixed(2)}V (${pct.toFixed(1)}% מ-12V) בחוט נחושת ${area} ממ"ר, ${len} מ' הלוך-חזור, ${amp}A. ${pct>3?"⚠️ יותר מ-3% — כדאי חוט עבה יותר.":"✅ תקין."}${minA?` חתך מינימלי ל-3%: ${minA} ממ"ר.`:""}`,`Voltage drop: ${vd.toFixed(2)}V (${pct.toFixed(1)}% of 12V) on ${area}mm² copper, ${len}m round trip, ${amp}A. ${pct>3?"⚠️ Over 3% — use thicker wire.":"✅ OK."}${minA?` Minimum size for 3%: ${minA}mm².`:""}`), act:{ type:"sub", id:"calc" } });
  }
  if(/led/.test(s) && volt){ const white = /לבנ|לבן|white|כחול|blue|ירוק|green/.test(s); const vf = white ? 3.2 : 2.0; const ma = rx(s, new RegExp(N+"\\s*(?:ma|מיליאמפר)")) || 20; const R = (volt - vf)/(ma/1000);
    if(R > 0) out.push({ t:L(`נגד ל-LED ${white?"לבן/כחול (~3.2V)":"אדום/צהוב (~2V)"} ב-${volt}V ו-${ma}mA: ${Math.round(R)}Ω (קח את הערך התקני הבא למעלה), הספק ${((volt-vf)*ma/1000).toFixed(2)}W.`,`LED resistor for ${white?"white/blue (~3.2V)":"red/yellow (~2V)"} at ${volt}V and ${ma}mA: ${Math.round(R)}Ω (take the next standard value up), ${((volt-vf)*ma/1000).toFixed(2)}W.`), act:{ type:"sub", id:"calc" } }); }
  else if(!(area && len)){
    const known = [volt!==null, amp!==null, ohm!==null].filter(Boolean).length;
    if(known >= 2 && /אומ|אוהמ|ohm|ω|התנגדות|resist|חוק|זרם|current|כמה|how|הספק|power|וואט|watt|אמפר|amp/.test(s)){
      let V=volt, I=amp, R=ohm; if(V===null) V = I*R; else if(I===null) I = V/R; else if(R===null) R = V/I;
      out.push({ t:L(`חוק אוהם: ${V.toFixed(2)}V · ${I.toFixed(3)}A · ${R>=1000?(R/1000).toFixed(2)+"kΩ":R.toFixed(2)+"Ω"} · הספק ${(V*I).toFixed(2)}W.`,`Ohm's law: ${V.toFixed(2)}V · ${I.toFixed(3)}A · ${R>=1000?(R/1000).toFixed(2)+"kΩ":R.toFixed(2)+"Ω"} · power ${(V*I).toFixed(2)}W.`), act:{ type:"sub", id:"convert" } });
    }
  }
  const watt = rx(s, new RegExp(N+"\\s*(?:w|וואט|watt|watts)(?![a-zא-ת])"));
  if(watt && !area){ const vv = volt || 12; const I = watt/vv; const fuse = [1,2,3,4,5,7.5,10,15,20,25,30,40,50,60,80,100].find(f=>f>=I*1.25); const wire = (WIRES.find(w=>parseFloat(w[2])>=(fuse||I))||WIRES[WIRES.length-1])[0];
    out.push({ t:L(`${watt}W ב-${vv}V = ${I.toFixed(1)}A → נתיך ${fuse||"—"}A וחוט לפחות ${wire} ממ"ר (בחוט קצר).`,`${watt}W at ${vv}V = ${I.toFixed(1)}A → a ${fuse||"—"}A fuse and at least ${wire}mm² wire (short run).`), act:{ type:"sub", id:"calc" } }); }
  const conv = [[/(\d+(?:[.,]\d+)?)\s*psi/, v=>L(`${v} PSI = ${(v*0.0689476).toFixed(2)} bar`,`${v} PSI = ${(v*0.0689476).toFixed(2)} bar`)],[/(\d+(?:[.,]\d+)?)\s*(?:bar|בר)(?![a-zא-ת])/, v=>`${v} bar = ${(v*14.5038).toFixed(1)} PSI = ${(v*100).toFixed(0)} kPa`],
    [/(\d+(?:[.,]\d+)?)\s*kpa/, v=>`${v} kPa = ${(v/100).toFixed(2)} bar = ${(v*0.145038).toFixed(1)} PSI`],[/(-?\d+(?:[.,]\d+)?)\s*(?:°?\s?f|פרנהייט|fahrenheit)(?![a-zא-ת])/, v=>`${v}°F = ${((v-32)*5/9).toFixed(1)}°C`],
    [/(-?\d+(?:[.,]\d+)?)\s*(?:°\s?c|צלזיוס|celsius)/, v=>`${v}°C = ${(v*9/5+32).toFixed(1)}°F`],[/(\d+(?:[.,]\d+)?)\s*(?:nm|ניוטון מטר)(?![a-zא-ת])/, v=>`${v} Nm = ${(v*0.737562).toFixed(1)} lb·ft`],
    [/(\d+(?:[.,]\d+)?)\s*(?:lb.?ft|ft.?lb)/, v=>`${v} lb·ft = ${(v*1.35582).toFixed(1)} Nm`],[/(\d+(?:[.,]\d+)?)\s*mph/, v=>`${v} mph = ${(v*1.60934).toFixed(0)} km/h`]];
  if(/המר|המרה|convert|כמה זה|זה כמה|=|ל-?bar|to bar|to psi|ל-?psi|ב-?psi|ב-?bar|to c|to f/.test(s) || out.length===0){
    for(const [re, f] of conv){ const v = rx(s, re); if(v !== null && !(re.source.includes("bar") && /psi/.test(s) && rx(s,conv[0][0])!==null)) { out.push({ t:f(v), act:{ type:"sub", id:"convert" } }); break; } }
  }
  return out;
}

// ─── values the user measured ───
function measured(q, scan){
  const s = " " + q.toLowerCase() + " "; const out = [];
  const volt = rx(s, new RegExp(N+"\\s*(?:v|וולט|volt|volts)(?![a-zא-ת])"));
  const t = tokens(q);
  const isBatt = t.includes("_batt") || t.includes("_charge");
  if(volt !== null && isBatt && volt >= 9 && volt <= 16){
    let rest = ""; const row = BATTERY_TABLE.find(r=>volt >= parseFloat(r.v.replace(/[^\d.]/g,"")) ) || BATTERY_TABLE[BATTERY_TABLE.length-1];
    if(volt >= 12.6) rest = L("מלא (100%)","full (100%)"); else if(volt >= 12.4) rest = L("בערך 75%","about 75%"); else if(volt >= 12.2) rest = L("בערך 50% — כדאי לטעון","about 50% — charge it"); else if(volt >= 12.0) rest = L("בערך 25% — חלש, טען ובדוק בעומס","about 25% — weak, charge and load-test"); else rest = L("ריק או פגום — טען ובדוק; ייתכן שצריך להחליף","flat or faulty — charge and test; may need replacing");
    let run = volt < 13.2 ? L("נמוך — לא טוען (רצועה, אלטרנטור, כבל B+, טעינה חכמה)","low — not charging (belt, alternator, B+ cable, smart charging)") : volt <= 14.8 ? L("תקין","normal") : L("גבוה — טעינת יתר (וסת / אדמת אלטרנטור)","high — overcharging (regulator / alternator ground)");
    out.push({ t:L(`${volt}V — אם המנוע כבוי (במנוחה): ${rest}. אם המנוע עובד: ${run} (תקין 13.8–14.7V). בזמן התנעה לא אמור לרדת מתחת ל-9.6V.`,`${volt}V — engine off (at rest): ${rest}. Engine running: ${run} (normal 13.8–14.7V). While cranking it shouldn't drop below 9.6V.`), act: volt < 13.2 && volt > 12.8 ? { type:"tree", id:"charge" } : { type:"tree", id: volt < 12.4 ? "drain" : "charge" } });
  }
  const ohm = (()=>{ const m = new RegExp(N+"\\s*(k)?\\s*(?:Ω|ohm|ohms|אום|אוהם|אומ)").exec(s); return m ? parseFloat(m[1].replace(",","."))*(m[2]?1000:1) : null; })();
  if(ohm !== null && (t.includes("_can") || /6\s*(?:ל|-|ו|and|to)\s*-?14|פין 6|pin 6/.test(s))){
    const msg = ohm < 10 ? L("קצר בין CAN-H ל-CAN-L — נתק מודולים אחד-אחד וחפש חוט שפשוף / מחבר רטוב.","CAN-H shorted to CAN-L — unplug modules one by one and look for a chafed wire / wet connector.")
      : ohm < 50 ? L("נמוך מ-60Ω — יש נגד סיום עודף (מודול לא מקורי?) או קצר חלקי.","Below 60Ω — an extra terminator (aftermarket module?) or a partial short.")
      : ohm <= 70 ? L("תקין — שני נגדי הסיום במקום. אם יש בעיית תקשורת, בדוק מתחים (H≈2.6V, L≈2.4V) והזנות המודולים.","Normal — both terminators are present. If there's a comms issue, check voltages (H≈2.6V, L≈2.4V) and module supplies.")
      : ohm <= 140 ? L("בערך 120Ω — אחד מנגדי הסיום חסר: מודול מנותק, מחבר פתוח או קו CAN קטוע (לרוב ליד מחשב המנוע או לוח השעונים).","About 120Ω — one terminator is missing: an unplugged module, open connector or broken CAN line (often near the engine ECU or the cluster).")
      : L("פתוח — הקו לא מחובר בין השקע לרשת (Gateway, מחבר, חוט).","Open — the line isn't connected between the socket and the network (gateway, connector, wire).");
    out.push({ t:L(`מדדת ${ohm}Ω בין CAN-H ל-CAN-L: `,`You measured ${ohm}Ω between CAN-H and CAN-L: `) + msg, act:{ type:"circuit", id:"can" } });
  }
  const pct = rx(s, /([+-]?\d+(?:[.,]\d+)?)\s*%/);
  if(pct !== null && /ltft|stft|trim|תיקונ דלק|תיקון דלק|פיול טרים|fuel trim/.test(norm(s))){
    const msg = pct > 10 ? L("חיובי גבוה → המחשב מוסיף דלק כי הוא רואה תערובת דלה: דליפת ואקום (אם יורד בסל\"ד גבוה), MAF מלוכלך, לחץ דלק נמוך, מזרקים סתומים.","High positive → the ECU adds fuel because it sees lean: vacuum leak (if it drops at higher RPM), dirty MAF, low fuel pressure, clogged injectors.")
      : pct < -10 ? L("שלילי גבוה → המחשב מוריד דלק: מזרק דולף, לחץ דלק גבוה, שמן מדולל בדלק, MAF שמודד יותר מדי.","High negative → the ECU removes fuel: leaking injector, high fuel pressure, fuel-diluted oil, a MAF over-reading.")
      : L("בטווח תקין (±10%).","Within normal range (±10%).");
    out.push({ t:L(`תיקון דלק ${pct>0?"+":""}${pct}%: `,`Fuel trim ${pct>0?"+":""}${pct}%: `) + msg + L(" תמיד מסתכלים על קצר + ארוך יחד, בסרק וב-2500 סל\"ד."," Always look at short + long together, at idle and 2500 RPM."), act:{ type:"code", id: pct > 0 ? "P0171" : "P0172" } });
  }
  return out;
}

function pinAnswer(q){
  const s = norm(q); const out = [];
  const pin = /(?:פינ|pin|פינימ|pins)\s*(\d{1,2})/.exec(s);
  if(pin && (s.includes("obd") || /שקע/.test(s) || !/(?:הדק|terminal)/.test(s))){
    const P = { 1:L("שמור ליצרן (לפעמים הצתה / קו נוסף)","Manufacturer use (sometimes ignition / extra line)"), 2:"J1850+ (GM/Ford)", 4:L("אדמת שלדה","Chassis ground"), 5:L("אדמת אות","Signal ground"), 6:"CAN-H", 7:"K-Line (ISO 9141 / KWP2000)", 10:"J1850− (Ford PWM)", 14:"CAN-L", 15:"L-Line", 16:L("+12V קבוע מהמצבר","Permanent +12V from the battery") };
    const n = parseInt(pin[1]); if(n>=1 && n<=16) out.push({ t:L(`פין ${n} בשקע OBD: `,`OBD pin ${n}: `) + (P[n] || L("לא מוגדר בתקן — לפי היצרן (בהרבה רכבים: קו תקשורת נוסף או CAN שני)","Not defined by the standard — maker specific (often an extra comms line or a second CAN)")), act:{ type:"circuit", id:"obd" } });
  }
  const term = /(?:הדק|terminal|kl|קלמה)\s*(\d{1,2}[a-z]?)/.exec(s) || /(?:^| )(87a)(?: |$)/.exec(s) || (/(ממסר|relay|din|הדק)/.test(s) ? /(?:^| )(85|86|87|30|31|15|50|61|58|54|49a?|75)(?: |$)/.exec(s) : null);
  if(term && !out.length){ const k = term[1]; const row = DIN.find(([kk])=>kk.split(/\s*\/\s*/).includes(k)); if(row) out.push({ t:L(`הדק ${k} (DIN 72552): `,`Terminal ${k} (DIN 72552): `) + LX(row[1]), act:{ type:"sub", id:"ref" } }); }
  return out;
}
function wireColorAnswer(q){
  const s = norm(q); if(!/צבע|colou?r/.test(s)) return [];
  const make = Object.keys(WIRE_COLORS).find(k=>k!=="כללי" && s.includes(norm(k).split("/")[0]));
  const key = make || "כללי";
  const list = WIRE_COLORS[key].map((w,i)=>{ const e = EN && WIRE_COLORS_EN[key] && WIRE_COLORS_EN[key][i]; return `${e?e.n:w.n} — ${e?e.u:w.u}`; });
  return [{ t:L(`צבעי חוטים נפוצים (${key==="כללי"?"כללי":key}): `,`Common wire colours (${key==="כללי"?"general":key}): `) + list.join(" · ") + L(". ⚠️ תמיד לוודא מול הסכמה של הדגם."," . ⚠️ Always confirm against the model's diagram."), act:{ type:"sub", id:"wires" } }];
}

// ─── main entry ───
// ctx: { lang, vehicle, scan:{codes:{stored,pending,permanent}, vin, ready, ff, live}, current:{code}, notes, workLog, diagrams }
export function answer(q, ctx = {}){
  EN = ctx.lang === "en";
  const parts = []; const acts = []; let conf = 0;
  const pushAct = a => { if(a && !acts.some(x=>x.type===a.type && x.id===a.id)) acts.push(a); };
  const qn = norm(q); const tk = tokens(q);
  const scan = ctx.scan || null; const scanCodes = scan && scan.codes ? [...scan.codes.stored, ...scan.codes.pending, ...scan.codes.permanent] : [];

  // greeting / what can you do
  if(/^(היי|שלומ|הי|hello|hi|hey|בוקר טוב|ערב טוב|עזרה|help|מה אתה יודע|מה אתה יכול|what can you do)(?:\s|$|!)/.test(qn) && qn.length < 30){
    return { parts:[L("שלום! אני העוזר של AutoDiag Pro ואני עובד גם בלי אינטרנט. שאל אותי על קוד או כמה קודים יחד, על תקלה ('לא מתניע'), על ערך שמדדת ('מצבר 12.1V', '120 אום בין 6 ל-14'), על חיישן, הדק או פין, חישובים ('מפל מתח 4 מטר 1.5 ממ 15 אמפר'), או בקש 'נתח את הסריקה'.","Hi! I'm the AutoDiag Pro assistant and I work offline too. Ask me about a code or several codes together, a fault ('no start'), a value you measured ('battery 12.1V', '120 ohm between 6 and 14'), a sensor, terminal or pin, calculations ('voltage drop 4m 1.5mm 15A'), or say 'analyze the scan'.")], acts:[], conf:1, ctxText:"" };
  }

  // codes in the question (or "this code" / "the scan")
  let codes = findCodes(q);
  const wantsScan = /סריקה|סריקת|הסריקה|תנתח|נתח|הקודימ|הקודים|הרכב הזה|מה הבעיה|מה לא תקינ|scan|analy[sz]e|the codes|whats wrong|what is wrong/.test(qn);
  if(!codes.length && ctx.current && ctx.current.code && /הקוד הזה|הקוד|this code|זה אומר|מה זה אומר|הזה/.test(qn)) codes = [ctx.current.code];
  if(!codes.length && wantsScan && scanCodes.length) codes = scanCodes.slice(0,12);
  const known = codes.filter(c=>CODES_DB[c]);
  if(codes.length){
    conf = known.length ? 1 : 0.5;
    if(codes.length === 1){
      const c = codeT(codes[0]);
      if(c){
        parts.push(`**${c.code} — ${c.title}**\n${c.desc}`);
        parts.push(L(`חומרה: ${sevT(c.sev)} · אפשר לנסוע: ${c.safe}`,`Severity: ${sevT(c.sev)} · Safe to drive: ${c.safe}`));
        parts.push(L("**סיבות נפוצות:**","**Common causes:**") + "\n• " + c.causes.slice(0,5).join("\n• "));
        parts.push(L("**מה לבדוק, לפי הסדר:**","**What to check, in order:**") + "\n" + c.steps.slice(0,6).map((s,i)=>`${i+1}. ${s}`).join("\n"));
        if(c.loc) parts.push(L("📍 ","📍 ") + c.loc);
        pushAct({ type:"code", id:c.code }); const ci = circuitFor(c.code); if(ci) pushAct({ type:"circuit", id:ci });
        const rel = relatedCodes(c.code).slice(0,4); if(rel.length) parts.push(L("קודים קשורים: ","Related codes: ") + rel.join(", "));
      } else parts.push(L(`הקוד ${codes[0]} לא נמצא במאגר (${Object.keys(CODES_DB).length} קודים). ${/^P1|^P3|^B|^C|^U[1-3]/.test(codes[0])?"זה כנראה קוד יצרן — המשמעות תלויה ביצרן.":""}`,`Code ${codes[0]} isn't in the database (${Object.keys(CODES_DB).length} codes). ${/^P1|^P3|^B|^C|^U[1-3]/.test(codes[0])?"It's probably a manufacturer code — the meaning depends on the make.":""}`));
    } else {
      const lines = codes.map(c=>{ const x = codeT(c); return x ? `• ${c} — ${x.title}` : `• ${c} — ${L("לא במאגר","not in the database")}`; });
      parts.push(L(`**${codes.length} קודים:**`,`**${codes.length} codes:**`) + "\n" + lines.join("\n"));
      const combo = comboRules(codes);
      if(combo.length) parts.push(L("**מה הם אומרים ביחד:**","**What they say together:**") + "\n• " + combo.join("\n• "));
      else parts.push(L("לא מצאתי קשר ידוע בין הקודים — טפל בכל אחד לפי הסדר: קודם קודי מתח ותקשורת, אחר כך חיישנים, ובסוף קודי ביצועים (קטליזטור, תיקוני דלק).","No known link between these codes — handle them in order: voltage and comms codes first, then sensors, and performance codes (catalyst, fuel trim) last."));
      known.slice(0,4).forEach(c=>pushAct({ type:"code", id:c }));
    }
    if(wantsScan && scan){ const f = scanFindings(scan); if(f.length) parts.push(L("**מהסריקה:**","**From the scan:**") + "\n• " + f.join("\n• ")); }
    if(scan && scan.codes && codes.some(c=>scan.codes.pending.includes(c))) parts.push(L("קוד 'ממתין' = התקלה זוהתה פעם אחת ועדיין לא אושרה. אם היא חוזרת בנסיעה הבאה — הנורית תידלק.","A 'pending' code = the fault was seen once and not yet confirmed. If it repeats next drive — the lamp comes on."));
  }
  else if(wantsScan && scan){
    const f = scanFindings(scan); conf = 1;
    parts.push(scanCodes.length ? "" : L("✅ אין קודי תקלה בסריקה האחרונה.","✅ No fault codes in the last scan."));
    if(f.length) parts.push(L("**מה רואים בנתונים:**","**What the data shows:**") + "\n• " + f.join("\n• ")); else parts.push(L("הנתונים החיים שנקראו נראים תקינים.","The live data that was read looks normal."));
    pushAct({ type:"tab", id:"scan" });
  }
  else if(wantsScan && !scan && !codes.length){
    parts.push(L("אין עדיין סריקה. חבר את הסורק (או לחץ 'הדגמה'), קרא קודים ונתונים חיים — ואז שאל אותי שוב 'נתח את הסריקה'.","No scan yet. Connect the scanner (or tap 'Demo'), read codes and live data — then ask me again 'analyze the scan'."));
    pushAct({ type:"tab", id:"scan" }); conf = 0.9;
  }

  // calculations, measured values, pins, wire colours
  if(!codes.length){
    for(const r of [...calc(q), ...measured(q, scan), ...pinAnswer(q), ...wireColorAnswer(q)]){ parts.push(r.t); pushAct(r.act); conf = Math.max(conf, 0.95); }
  }

  // the user's own data: plates, notes, log
  const plateM = /(?:^|\D)(\d{2,3}-\d{2,3}-\d{2,3}|\d{7,8})(?:\D|$)/.exec(q);
  if(plateM && !codes.length){
    const d = plateM[1].replace(/\D/g,""); const logs = (ctx.workLog||[]).filter(w=>String(w.plate||"").replace(/\D/g,"")===d);
    if(logs.length){ parts.push(L(`**ביומן יש ${logs.length} רשומות לרכב ${plateM[1]}:**`,`**${logs.length} log entries for ${plateM[1]}:**`) + "\n" + logs.slice(0,5).map(w=>`• ${(w.at||"").slice(0,10)} — ${(w.desc||"").slice(0,90)}${w.codes&&w.codes.length?` [${w.codes.join(", ")}]`:""}`).join("\n")); pushAct({ type:"log", id:d }); conf = Math.max(conf, 1); }
    else { parts.push(L(`אין ביומן רשומות לרכב ${plateM[1]}.`,`No log entries for ${plateM[1]}.`)); }
    pushAct({ type:"plate", id:d });
  }

  // retrieval over everything (+ user notes / log / diagrams as extra docs)
  const extra = [];
  for(const [k, arr] of Object.entries(ctx.notes||{})) (arr||[]).forEach(n=>{ if(n.text) extra.push({ kind:"note", id:k, title:k.replace(/^c_|^obd_|^m_/,"").replace(/_/g," "), body:n.text, w:1.3, raw:n }); });
  (ctx.workLog||[]).slice(0,300).forEach(w=>extra.push({ kind:"log", id:w.id, title:`${w.plate||""} ${(w.codes||[]).join(" ")}`, body:w.desc||"", w:1.0, raw:w }));
  (ctx.diagrams||[]).forEach(m=>extra.push({ kind:"diagram", id:m.id, title:`${m.make||""} ${m.model||""} ${m.title||""}`, body:`${m.notes||""} ${(m.marks||[]).map(x=>x.text).join(" ")} ${m.system||""}`, w:1.2, raw:m }));
  const hits = search(q, extra, 8);
  const top = hits[0];
  const topScore = top ? top.s : 0;
  const ctxDocs = [];
  if(!parts.length && hits.length){
    // the strongest answer first, then pointers to the rest
    const strong = hits.filter(h=>h.s >= topScore*0.7).slice(0,3);
    for(const h of strong){ const r = docAnswer(h.d, ctx); if(r){ parts.push(r.t); pushAct(r.act); ctxDocs.push(r.t); } }
    const more = hits.filter(h=>!strong.includes(h)).slice(0,4).map(h=>docTitle(h.d)).filter(Boolean);
    if(more.length) parts.push(L("עוד בנושא: ","Also related: ") + more.join(" · "));
    conf = Math.min(1, topScore/7) * (top.frac >= 0.75 ? 1 : top.frac >= 0.5 ? 0.75 : 0.45);
  } else if(hits.length){ for(const h of hits.slice(0,3)){ const r = docAnswer(h.d, ctx); if(r) ctxDocs.push(r.t); } }

  if(!parts.filter(Boolean).length){
    parts.push(L("לא מצאתי תשובה טובה במידע שבאפליקציה. נסה לנסח עם מילת מפתח (קוד, שם חיישן, תקלה), או חבר מפתח AI בהגדרות העוזר כדי לקבל תשובה מהרשת.","I couldn't find a good answer in the app's information. Try a keyword (a code, sensor name, fault), or connect an AI key in the assistant settings for an online answer."));
    conf = 0;
  }
  // a little vehicle awareness
  if(ctx.vehicle && (conf > 0) && (tk.includes("_diagram") || tk.includes("_gnd"))){ pushAct({ type:"lib", id:"veh" }); }
  return { parts: parts.filter(Boolean), acts: acts.slice(0,6), conf, ctxText: [parts.join("\n\n"), ...ctxDocs].join("\n\n").slice(0,6000) };
}

function docTitle(d){
  switch(d.kind){
    case "code": return `${d.id}`;
    case "circuit": { const c = CIRCUITS.find(x=>x.id===d.id); return c ? LX({ he:c.he.title, en:c.en.title }) : ""; }
    case "tree": { const t = TREES.find(x=>x.id===d.id); return t ? LX(t.title) : ""; }
    case "ref": { const s = SECTIONS.find(x=>x.id===d.id); return s ? LX(s.title) : ""; }
    case "sensor": return EN ? (SENSORS_EN[d.id]||{}).name : SENSOR_REF[d.id].name;
    case "symptom": return EN ? (SYMPTOMS_EN[d.id]||{}).text : (SYMPTOMS.find(s=>s.id===d.id)||{}).text;
    case "help": { const h = HELP.find(x=>x.id===d.id); return h ? LX({ he:h.he.q, en:h.en.q }) : ""; }
    case "note": return L("ההערה שלך: ","Your note: ") + d.title;
    case "log": return L("יומן: ","Log: ") + d.raw.plate;
    case "diagram": return L("סכמה: ","Diagram: ") + d.title.trim();
    default: return "";
  }
}
function docAnswer(d, ctx){
  switch(d.kind){
    case "code": { const c = codeT(d.id); return c ? { t:`**${c.code} — ${c.title}**\n${c.desc}\n• ${c.causes.slice(0,3).join("\n• ")}`, act:{ type:"code", id:c.code } } : null; }
    case "circuit": { const c = CIRCUITS.find(x=>x.id===d.id); if(!c) return null; const x = EN ? c.en : c.he; return { t:`**📘 ${x.title}**\n${x.desc}\n` + L("מה לבדוק:","What to check:") + "\n• " + x.tests.slice(0,6).join("\n• "), act:{ type:"circuit", id:c.id } }; }
    case "tree": { const t = TREES.find(x=>x.id===d.id); if(!t) return null; const n = t.nodes[t.start]; return { t:`**🧭 ${LX(t.title)}**\n` + L("יש לזה עץ אבחון צעד אחר צעד. השאלה הראשונה: ","There's a step-by-step tree for this. First question: ") + LX(n.q) + "\n• " + n.opts.map(o=>LX(o.t)).join("\n• "), act:{ type:"tree", id:t.id } }; }
    case "ref": { const s = SECTIONS.find(x=>x.id===d.id); if(!s) return null; return { t:`**📖 ${LX(s.title)}**\n• ` + s.items.map(LX).join("\n• "), act:{ type:"sub", id:"ref" } }; }
    case "din": return { t:L("**מספרי הדקים (DIN 72552):**\n","**Terminal numbers (DIN 72552):**\n") + DIN.map(([k,v])=>`• ${k} — ${LX(v)}`).join("\n"), act:{ type:"sub", id:"ref" } };
    case "wires": return { t:L("**עובי חוט מול זרם רציף (חוט קצר בצרור):**\n","**Wire size vs continuous current (short run, bundled):**\n") + WIRES.map(w=>`• ${w[0]}mm² (AWG ${w[1]}) — ${w[2]}A`).join("\n"), act:{ type:"sub", id:"calc" } };
    case "fuses": return { t:L("**צבעי נתיכים:** ","**Fuse colours:** ") + FUSES.map(f=>`${f[0]}A ${LX(f[2])}`).join(" · "), act:{ type:"sub", id:"ref" } };
    case "proto": return { t:L("**פרוטוקולי OBD:**\n","**OBD protocols:**\n") + PROTOCOLS.map(p=>`• ${p[0]} (${L("פינים","pins")} ${p[1]}) — ${LX(p[2])}`).join("\n"), act:{ type:"sub", id:"ref" } };
    case "sensor": { const s = SENSOR_REF[d.id], e = SENSORS_EN[d.id]||{}; const x = EN ? { ...s, ...e } : s; return { t:`**📊 ${x.name}**\n${L("מתח","Voltage")}: ${x.voltage} · ${L("התנגדות","Resistance")}: ${x.resist}\n${x.notes}`, act:{ type:"sub", id:"sensors" } }; }
    case "symptom": { const s = SYMPTOMS.find(x=>x.id===d.id); const e = SYMPTOMS_EN[d.id]; const x = EN && e ? e : s; return { t:`**${x.text}**\n${x.tip}\n${L("קודים אפשריים","Possible codes")}: ${s.codes.slice(0,8).join(", ")}`, act:{ type:"sub", id:"diag" } }; }
    case "dict": { const x = DICT[d.id]; return { t:`**${x.en}** — ${x.he}`, act:null }; }
    case "help": { const h = HELP.find(x=>x.id===d.id); return { t:`**${LX({ he:h.he.q, en:h.en.q })}**\n${LX({ he:h.he.a, en:h.en.a })}`, act:h.act||null }; }
    case "note": return { t:L(`📝 **ההערה שלך (${d.title}):** `,`📝 **Your note (${d.title}):** `) + d.body, act: d.id.startsWith("c_") ? { type:"code", id:d.id.slice(2) } : null };
    case "log": return { t:L(`📋 **מהיומן — ${d.raw.plate}:** `,`📋 **From the log — ${d.raw.plate}:** `) + (d.raw.desc||"").slice(0,200), act:{ type:"log", id:String(d.raw.plate||"").replace(/\D/g,"") } };
    case "diagram": return { t:L(`📐 **יש לך סכמה שמורה:** `,`📐 **You have a saved diagram:** `) + `${d.raw.make} ${d.raw.model||""} — ${d.raw.title||""}`, act:{ type:"diagram", id:d.id } };
    default: return null;
  }
}

// suggestions shown in an empty chat
export function suggestions(ctx = {}){
  EN = ctx.lang === "en"; const s = [];
  if(ctx.scan && ctx.scan.codes) s.push(L("נתח את הסריקה","Analyze the scan"));
  if(ctx.current && ctx.current.code) s.push(L(`מה לבדוק ב-${ctx.current.code}?`,`What to check for ${ctx.current.code}?`));
  s.push(L("P0171 ו-P0174 ביחד","P0171 and P0174 together"), L("הרכב מסתובב ולא מתניע","Car cranks but won't start"), L("מצבר 12.1 וולט","Battery 12.1 volts"), L("מדדתי 120 אום בין 6 ל-14","I measured 120 ohm between 6 and 14"), L("מפל מתח 4 מטר 1.5 ממ 15 אמפר","Voltage drop 4m 1.5mm 15A"), L("איך בודקים ממסר?","How do I test a relay?"));
  return s.slice(0,6);
}

// context block for the online AI (what the app knows right now)
export function aiContext(ctx = {}){
  EN = ctx.lang === "en"; const lines = [];
  const v = ctx.vehicle; if(v) lines.push(`Vehicle: ${[v.makeEn||v.maker||v.makeHe, v.model, v.year].filter(Boolean).join(" ")}; engine ${v.engineCode||"?"} ${v.cc?v.cc+"cc":""} ${v.fuel||""}; VIN ${v.vin||"?"}`);
  const sc = ctx.scan; if(sc && sc.codes) lines.push(`Last scan — stored: ${sc.codes.stored.join(",")||"none"}; pending: ${sc.codes.pending.join(",")||"none"}; permanent: ${sc.codes.permanent.join(",")||"none"}${sc.vin?`; VIN ${sc.vin}`:""}`);
  if(sc && sc.live && Object.keys(sc.live).length) lines.push("Live data: " + Object.entries(sc.live).map(([k,v])=>`${k}=${v}`).join(", "));
  if(sc && sc.ff) lines.push("Freeze frame for " + (sc.ff.code||"?") + ": " + Object.entries(sc.ff.vals||{}).map(([k,v])=>`${k}=${v}`).join(", "));
  if(sc && sc.ready) lines.push("Readiness incomplete: " + sc.ready.monitors.filter(m=>!m.done).map(m=>m.key).join(",") + (sc.ready.mil?"; MIL on":""));
  return lines.join("\n");
}
