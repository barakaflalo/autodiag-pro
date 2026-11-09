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
export const APP_VERSION = "1.2.0";
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
