// AutoDiag Pro — typical (generic) circuit diagrams, drawn as SVG.
// These are teaching diagrams of common automotive circuits, not factory diagrams of any one model.
// Labels inside the drawing are language-neutral (pin numbers, BAT, ECU...). Text around it is he/en.

const C = { bp:"#E53935", gnd:"#8D6E63", ign:"#FFB300", sig:"#42A5F5", ecu:"#AB47BC", canH:"#FB8C00", canL:"#43A047", ref:"#26C6DA" };

const w = (pts, col, sw=2.4) => `<polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
const t = (x, y, s, o={}) => `<text x="${x}" y="${y}" font-size="${o.size||10}" font-weight="${o.bold?700:500}" fill="${o.col||"currentColor"}" text-anchor="${o.anchor||"middle"}" font-family="Arial,sans-serif">${s}</text>`;
const dot = (x, y, col="currentColor") => `<circle cx="${x}" cy="${y}" r="3" fill="${col}"/>`;
const box = (x, y, wd, h, label, o={}) => `<rect x="${x}" y="${y}" width="${wd}" height="${h}" rx="6" fill="none" stroke="${o.col||"currentColor"}" stroke-width="1.6" ${o.dash?'stroke-dasharray="4 3"':''}/>` + (label ? t(x+wd/2, y+(o.ly||14), label, { bold:true, col:o.col, size:o.size||10 }) : "");
const gnd = (x, y) => `<g stroke="${C.gnd}" stroke-width="2"><line x1="${x}" y1="${y}" x2="${x}" y2="${y+6}"/><line x1="${x-9}" y1="${y+6}" x2="${x+9}" y2="${y+6}"/><line x1="${x-6}" y1="${y+10}" x2="${x+6}" y2="${y+10}"/><line x1="${x-3}" y1="${y+14}" x2="${x+3}" y2="${y+14}"/></g>`;
const bat = (x, y) => `<g stroke="currentColor" stroke-width="2"><line x1="${x-12}" y1="${y}" x2="${x+12}" y2="${y}"/><line x1="${x-7}" y1="${y+6}" x2="${x+7}" y2="${y+6}" stroke-width="3.5"/><line x1="${x-12}" y1="${y+12}" x2="${x+12}" y2="${y+12}"/><line x1="${x-7}" y1="${y+18}" x2="${x+7}" y2="${y+18}" stroke-width="3.5"/></g>${t(x-24,y+6,"+",{size:13,bold:true,col:C.bp})}${t(x-24,y+20,"−",{size:13,bold:true})}${t(x+30,y+14,"BAT",{bold:true})}`;
const fuse = (x, y, vert=false) => vert
  ? `<rect x="${x-5}" y="${y-11}" width="10" height="22" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="${x}" y1="${y-8}" x2="${x}" y2="${y+8}" stroke="currentColor" stroke-width="1"/>`
  : `<rect x="${x-11}" y="${y-5}" width="22" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="${x-8}" y1="${y}" x2="${x+8}" y2="${y}" stroke="currentColor" stroke-width="1"/>`;
const motor = (x, y, l="M") => `<circle cx="${x}" cy="${y}" r="15" fill="none" stroke="currentColor" stroke-width="1.8"/>${t(x,y+5,l,{size:13,bold:true})}`;
const lamp = (x, y) => `<circle cx="${x}" cy="${y}" r="12" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="${x-8}" y1="${y-8}" x2="${x+8}" y2="${y+8}" stroke="currentColor" stroke-width="1.5"/><line x1="${x+8}" y1="${y-8}" x2="${x-8}" y2="${y+8}" stroke="currentColor" stroke-width="1.5"/>`;
const coil = (x, y, h=30) => `<rect x="${x-7}" y="${y}" width="14" height="${h}" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><line x1="${x-7}" y1="${y+h}" x2="${x+7}" y2="${y}" stroke="currentColor" stroke-width="1"/>`;
const swOpen = (x1, y, x2) => `${dot(x1,y)}${dot(x2,y)}<line x1="${x1}" y1="${y}" x2="${x2-3}" y2="${y-10}" stroke="currentColor" stroke-width="2"/>`;
const res = (x, y, vert=true, l="") => (vert
  ? `<rect x="${x-6}" y="${y-14}" width="12" height="28" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>`
  : `<rect x="${x-14}" y="${y-6}" width="28" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/>`) + (l ? t(vert?x+22:x, vert?y+4:y-10, l, { size:9, bold:true }) : "");
const meter = (x, y, l="V") => `<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="${C.sig}" stroke-width="1.8" stroke-dasharray="3 2"/>${t(x,y+4,l,{size:11,bold:true,col:C.sig})}`;
const svg = (inner, h=230) => `<svg viewBox="0 0 360 ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block" role="img">${inner}</svg>`;

// ─── drawings ───
function dRelay(){
  return svg(
    bat(30,20) + w([[30,20],[30,8],[110,8]],C.bp) + fuse(122,8) + w([[133,8],[200,8],[200,60]],C.bp) +
    box(160,46,110,104,"RELAY",{ly:14}) +
    t(200,72,"30",{size:9,bold:true,col:C.bp}) + swOpen(200,100,236) + w([[200,62],[200,100]],"currentColor",1.6) + t(236,116,"87",{size:9,bold:true}) +
    coil(180,110,26) + t(170,108,"86",{size:9,bold:true,col:C.ign}) + t(170,142,"85",{size:9,bold:true,col:C.ecu}) +
    w([[236,100],[236,90],[300,90],[300,130]],"#90A4AE") + fuse(300,72,true) + motor(300,150) + w([[300,165],[300,190]],C.gnd) + gnd(300,190) +
    t(70,82,"IGN 15",{bold:true,col:C.ign}) + w([[70,90],[70,110],[180,110]],C.ign) + fuse(110,110) +
    box(40,170,90,42,"ECU",{col:C.ecu}) + w([[180,136],[180,192],[130,192]],C.ecu) + t(85,204,"⏚ driver",{size:9,col:C.ecu}) + w([[30,38],[30,190]],C.gnd) + gnd(30,190)
  );
}
function dStarter(){
  return svg(
    bat(40,20) + w([[40,20],[40,8],[260,8],[260,60]],C.bp,4.5) + t(150,22,"30 / B+ (25–35 mm²)",{size:9,col:C.bp}) +
    box(225,60,90,70,"STARTER",{ly:14}) + motor(270,102) + t(250,152,"50",{size:10,bold:true,col:C.ign}) +
    t(70,70,"IGN 50",{bold:true,col:C.ign}) + box(30,80,80,34,"KEY / ECU",{ly:21,size:9}) +
    w([[110,97],[140,97]],C.ign) + box(140,82,56,30,"P/N",{ly:20,size:9}) + w([[196,97],[215,97],[215,140],[250,140],[250,130]],C.ign) +
    w([[270,130],[270,185]],C.gnd,4) + t(300,170,"engine",{size:9}) + w([[40,38],[40,185],[270,185]],C.gnd,4) + gnd(155,185) +
    meter(150,60,"V") + w([[137,60],[120,60],[120,8]],C.sig,1.2) + w([[163,60],[180,60],[180,40],[262,40]],C.sig,1.2)
  );
}
function dCharging(){
  return svg(
    bat(40,20) + w([[40,20],[40,8],[150,8]],C.bp,4) + fuse(162,8) + t(162,26,"MEGA",{size:8}) + w([[173,8],[280,8],[280,60]],C.bp,4) +
    box(235,60,95,95,"ALT",{ly:14}) + t(260,88,"B+",{size:10,bold:true,col:C.bp}) + motor(282,115,"G") +
    t(70,70,"IGN 15",{bold:true,col:C.ign}) + w([[70,78],[70,110],[120,110]],C.ign) + lamp(135,110) + w([[147,110],[235,110]],C.ign) + t(226,104,"L/D+",{size:9,bold:true}) +
    box(40,160,90,42,"ECU / BCM",{col:C.ecu,size:9}) + w([[130,180],[220,180],[220,140],[235,140]],C.ecu,1.8) + t(180,174,"LIN / COM",{size:9,col:C.ecu}) +
    w([[282,155],[282,200]],C.gnd,3) + gnd(282,200) + w([[40,38],[40,140]],C.gnd,3) + gnd(40,140)
  );
}
function dHeadlight(){
  return svg(
    bat(30,20) + w([[30,20],[30,8],[90,8]],C.bp) + fuse(102,8) + w([[113,8],[170,8],[170,40]],C.bp) +
    box(140,40,80,70,"RELAY",{ly:14}) + swOpen(170,72,200) + w([[170,40],[170,72]],"currentColor",1.4) + coil(158,82,20) +
    t(60,70,"SW",{bold:true,col:C.ign}) + swOpen(40,90,80) + w([[30,38],[30,90],[40,90]],C.bp) + w([[80,90],[150,90],[150,82],[158,82]],C.ign) + w([[158,102],[158,135]],C.gnd) + gnd(158,135) +
    w([[200,72],[260,72]],"#90A4AE") + dot(260,72) + w([[260,72],[260,40],[300,40]],"#90A4AE") + w([[260,72],[260,120],[300,120]],"#90A4AE") +
    fuse(280,40) + fuse(280,120) + lamp(315,40) + lamp(315,120) + t(340,44,"L",{bold:true}) + t(340,124,"R",{bold:true}) +
    w([[315,52],[315,70],[350,70],[350,190]],C.gnd) + w([[315,132],[315,190],[350,190]],C.gnd) + gnd(332,190) + t(305,212,"G",{bold:true,col:C.gnd})
  );
}
function dWindow(){
  return svg(
    bat(30,20) + w([[30,20],[30,8],[90,8]],C.bp) + fuse(102,8) + w([[113,8],[220,8]],C.bp) + t(232,12,"B+",{size:9,bold:true,col:C.bp}) +
    box(90,40,160,80,"SWITCH",{ly:14}) +
    t(130,60,"UP",{size:9,bold:true}) + t(210,60,"DOWN",{size:9,bold:true}) +
    swOpen(120,85,140) + swOpen(200,85,220) + w([[120,85],[120,8]],C.bp,1.4) + w([[220,85],[220,8]],C.bp,1.4) +
    w([[140,85],[140,110],[160,110]],C.gnd,1.4) + w([[200,85],[200,110],[180,110]],C.gnd,1.4) + w([[170,110],[170,140]],C.gnd) + gnd(170,140) +
    w([[130,120],[130,175],[155,175]],"#90A4AE") + w([[210,120],[210,175],[185,175]],"#90A4AE") + motor(170,175) +
    t(105,200,"+12 ↑ / 0 ↓",{size:9,col:C.sig}) + t(240,200,"0 ↑ / +12 ↓",{size:9,col:C.sig})
  );
}
function dSensor3(){
  return svg(
    box(20,30,110,170,"ECU",{col:C.ecu}) + t(75,64,"5V REF",{size:9,col:C.ref,bold:true}) + t(75,114,"SIGNAL",{size:9,col:C.sig,bold:true}) + t(75,164,"SENSOR ⏚",{size:9,col:C.gnd,bold:true}) +
    w([[130,60],[240,60]],C.ref) + w([[130,110],[240,110]],C.sig) + w([[130,160],[240,160]],C.gnd) +
    box(240,40,90,140,"SENSOR",{ly:16}) + res(285,110,true) + w([[285,60],[285,96]],"currentColor",1.4) + w([[285,124],[285,160]],"currentColor",1.4) +
    `<line x1="265" y1="128" x2="305" y2="92" stroke="currentColor" stroke-width="1.5"/>` +
    t(185,52,"4.9–5.1 V",{size:9,col:C.ref}) + t(185,102,"0.5–4.5 V",{size:9,col:C.sig}) + t(185,152,"< 0.1 V",{size:9,col:C.gnd}) + t(285,198,"TPS / MAP / APP / Rail",{size:9})
  );
}
function dNtc(){
  return svg(
    box(20,30,140,170,"ECU",{col:C.ecu}) + t(60,62,"5V",{size:10,bold:true,col:C.ref}) + w([[60,68],[60,82]],C.ref,1.6) + res(60,100,true,"~2.2k") + w([[60,114],[60,130],[160,130]],C.sig,1.6) + dot(60,130) +
    w([[60,130],[60,150],[100,150]],C.sig,1.2) + box(100,140,48,22,"A/D",{ly:15,size:9}) +
    w([[160,130],[260,130]],C.sig) + w([[160,180],[260,180]],C.gnd) + t(110,186,"⏚",{size:12,col:C.gnd}) + w([[130,180],[160,180]],C.gnd,1.6) +
    box(250,100,80,100,"NTC",{ly:16}) + res(290,155,true) + w([[290,130],[290,141]],"currentColor",1.4) + w([[290,169],[290,180]],"currentColor",1.4) +
    `<line x1="272" y1="170" x2="308" y2="140" stroke="currentColor" stroke-width="1.5"/>` + t(205,122,"signal",{size:9,col:C.sig}) + t(205,172,"sensor ⏚",{size:9,col:C.gnd})
  );
}
function dInjector(){
  return svg(
    t(50,24,"MAIN RELAY",{size:9,bold:true}) + w([[50,30],[50,60],[90,60]],C.bp) + fuse(102,60) + w([[113,60],[170,60]],C.bp) + dot(170,60) +
    w([[170,60],[220,60]],C.bp) + w([[170,60],[170,120],[220,120]],C.bp) + coil(230,48,24) + coil(230,108,24) +
    t(275,64,"INJ",{size:9,bold:true}) + t(275,124,"COIL",{size:9,bold:true}) +
    w([[237,72],[237,85],[300,85],[300,170]],C.ecu) + w([[237,132],[237,145],[290,145],[290,170]],C.ecu) +
    box(250,170,90,42,"ECU",{col:C.ecu}) + t(160,200,"ECU switches ⏚ (low side)",{size:9,col:C.ecu})
  );
}
function dCan(){
  const node = (x, l) => box(x,95,58,40,l,{ly:24,size:9}) + w([[x+18,95],[x+18,60]],C.canH,1.6) + w([[x+40,135],[x+40,170]],C.canL,1.6);
  const term = x => w([[x,60],[x,101]],C.canH,1.6) + res(x,115,true) + w([[x,129],[x,170]],C.canL,1.6) + t(x,192,"120Ω",{size:9,bold:true});
  return svg(
    w([[25,60],[335,60]],C.canH,3) + w([[25,170],[335,170]],C.canL,3) + t(42,52,"CAN-H",{size:9,bold:true,col:C.canH,anchor:"start"}) + t(42,162,"CAN-L",{size:9,bold:true,col:C.canL,anchor:"start"}) +
    term(25) + term(335) + node(50,"ECU") + node(118,"ABS") + node(186,"OBD 6/14") + node(254,"BCM") +
    t(180,218,"6–14 = 60Ω  ·  H ≈ 2.6 V  ·  L ≈ 2.4 V",{size:10,bold:true,col:C.sig})
  );
}
function dObd(){
  const pin = (n, x, y, col, lab) => `<rect x="${x}" y="${y}" width="34" height="30" rx="4" fill="${col?col+"33":"none"}" stroke="${col||"currentColor"}" stroke-width="1.4"/>${t(x+17,y+13,n,{size:11,bold:true,col:col||"currentColor"})}${lab?t(x+17,y+25,lab,{size:7,col:col}):""}`;
  const P = { 2:[C.sig,"J1850+"], 4:[C.gnd,"GND"], 5:[C.gnd,"SGND"], 6:[C.canH,"CAN-H"], 7:[C.ign,"K"], 10:[C.sig,"J1850−"], 14:[C.canL,"CAN-L"], 15:[C.ign,"L"], 16:[C.bp,"12V"] };
  let s = `<path d="M30 40 H330 L310 160 H50 Z" fill="none" stroke="currentColor" stroke-width="2"/>`;
  for(let i=1;i<=8;i++){ const p=P[i]||[]; s += pin(String(i), 30+i*33.5, 55, p[0], p[1]); }
  for(let i=9;i<=16;i++){ const p=P[i]||[]; s += pin(String(i), 30+(i-8)*33.5, 105, p[0], p[1]); }
  return svg(s + t(180,185,"(female socket, front view)",{size:9}) + t(180,205,"pin numbers are molded on the socket",{size:9}), 220);
}
function dDrop(){
  return svg(
    bat(40,20) + w([[40,20],[40,8],[280,8],[280,70]],C.bp,3) + motor(280,100) + w([[280,115],[280,180],[40,180],[40,38]],C.gnd,3) +
    meter(160,40,"V") + w([[147,40],[60,40],[60,10]],C.sig,1.2) + w([[173,40],[268,40],[268,72]],C.sig,1.2) + t(160,66,"+ side < 0.5 V",{size:9,col:C.sig,bold:true}) +
    meter(160,150,"V") + w([[147,150],[60,150],[60,178]],C.sig,1.2) + w([[173,150],[268,150],[268,118]],C.sig,1.2) + t(160,130,"⏚ side < 0.2 V",{size:9,col:C.sig,bold:true}) +
    t(180,214,"measure WITH the load running",{size:10,bold:true})
  );
}

// ─── texts ───
export const CIRCUITS = [
  { id:"relay", icon:"🔁", draw:dRelay,
    he:{ title:"מעגל ממסר (משאבת דלק / מאוורר / צופר)", desc:"הצרכן מקבל זרם גבוה דרך מגעי הממסר (30→87). סליל הממסר (86–85) מקבל +12V מההצתה, והמחשב סוגר אותו לאדמה.", tests:["פין 30: ‏12V קבוע תמיד (גם בלי הצתה, ברוב המעגלים)","פין 86: ‏12V עם הצתה","פין 85: המחשב מוריד לאדמה כשהוא מפעיל (0V בזמן פעולה)","פין 87: ‏12V רק כשהממסר נדלק","התנגדות סליל 86–85: בערך ‎50–120Ω","מפל מתח 30→87 בעומס: פחות מ-0.2V","בדיקת עקיפה: גשר (עם נתיך!) בין 30 ל-87 בבסיס — אם הצרכן עובד, הבעיה בממסר או בפיקוד"] },
    en:{ title:"Relay circuit (fuel pump / fan / horn)", desc:"The load gets its high current through the relay contacts (30→87). The coil (86–85) gets +12V from ignition and the ECU switches it to ground.", tests:["Pin 30: constant 12V (even with ignition off, in most circuits)","Pin 86: 12V with ignition on","Pin 85: pulled to ground by the ECU when commanded (0V when active)","Pin 87: 12V only when the relay is energized","Coil resistance 86–85: about 50–120Ω","Voltage drop 30→87 under load: below 0.2V","Bypass test: fused jumper 30→87 in the socket — if the load runs, the fault is the relay or its control"] } },
  { id:"starter", icon:"🔑", draw:dStarter,
    he:{ title:"מעגל התנעה", desc:"כבל עבה מהמצבר לסטרטר (30). כשמסובבים מפתח / לוחצים START מגיע 12V לפין 50 (דרך מתג ניוטרל/מצמד), הסולנואיד סוגר והסטרטר מסתובב.", tests:["מצבר במנוחה: ‏12.4V ומעלה","בזמן התנעה: לא פחות מ-9.6V","מפל מתח בכבל הפלוס בזמן התנעה: פחות מ-0.5V","מפל מתח בצד האדמה (מנוע↔מצבר): פחות מ-0.3V","פין 50 בזמן התנעה: יותר מ-10V","רק 'קליק' עם מתח תקין בפין 50 → מגעי סולנואיד / סטרטר","אין 12V בפין 50 → מתג ניוטרל/מצמד, ממסר התנעה, אימובילייזר"] },
    en:{ title:"Starting circuit", desc:"A heavy cable runs from the battery to the starter (30). With the key / START button, 12V reaches pin 50 (through the neutral/clutch switch), the solenoid closes and the starter turns.", tests:["Battery at rest: 12.4V or more","While cranking: not below 9.6V","Voltage drop on the positive cable while cranking: below 0.5V","Ground side drop (engine↔battery): below 0.3V","Pin 50 while cranking: above 10V","Only a 'click' with good voltage at pin 50 → solenoid contacts / starter","No 12V at pin 50 → neutral/clutch switch, start relay, immobilizer"] } },
  { id:"charging", icon:"⚡", draw:dCharging,
    he:{ title:"מעגל טעינה (אלטרנטור)", desc:"B+ של האלטרנטור מחובר למצבר דרך נתיך ראשי. נורית הטעינה (L/D+) מקבלת מתח מההצתה. ברכבים חדשים המחשב שולט במתח הטעינה (LIN/COM) — 'טעינה חכמה'.", tests:["מנוע עובד, בלי עומס: ‏13.8–14.7V (בטעינה חכמה: 12.5–15V משתנה)","עם עומס (אורות, מאוורר, חימום שמשה): לא יורד מתחת ל-13.2V","מפל מתח B+ → מצבר בעומס: פחות מ-0.3V","אדוות AC על המצבר: פחות מ-0.5V AC (יותר = דיודה פגומה)","נורית טעינה דולקת עם מנוע עובד → אין טעינה או תקלת פיקוד","בדוק רצועה ומתיחה לפני שמחליפים אלטרנטור"] },
    en:{ title:"Charging circuit (alternator)", desc:"Alternator B+ connects to the battery through a main fuse. The charge lamp (L/D+) gets ignition voltage. In newer cars the ECU controls charging voltage (LIN/COM) — 'smart charging'.", tests:["Engine running, no load: 13.8–14.7V (smart charging: 12.5–15V, varies)","With load (lights, fan, rear demister): not below 13.2V","Drop from B+ to battery under load: below 0.3V","AC ripple at the battery: below 0.5V AC (more = bad diode)","Charge lamp on with engine running → not charging or control fault","Check the belt and tension before replacing the alternator"] } },
  { id:"headlight", icon:"💡", draw:dHeadlight,
    he:{ title:"פנסים עם ממסר", desc:"המתג מפעיל רק את סליל הממסר. הזרם לפנסים עובר דרך הממסר ונתיך נפרד לכל צד, והאדמה חוזרת לנקודת הארקה משותפת (G). ברכבים חדשים מודול הגוף (BCM) מפעיל את הפנסים ישירות.", tests:["מדוד מתח במחבר הנורה כשהיא מחוברת ודולקת — לא בלי עומס","מפל מתח באדמה של הפנס: פחות מ-0.2V","צד אחד לא עובד → נתיך של אותו צד, נורה, אדמה","שני הצדדים לא עובדים → ממסר, מתג, נתיך ראשי","פנס חלש / מהבהב → כמעט תמיד אדמה רופפת או חלודה"] },
    en:{ title:"Headlights with a relay", desc:"The switch only drives the relay coil. Lamp current flows through the relay and a separate fuse per side, and returns to a shared ground point (G). In newer cars the body module (BCM) drives the lamps directly.", tests:["Measure voltage at the bulb connector while connected and lit — not unloaded","Lamp ground drop: below 0.2V","One side out → that side's fuse, bulb, ground","Both sides out → relay, switch, main fuse","Dim / flickering lamp → almost always a loose or corroded ground"] } },
  { id:"window", icon:"🪟", draw:dWindow,
    he:{ title:"חלון חשמלי (היפוך קוטביות)", desc:"במנוחה שני חוטי המנוע מחוברים לאדמה דרך המתג. כשלוחצים, צד אחד עובר ל-+12V. הכיוון נקבע לפי איזה צד מקבל פלוס. אותו עיקרון במראות ובמנעולים.", tests:["במנוחה: שני החוטים במחבר המנוע 0V","למעלה: חוט אחד 12V והשני 0V; למטה — הפוך","יש מתח נכון במחבר והמנוע לא זז → מנוע / מנגנון","אין מתח באחד הכיוונים → מתג או חוט בציר הדלת","חלון אוטומטי שלא עולה עד הסוף אחרי ניתוק מצבר → צריך 'לימוד' (להחזיק למעלה 3–5 שניות בסוף)","זרם מנוע תקין בערך 5–10A, יותר = מנגנון תקוע"] },
    en:{ title:"Power window (polarity reversal)", desc:"At rest both motor wires are grounded through the switch. When pressed, one side switches to +12V. The direction depends on which side gets positive. Mirrors and lock actuators work the same way.", tests:["At rest: both wires at the motor connector read 0V","Up: one wire 12V, the other 0V; down — reversed","Correct voltage at the connector but no movement → motor / regulator","No voltage in one direction → switch or wire in the door hinge","Auto window not closing fully after battery disconnect → needs 'learning' (hold up 3–5 s at the top)","Normal motor current about 5–10A; more = binding regulator"] } },
  { id:"sensor3", icon:"🎚️", draw:dSensor3,
    he:{ title:"חיישן 3 חוטים (5V רפרנס)", desc:"המחשב שולח 5V רפרנס ואדמת חיישן, והחיישן מחזיר אות בין 0.5 ל-4.5V. כך עובדים מצערת (TPS), דוושת גז (APP), MAP, לחץ מסילה ועוד.", tests:["חוט רפרנס: ‏4.9–5.1V עם הצתה","אדמת חיישן (מול מינוס מצבר): פחות מ-0.1V","אות: משתנה בצורה חלקה בלי קפיצות כשמזיזים / משנים לחץ","אות 0V קבוע → קצר לאדמה או חוט רפרנס פתוח","אות 5V קבוע → חוט אדמה פתוח או קצר לרפרנס","רפרנס נופל ל-0V → קצר באחד החיישנים שחולקים אותו רפרנס — נתק אותם אחד-אחד"] },
    en:{ title:"3-wire sensor (5V reference)", desc:"The ECU supplies a 5V reference and a sensor ground; the sensor returns a 0.5–4.5V signal. Throttle (TPS), pedal (APP), MAP, rail pressure and others work this way.", tests:["Reference wire: 4.9–5.1V with ignition on","Sensor ground (vs battery negative): below 0.1V","Signal: changes smoothly, without jumps, as you move it / change pressure","Signal stuck at 0V → short to ground or open reference","Signal stuck at 5V → open ground or short to reference","Reference drops to 0V → a short in one of the sensors sharing it — unplug them one by one"] } },
  { id:"ntc", icon:"🌡️", draw:dNtc,
    he:{ title:"חיישן טמפרטורה (NTC, 2 חוטים)", desc:"בתוך המחשב יש נגד שמחובר ל-5V. החיישן הוא נגד שההתנגדות שלו יורדת כשחם. המחשב מודד את המתח ביניהם.", tests:["מנותק: ‏~5V על חוט האות (המחשב יראה ‎-40°C)","קצר לאדמה: ‏~0V (המחשב יראה טמפרטורה גבוהה מאוד)","התנגדות טיפוסית: ‏2–3kΩ ב-20°C, ‏200–300Ω ב-90°C","מנוע קר: מתח ~3–3.5V; מנוע חם: ~0.5–1V","השווה את ערך החיישן לטמפרטורת האוויר אחרי לילה — ההפרש צריך להיות קטן"] },
    en:{ title:"Temperature sensor (NTC, 2-wire)", desc:"Inside the ECU a resistor is tied to 5V. The sensor is a resistor whose value drops as it gets hot. The ECU measures the voltage between them.", tests:["Unplugged: ~5V on the signal wire (ECU shows -40°C)","Shorted to ground: ~0V (ECU shows a very high temperature)","Typical resistance: 2–3kΩ at 20°C, 200–300Ω at 90°C","Cold engine: about 3–3.5V; hot engine: about 0.5–1V","Compare the reading to air temperature after an overnight cold soak — the difference should be small"] } },
  { id:"injector", icon:"💉", draw:dInjector,
    he:{ title:"מזרקים וסלילי הצתה", desc:"‎+12V מגיע מהממסר הראשי לכל המזרקים/סלילים במשותף, והמחשב מפעיל כל אחד בנפרד על ידי חיבור לאדמה (Low Side).", tests:["חוט ההזנה: 12V עם הצתה / בזמן התנעה","התנגדות מזרק רגיל (High Impedance): ‏11–16Ω","מזרק Low Impedance: ‏0.5–3Ω","נורת בדיקה (Noid) על המחבר: מהבהבת בזמן התנעה = המחשב מפעיל","אין 12V לאף מזרק → ממסר ראשי / נתיך","מזרק אחד לא מקבל פולס → חוט פיקוד או דרייבר במחשב","בסקופ: ספייק השראתי של ~60V ויותר בסגירה = סליל תקין"] },
    en:{ title:"Injectors and ignition coils", desc:"+12V comes from the main relay to all injectors/coils together, and the ECU fires each one separately by switching it to ground (low side).", tests:["Supply wire: 12V with ignition on / while cranking","Standard (high-impedance) injector: 11–16Ω","Low-impedance injector: 0.5–3Ω","Noid light on the connector flashing while cranking = ECU is firing it","No 12V at any injector → main relay / fuse","One injector without a pulse → control wire or ECU driver","On a scope: an inductive spike of ~60V or more at turn-off = healthy winding"] } },
  { id:"can", icon:"🕸️", draw:dCan,
    he:{ title:"רשת CAN", desc:"שני חוטים שזורים (CAN-H ו-CAN-L) שעוברים בין כל המחשבים. בשני הקצוות יש נגד סיום של 120Ω, ולכן בין שני החוטים מודדים בערך 60Ω. אפשר למדוד ישר משקע ה-OBD (פינים 6 ו-14).", tests:["מצבר מנותק: התנגדות בין פין 6 ל-14 ≈ 60Ω","‏120Ω → אחד מנגדי הסיום חסר או קו פתוח","‏~40Ω → נגד סיום עודף (נגיד מודול לא מקורי)","‏0Ω → קצר בין H ל-L","הצתה דלוקה: CAN-H ‏≈2.5–3.5V, CAN-L ‏≈1.5–2.5V (במולטימטר: ~2.6V ו-~2.4V)","H+L בערך 5V ביחד","הרבה קודי U → נתק מודולים אחד-אחד עד שהרשת חוזרת"] },
    en:{ title:"CAN network", desc:"Two twisted wires (CAN-H and CAN-L) run between all the modules. Each end has a 120Ω terminating resistor, so you measure about 60Ω between the wires. You can measure straight at the OBD socket (pins 6 and 14).", tests:["Battery disconnected: resistance pin 6–14 ≈ 60Ω","120Ω → one terminator missing or an open line","~40Ω → an extra terminator (e.g. an aftermarket module)","0Ω → H and L shorted together","Ignition on: CAN-H ≈2.5–3.5V, CAN-L ≈1.5–2.5V (on a meter about 2.6V and 2.4V)","H+L together about 5V","Many U codes → unplug modules one by one until the network recovers"] } },
  { id:"obd", icon:"🔌", draw:dObd,
    he:{ title:"פינאוט שקע OBD-II", desc:"16 פינים. הפינים הצבעוניים מוגדרים בתקן; השאר שמורים ליצרן.", tests:["פין 16: ‏+12V קבוע מהמצבר (אם אין — בדוק נתיך מצית / OBD)","פינים 4 ו-5: אדמה (שלדה ואדמת אות)","פינים 6 ו-14: ‏CAN-H ו-CAN-L (רוב הרכבים מ-2008)","פין 7 (ופין 15): ‏K-Line / L-Line — ISO 9141 / KWP2000, רכבים אירופאים ואסייתים ישנים","פינים 2 ו-10: ‏J1850 — רכבים אמריקאים ישנים","סורק לא מתחבר בכלל → קודם כל בדוק 12V בין פין 16 לפין 4"] },
    en:{ title:"OBD-II socket pinout", desc:"16 pins. The colored pins are defined by the standard; the rest are left to the manufacturer.", tests:["Pin 16: constant +12V from the battery (if missing — check the lighter / OBD fuse)","Pins 4 and 5: ground (chassis and signal ground)","Pins 6 and 14: CAN-H and CAN-L (most cars from 2008)","Pin 7 (and 15): K-Line / L-Line — ISO 9141 / KWP2000, older European and Asian cars","Pins 2 and 10: J1850 — older American cars","Scanner won't connect at all → first check 12V between pin 16 and pin 4"] } },
  { id:"drop", icon:"📉", draw:dDrop,
    he:{ title:"בדיקת מפל מתח", desc:"הבדיקה הכי חשובה לחשמלאי: מודדים את המתח 'שהולך לאיבוד' בחוט או במגע, כשהמעגל עובד. התנגדות באוהמטר לא תגלה מגע חלוד שעובר עם זרם קטן אבל נופל בעומס.", tests:["המעגל חייב לעבוד בזמן המדידה (סטרטר מסתובב, פנס דולק, מאוורר עובד)","מדידה בצד הפלוס: קרס אדום על הדק המצבר, שחור על הדק הצרכן","מדידה בצד האדמה: קרס אדום על אדמת הצרכן, שחור על מינוס המצבר","מעגל רגיל: עד 0.2V לכל צד; כבלי סטרטר: עד 0.5V","מפל גבוה → מזיזים את הקרס צעד אחרי צעד עד שמוצאים איפה המתח 'נעלם'"] },
    en:{ title:"Voltage-drop test", desc:"The most important test for an auto electrician: measure the voltage 'lost' along a wire or contact while the circuit is working. An ohmmeter won't find a corroded contact that passes a tiny test current but fails under load.", tests:["The circuit must be running while you measure (starter cranking, lamp on, fan running)","Positive side: red probe on the battery post, black on the load terminal","Ground side: red probe on the load ground, black on battery negative","Ordinary circuit: up to 0.2V per side; starter cables: up to 0.5V","High drop → move the probe step by step until you find where the voltage 'disappears'"] } },
];
