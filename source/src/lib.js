// AutoDiag Pro — storage, helpers, ELM327 parsing, print/share
// ═══ STORAGE ═══
// IndexedDB (room for photos) → localStorage → memory. A failed save fires "adp-save-error".
export const MEM_STORE = {};
let _dbP = null;
function openDB(){
  if(_dbP) return _dbP;
  _dbP = new Promise((res)=>{
    try{
      if(!window.indexedDB){res(null);return;}
      const rq = indexedDB.open("autodiag-pro",1);
      rq.onupgradeneeded = ()=>{ rq.result.createObjectStore("kv"); };
      rq.onsuccess = ()=>res(rq.result);
      rq.onerror = ()=>res(null);
      rq.onblocked = ()=>res(null);
    }catch(e){res(null);}
  });
  return _dbP;
}
function idbReq(db,mode,fn){
  return new Promise((res,rej)=>{
    try{
      const tx = db.transaction("kv",mode); const st = tx.objectStore("kv"); const r = fn(st);
      tx.oncomplete = ()=>res(r && r.result); tx.onerror = ()=>rej(tx.error); tx.onabort = ()=>rej(tx.error);
    }catch(e){rej(e);}
  });
}
export async function loadData(key, fallback) {
  try{
    const db = await openDB();
    if(db){ const v = await idbReq(db,"readonly",st=>st.get(key)); if(v!==undefined) return v; }
  }catch(e){}
  try{ const r = localStorage.getItem(key); if(r) return JSON.parse(r); }catch(e){}
  return key in MEM_STORE ? MEM_STORE[key] : fallback;
}
export async function saveData(key, val) {
  MEM_STORE[key] = val;
  try{
    const db = await openDB();
    if(db){ await idbReq(db,"readwrite",st=>st.put(val,key)); return true; }
  }catch(e){}
  try{ localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch(e){ try{ window.dispatchEvent(new CustomEvent("adp-save-error")); }catch(_){} return false; }
}
// Shrink photos before saving (max 1280px, JPEG) so storage does not fill up.
export function resizeImage(file, max=1280, q=0.75){
  return new Promise(resolve=>{
    const r = new FileReader();
    r.onload = ev=>{
      const img = new Image();
      img.onload = ()=>{
        try{
          let w=img.width,h=img.height; const k=Math.min(1,max/Math.max(w,h)); w=Math.round(w*k); h=Math.round(h*k);
          const c=document.createElement("canvas"); c.width=w; c.height=h; c.getContext("2d").drawImage(img,0,0,w,h);
          resolve(c.toDataURL("image/jpeg",q));
        }catch(e){resolve(ev.target.result);}
      };
      img.onerror = ()=>resolve(ev.target.result);
      img.src = ev.target.result;
    };
    r.onerror = ()=>resolve(null);
    r.readAsDataURL(file);
  });
}
export const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// ═══ ELM327 response parsing (pure functions) ═══
export function elmLines(raw){
  return String(raw||"").split(/[\r\n>]+/).map(l=>l.trim()).filter(l=>l&&!/^SEARCHING/i.test(l)&&!/^BUS INIT/i.test(l)&&l!=="OK");
}
const PROTO_NAMES={"1":"SAE J1850 PWM","2":"SAE J1850 VPW","3":"ISO 9141-2","4":"ISO 14230-4 KWP (5 baud)","5":"ISO 14230-4 KWP (fast)","6":"CAN 11bit 500k","7":"CAN 29bit 500k","8":"CAN 11bit 250k","9":"CAN 29bit 250k","A":"SAE J1939","B":"CAN user 1","C":"CAN user 2"};
export function protoName(p){return PROTO_NAMES[String(p||"").toUpperCase()]||(p?`${ctx.lang==="en"?"Unknown":"לא ידוע"} (${p})`:(ctx.lang==="en"?"Not detected":"לא זוהה"));}
export function isCanProto(p){const u=String(p||"").toUpperCase();if(/^[6-9ABC]$/.test(u))return true;if(/^[1-5]$/.test(u))return false;return null;}
export function parsePID(raw,pid){
  const want=("41"+pid).toUpperCase();
  for(const l of elmLines(raw)){const h=l.replace(/\s/g,"").toUpperCase();if(h.startsWith(want)&&/^[0-9A-F]+$/.test(h))return h.slice(want.length);}
  return null;
}
function decodeDTC(b1,b2){
  const n=parseInt(b1[0],16);
  return ["P","C","B","U"][n>>2]+(n&3).toString(16)+b1[1]+b2;
}
// mode 03 → "43", mode 07 → "47", mode 0A → "4A". isCan: true/false/null (unknown → guess by length).
export function parseDTCs(raw,resp="43",isCan=null){
  const msgs=[];let cur=null;
  for(const l of elmLines(raw)){
    const h=l.replace(/\s/g,"").toUpperCase();
    const fr=h.match(/^([0-9A-F]):([0-9A-F]*)$/);
    if(fr){ if(fr[1]==="0"){cur={hex:fr[2]};msgs.push(cur);} else if(cur){cur.hex+=fr[2];} continue; }
    if(/^[0-9A-F]{3}$/.test(h)) continue; // ISO-TP length line, e.g. "00A"
    if(/^[0-9A-F]+$/.test(h)){ msgs.push({hex:h}); cur=null; }
  }
  const out=[];
  for(const m of msgs){
    if(!m.hex.startsWith(resp))continue;
    let bytes=(m.hex.slice(2).match(/../g)||[]);
    const withCount = isCan===true || (isCan===null && bytes.length%2===1);
    if(withCount){ const cnt=parseInt(bytes[0],16); bytes=bytes.slice(1,1+cnt*2); }
    for(let i=0;i+1<bytes.length;i+=2){
      if(bytes[i]==="00"&&bytes[i+1]==="00")continue;
      const c=decodeDTC(bytes[i],bytes[i+1]);
      if(!out.includes(c))out.push(c);
    }
  }
  return out;
}

// Open an outside link without window.open (it returns null inside an installed app).
export function openExt(url){
  try{ const a=document.createElement("a"); a.href=url; a.target="_blank"; a.rel="noopener noreferrer"; document.body.appendChild(a); a.click(); a.remove(); }
  catch(e){ location.href=url; }
}


// ═══ App context shared with non-React helpers (print/share) ═══
export const APP_VERSION = "1.4.0";
export const ctx = { lang: "he", user: { name: "", phone: "" } };
export const ABOUT = {
  title: "AutoDiag Pro",
  creator: { he: "האפליקציה נוצרה על ידי ברק אפללו במסגרת AppNest — קן האפליקציות", en: "Created by Barak Aflalo as part of AppNest — the app nest" },
  copy: { he: "© 2026 · כל הזכויות שמורות לברק אפללו", en: "© 2026 · All rights reserved to Barak Aflalo" },
  link: "https://appnest-store.pages.dev",
  mail: "appnest55@gmail.com",
};
export const L = o => (o && typeof o === "object") ? (o[ctx.lang] || o.he) : o;

export async function deleteData(key){
  delete MEM_STORE[key];
  try{ const db = await openDB(); if(db) await idbReq(db,"readwrite",st=>st.delete(key)); }catch(e){}
  try{ localStorage.removeItem(key); }catch(e){}
}
// Large files (diagram pages) go straight to IndexedDB — never to localStorage or memory.
export async function blobPut(key, blob){ const db = await openDB(); if(!db) throw new Error("no-idb"); await idbReq(db,"readwrite",st=>st.put(blob,key)); }
export async function blobGet(key){ const db = await openDB(); if(!db) return null; try{ const v = await idbReq(db,"readonly",st=>st.get(key)); return v||null; }catch(e){ return null; } }
export async function blobDel(key){ const db = await openDB(); if(!db) return; try{ await idbReq(db,"readwrite",st=>st.delete(key)); }catch(e){} }
export function toast(msg){ try{ window.dispatchEvent(new CustomEvent("adp-toast",{detail:msg})); }catch(e){} }

// Print through a hidden iframe (window.open is null inside an installed app).
export function printViaFrame(docHtml){
  const fail = ctx.lang==="en" ? "Printing is not supported on this device" : "ההדפסה לא נתמכת במכשיר הזה";
  try{
    const old=document.getElementById("adp-print-frame"); if(old) old.remove();
    const f=document.createElement("iframe"); f.id="adp-print-frame"; f.setAttribute("aria-hidden","true");
    f.style.cssText="position:fixed;width:0;height:0;border:0;left:-9999px;top:0";
    document.body.appendChild(f);
    const d=f.contentWindow.document; d.open(); d.write(docHtml); d.close();
    const go=()=>{try{f.contentWindow.focus();f.contentWindow.print();}catch(e){toast(fail);}};
    const imgs=Array.from(d.images||[]); let left=imgs.filter(i=>!i.complete).length;
    if(!left) setTimeout(go,300); else { const done=()=>{if(--left<=0) setTimeout(go,200);}; imgs.forEach(i=>{if(!i.complete){i.onload=done;i.onerror=done;}}); setTimeout(()=>{if(left>0){left=0;go();}},3000); }
  }catch(e){ toast(fail); }
}
function byLine(){
  const u=ctx.user||{}; if(!u.name&&!u.phone) return "";
  return [u.name,u.phone].filter(Boolean).join(" · ");
}
// html = trusted markup built by the app; user text must already be passed through esc().
export function doPrint(title, html, notes){
  const en = ctx.lang==="en";
  const nH = notes&&notes.length ? `<div style="margin-top:14px;border-top:2px solid #ddd;padding-top:8px"><h3>${en?"Notes":"הערות"}</h3>${notes.map(n=>`<div style="background:#f9f9f9;padding:6px;border-radius:5px;margin-bottom:5px;border:1px solid #eee"><small style="color:#888">${esc(n.ts)}</small>${n.text?`<p style="white-space:pre-wrap">${esc(n.text)}</p>`:""}${n.images&&n.images.length?`<div style="display:flex;gap:3px;margin-top:3px;flex-wrap:wrap">${n.images.map(i=>`<img src="${i}" style="width:90px;height:90px;object-fit:cover;border-radius:3px"/>`).join("")}</div>`:""}</div>`).join("")}</div>` : "";
  const by = byLine();
  const date = new Date().toLocaleString(en?"en-GB":"he-IL");
  const docHtml = `<!DOCTYPE html><html dir="${en?"ltr":"rtl"}" lang="${en?"en":"he"}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;max-width:680px;margin:25px auto;padding:0 18px;color:#1a1a1a;line-height:1.6}h1{color:#92400E;border-bottom:3px solid #D4A537;padding-bottom:6px;font-size:18px}h2,h3{color:#92400E;font-size:15px}.hdr,.ftr{text-align:center;padding:12px;border:2px solid #D4A537;border-radius:10px;margin-bottom:16px;background:#FFF8E7}.ftr{margin-top:20px;font-size:11px}.meta{color:#555;font-size:12px;margin:-8px 0 12px}@media print{body{margin:8px}}</style></head><body><div class="hdr"><h2 style="margin:0">🔧 ${ABOUT.title}</h2><p style="margin:4px 0 0;color:#92400E;font-size:12px">${esc(L(ABOUT.creator))}</p></div><h1>${esc(title)}</h1><div class="meta">${by?`${en?"Prepared by":"הוכן על ידי"}: ${esc(by)} · `:""}${esc(date)}</div>${html}${nH}<div class="ftr"><strong>🔧 ${ABOUT.title} · v${APP_VERSION}</strong><br/>${esc(L(ABOUT.creator))}<br/>${esc(L(ABOUT.copy))}<br/><a href="${ABOUT.link}">${ABOUT.link}</a><br/><span style="color:#777">${en?"General information only — verify every step against the manufacturer's data. Use at your own responsibility.":"מידע כללי בלבד — יש לאמת כל פעולה מול נתוני היצרן. השימוש באחריות המשתמש."}</span></div></body></html>`;
  printViaFrame(docHtml);
}
// Share text: phone share sheet when available, otherwise WhatsApp.
export function shareText(title, text){
  const by = byLine();
  const body = `🔧 *${ABOUT.title}*\n━━━━━━━━━━━━\n*${title}*\n${String(text).slice(0,900)}${by?`\n\n${ctx.lang==="en"?"From":"מאת"}: ${by}`:""}\n━━━━━━━━━━━━\n📲 ${ABOUT.link}`;
  if(navigator.share){ navigator.share({title, text: body}).catch(()=>{}); return; }
  openExt(`https://wa.me/?text=${encodeURIComponent(body)}`);
}
export function shareWhatsApp(title, text){
  const by = byLine();
  const body = `🔧 *${ABOUT.title}*\n━━━━━━━━━━━━\n*${title}*\n${String(text).slice(0,900)}${by?`\n\n${ctx.lang==="en"?"From":"מאת"}: ${by}`:""}\n━━━━━━━━━━━━\n📲 ${ABOUT.link}`;
  openExt(`https://wa.me/?text=${encodeURIComponent(body)}`);
}
export const uid = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);

// ═══ OBD-II mode helpers (pure, testable) ═══
// Join ISO-TP frames ("0:..", "1:..") or plain lines into hex messages.
export function elmMessages(raw){
  const msgs=[]; let cur=null;
  for(const l of elmLines(raw)){
    const h=l.replace(/\s/g,"").toUpperCase();
    const fr=h.match(/^([0-9A-F]):([0-9A-F]*)$/);
    if(fr){ if(fr[1]==="0"){ cur={hex:fr[2]}; msgs.push(cur); } else if(cur){ cur.hex+=fr[2]; } continue; }
    if(/^[0-9A-F]{3}$/.test(h)) continue;
    if(/^[0-9A-F]+$/.test(h)){ msgs.push({hex:h}); cur=null; }
  }
  return msgs.map(m=>m.hex);
}
// Mode 09 PID 02 — VIN (CAN multi-frame or legacy 5-line form)
export function parseVIN(raw){
  const msgs = elmMessages(raw).filter(h=>h.startsWith("4902"));
  let bytes=[];
  if(msgs.length===1 && msgs[0].length>=40){ bytes = (msgs[0].slice(4).match(/../g)||[]).slice(1); } // CAN: 49 02 01 + 17 chars
  else { for(const m of msgs){ bytes = bytes.concat((m.slice(4).match(/../g)||[]).slice(1)); } }         // legacy: 49 02 seq + 4 bytes
  const s = bytes.map(b=>parseInt(b,16)).filter(n=>n>0).map(n=>String.fromCharCode(n)).join("").replace(/[^A-HJ-NPR-Z0-9]/gi,"").toUpperCase();
  return s.length>=17 ? s.slice(-17) : "";
}
// Mode 01 PID 01 — MIL, DTC count and readiness monitors. data = hex after "4101"
const RD_SPARK = ["catalyst","heatedCat","evap","secAir","ac","o2","o2Heater","egr"];
const RD_DIESEL = ["nmhcCat","noxScr",null,"boost",null,"egs","pmFilter","egrVvt"];
export function decodeReadiness(data){
  const b = (String(data||"").match(/../g)||[]).map(x=>parseInt(x,16));
  if(b.length<4 || b.some(isNaN)) return null;
  const [A,B,C,D] = b;
  const diesel = !!(B & 0x08);
  const mon = [];
  const add = (key, avail, incomplete) => { if(key && avail) mon.push({ key, done: !incomplete }); };
  add("misfire", B&0x01, B&0x10); add("fuel", B&0x02, B&0x20); add("components", B&0x04, B&0x40);
  const names = diesel ? RD_DIESEL : RD_SPARK;
  for(let i=0;i<8;i++) add(names[i], C&(1<<i), D&(1<<i));
  return { mil: !!(A&0x80), dtcCount: A&0x7F, diesel, monitors: mon };
}
// "4100BE3FA813" → Set of supported PIDs (hex strings) for that range
export function parseSupported(raw, base){
  const want = ("41"+base).toUpperCase(); const set = new Set();
  for(const h of elmMessages(raw)){
    if(!h.startsWith(want)) continue;
    const bits = parseInt(h.slice(4,12),16); if(isNaN(bits)) continue;
    const b0 = parseInt(base,16);
    for(let i=0;i<32;i++) if(bits & (1<<(31-i))) set.add((b0+i+1).toString(16).toUpperCase().padStart(2,"0"));
  }
  return set;
}
// Mode 02 (freeze frame 00): "42 PID 00 data"
export function parseFF(raw,pid){
  const want=("42"+pid+"00").toUpperCase();
  for(const h of elmMessages(raw)) if(h.startsWith(want)) return h.slice(want.length);
  return null;
}
const B = (d,i)=>parseInt(d.slice(i*2,i*2+2),16);
export const LIVE_PIDS = [
  { pid:"0C", he:"סל\"ד", en:"RPM", unit:"rpm", f:d=>((B(d,0)*256+B(d,1))/4).toFixed(0) },
  { pid:"0D", he:"מהירות", en:"Speed", unit:"km/h", f:d=>String(B(d,0)) },
  { pid:"05", he:"טמפ׳ מים", en:"Coolant", unit:"°C", f:d=>String(B(d,0)-40) },
  { pid:"42", he:"מתח מחשב", en:"ECU voltage", unit:"V", f:d=>((B(d,0)*256+B(d,1))/1000).toFixed(1) },
  { pid:"04", he:"עומס", en:"Load", unit:"%", f:d=>(B(d,0)*100/255).toFixed(0) },
  { pid:"11", he:"מצערת", en:"Throttle", unit:"%", f:d=>(B(d,0)*100/255).toFixed(0) },
  { pid:"06", he:"STFT B1", en:"STFT B1", unit:"%", f:d=>((B(d,0)-128)*100/128).toFixed(1) },
  { pid:"07", he:"LTFT B1", en:"LTFT B1", unit:"%", f:d=>((B(d,0)-128)*100/128).toFixed(1) },
  { pid:"0B", he:"MAP", en:"MAP", unit:"kPa", f:d=>String(B(d,0)) },
  { pid:"10", he:"MAF", en:"MAF", unit:"g/s", f:d=>((B(d,0)*256+B(d,1))/100).toFixed(1) },
  { pid:"0F", he:"טמפ׳ אוויר", en:"Intake air", unit:"°C", f:d=>String(B(d,0)-40) },
  { pid:"0E", he:"הקדמת הצתה", en:"Timing adv.", unit:"°", f:d=>(B(d,0)/2-64).toFixed(1) },
  { pid:"5C", he:"טמפ׳ שמן", en:"Oil temp", unit:"°C", f:d=>String(B(d,0)-40) },
  { pid:"2F", he:"מפלס דלק", en:"Fuel level", unit:"%", f:d=>(B(d,0)*100/255).toFixed(0) },
  { pid:"33", he:"לחץ ברומטרי", en:"Baro", unit:"kPa", f:d=>String(B(d,0)) },
  { pid:"1F", he:"זמן ריצה", en:"Run time", unit:"s", f:d=>String(B(d,0)*256+B(d,1)) },
  { pid:"A6", he:"ק\"מ (מחשב)", en:"Odometer", unit:"km", f:d=>((((B(d,0)*256+B(d,1))*256+B(d,2))*256+B(d,3))/10).toFixed(0) },
];

// ═══ Demo adapter: answers like a real ELM327 so the scanner can be tried without a car ═══
export function makeDemoAdapter(){
  const vin = "JTDBR32E720123456";
  const sup = ["01","03","04","05","06","07","0B","0C","0D","0E","0F","10","11","1C","1F","20","2F","33","40","42","5C"];
  const mask = (base) => { let m=0; for(const p of sup){ const n=parseInt(p,16)-parseInt(base,16); if(n>=1&&n<=32) m |= (1<<(32-n)); } return ("41"+base+(m>>>0).toString(16).toUpperCase().padStart(8,"0")); };
  const hex = (n,len=2)=>Math.max(0,Math.round(n)).toString(16).toUpperCase().padStart(len,"0");
  let t0 = Date.now(); let cleared = false;
  const vinFrames = () => { const bytes = ["49","02","01"].concat(vin.split("").map(c=>c.charCodeAt(0).toString(16).toUpperCase())); const out=["014"]; out.push("0:"+bytes.slice(0,6).join("")); let i=6,seq=1; while(i<bytes.length){ out.push(seq+":"+bytes.slice(i,i+7).join("").padEnd(14,"0")); i+=7; seq++; } return out.join("\r"); };
  const live = (pid) => { const s=(Date.now()-t0)/1000; const rpm=820+Math.sin(s/2)*60;
    switch(pid){ case "0C": return hex(rpm*4,4); case "0D": return "00"; case "05": return hex(88+40); case "42": return hex(14100+Math.sin(s)*80,4);
      case "04": return hex(22*2.55); case "11": return hex(15*2.55); case "06": return hex(128+Math.sin(s*3)*4); case "07": return hex(128+6);
      case "0B": return hex(33); case "10": return hex(320+Math.sin(s)*20,4); case "0F": return hex(31+40); case "0E": return hex((8+64)*2); case "5C": return hex(92+40);
      case "2F": return hex(60*2.55); case "33": return hex(101); case "1F": return hex(s+300,4); default: return null; } };
  return {
    demo: true, name: "DEMO", properties: { write: true },
    respond(cmd){
      const c = cmd.replace(/\s/g,"").toUpperCase();
      if(c==="ATZ") return "\r\rELM327 v2.3 (DEMO)\r\r>";
      if(c==="ATRV") return "12.6V\r\r>";
      if(c==="ATDPN") return "A6\r\r>";
      if(c.startsWith("AT")) return "OK\r\r>";
      if(/^01(00|20|40|60|80|A0)$/.test(c)) { const base=c.slice(2); return (["00","20","40"].includes(base) ? mask(base) : "NO DATA")+"\r\r>"; }
      if(c==="0101") return (cleared ? "4101000765"+"00" : "410182076504")+"\r\r>";
      if(c==="03") return (cleared ? "4300" : "430201070300")+"\r\r>";
      if(c==="07") return (cleared ? "4700" : "47010420")+"\r\r>";
      if(c==="0A") return "4A00\r\r>";
      if(c==="04") { cleared = true; return "44\r\r>"; }
      if(c==="0902") return vinFrames()+"\r\r>";
      if(c==="020200") return (cleared ? "NO DATA" : "4202000107")+"\r\r>";
      if(/^02[0-9A-F]{2}00$/.test(c)) { const v = cleared ? null : live(c.slice(2,4)); return (v ? "42"+c.slice(2,4)+"00"+v : "NO DATA")+"\r\r>"; }
      if(/^01[0-9A-F]{2}$/.test(c)) { const v = live(c.slice(2)); return (v ? "41"+c.slice(2)+v : "NO DATA")+"\r\r>"; }
      return "?\r\r>";
    }
  };
}
export const fmtPlate = p => { const d=String(p||"").replace(/\D/g,""); if(d.length===7) return `${d.slice(0,2)}-${d.slice(2,5)}-${d.slice(5)}`; if(d.length===8) return `${d.slice(0,3)}-${d.slice(3,5)}-${d.slice(5)}`; return String(p||""); };
