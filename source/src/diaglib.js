// AutoDiag Pro — personal wiring-diagram library.
// Metadata list lives in "adp_diagrams"; every page is a JPEG/PNG Blob under "dgp_<id>_<n>" in IndexedDB.
// PDFs are turned into page images once, at import time (pdf.js loads only then), so viewing works offline with no PDF viewer.
import { blobPut, blobGet, blobDel } from "./lib.js";

export const DG_SYSTEMS = [
  ["engine","מנוע וניהול מנוע","Engine & engine management"], ["start","התנעה וטעינה","Starting & charging"], ["power","הזנות, נתיכים וממסרים","Power, fuses & relays"],
  ["ground","נקודות הארקה","Ground points"], ["light","תאורה","Lighting"], ["body","נוחות (חלונות, נעילה, מראות)","Comfort (windows, locks, mirrors)"],
  ["hvac","מזגן וחימום","A/C & heating"], ["abs","ABS / ESP / בלמים","ABS / ESP / brakes"], ["srs","כריות אוויר","Airbags (SRS)"],
  ["can","רשת CAN / תקשורת","CAN / network"], ["cluster","לוח שעונים","Instrument cluster"], ["audio","מולטימדיה ורדיו","Audio & multimedia"],
  ["immo","אימובילייזר ומפתחות","Immobilizer & keys"], ["trans","תיבת הילוכים","Transmission"], ["hybrid","היברידי / חשמלי","Hybrid / EV"],
  ["connectors","מחברים ופינאוטים","Connectors & pinouts"], ["other","אחר","Other"],
];
export const dgSystemName = (id, en) => { const s = DG_SYSTEMS.find(x=>x[0]===id) || DG_SYSTEMS[DG_SYSTEMS.length-1]; return en ? s[2] : s[1]; };
export const pageKey = (id, n) => `dgp_${id}_${n}`;
export const MAX_PAGES = 80;

const norm = s => String(s||"").toLowerCase().replace(/[^a-z0-9֐-׿]/g,"");
// does a saved diagram fit a vehicle { make, model, year }?
export function dgMatches(m, make, model, year){
  if(!make || norm(m.make)!==norm(make)) return false;
  if(m.model && model){ const a = norm(m.model), b = norm(model); if(!(a.includes(b) || b.includes(a))) return false; }
  const y = parseInt(year)||0;
  if(y && ((m.yFrom && y < m.yFrom) || (m.yTo && y > m.yTo))) return false;
  return true;
}

function canvasToBlob(cv, type="image/jpeg", q=0.85){ return new Promise((res,rej)=>cv.toBlob(b=>b?res(b):rej(new Error("encode")), type, q)); }
async function bitmapOf(file){
  if(window.createImageBitmap){ try{ return await createImageBitmap(file); }catch(e){} }
  return await new Promise((res,rej)=>{ const u = URL.createObjectURL(file); const im = new Image(); im.onload = ()=>{ res(im); }; im.onerror = ()=>rej(new Error("image")); im.src = u; });
}
// keep big diagrams sharp (up to 3200px wide) but don't store 50MB phone photos
async function imageToPage(file){
  const bm = await bitmapOf(file); const W = bm.width, H = bm.height;
  const scale = Math.min(1, 3200 / Math.max(W, H));
  if(scale === 1 && file.size < 2.5e6 && /image\/(jpeg|png|webp)/.test(file.type)) return { blob:file, bm };
  const cv = document.createElement("canvas"); cv.width = Math.round(W*scale); cv.height = Math.round(H*scale);
  const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0,0,cv.width,cv.height); g.drawImage(bm,0,0,cv.width,cv.height);
  return { blob: await canvasToBlob(cv), bm };
}
async function thumbOf(src){
  const W = src.width, H = src.height, s = 220 / Math.max(W, H);
  const cv = document.createElement("canvas"); cv.width = Math.max(1, Math.round(W*s)); cv.height = Math.max(1, Math.round(H*s));
  const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0,0,cv.width,cv.height); g.drawImage(src,0,0,cv.width,cv.height);
  return cv.toDataURL("image/jpeg", 0.7);
}
let _pdf = null;
async function pdfjs(){
  if(_pdf) return _pdf;
  const lib = await import("pdfjs-dist/build/pdf.min.mjs");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  lib.GlobalWorkerOptions.workerSrc = worker; _pdf = lib; return lib;
}
// files → list of page Blobs (+ thumbnail of the first page). onProgress(done, total)
export async function filesToPages(files, onProgress){
  const pages = []; let thumb = ""; let total = 0, done = 0, cut = false;
  for(const f of files){
    if(pages.length >= MAX_PAGES){ cut = true; break; }
    if(f.type === "application/pdf" || /\.pdf$/i.test(f.name)){
      const lib = await pdfjs();
      const doc = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
      total += doc.numPages;
      for(let i=1;i<=doc.numPages;i++){
        if(pages.length >= MAX_PAGES){ cut = true; break; }
        const pg = await doc.getPage(i); const v1 = pg.getViewport({ scale:1 });
        const sc = Math.min(4, 2600 / Math.max(v1.width, v1.height)); const vp = pg.getViewport({ scale:sc });
        const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
        const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0,0,cv.width,cv.height);
        await pg.render({ canvasContext:g, viewport:vp }).promise;
        if(!thumb) thumb = await thumbOf(cv);
        pages.push(await canvasToBlob(cv, "image/jpeg", 0.88)); pg.cleanup && pg.cleanup();
        cv.width = cv.height = 0; done++; onProgress && onProgress(done, total);
      }
      doc.destroy && doc.destroy();
    } else if(/^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name)){
      total++;
      const { blob, bm } = await imageToPage(f);
      if(!thumb) thumb = await thumbOf(bm);
      bm.close && bm.close(); pages.push(blob); done++; onProgress && onProgress(done, total);
    }
  }
  return { pages, thumb, cut };
}
export async function savePages(id, pages, start=0){ for(let i=0;i<pages.length;i++) await blobPut(pageKey(id, start+i), pages[i]); }
export async function deletePages(id, n){ for(let i=0;i<n;i++) await blobDel(pageKey(id, i)); }
export const loadPage = (id, n) => blobGet(pageKey(id, n));

// ─── export / import the whole library as one file ───
function blobToDataURL(b){ return new Promise((res,rej)=>{ const r = new FileReader(); r.onload = ()=>res(r.result); r.onerror = rej; r.readAsDataURL(b); }); }
async function dataURLToBlob(u){ return await (await fetch(u)).blob(); }
export async function exportLibrary(list, onProgress){
  const out = { app:"AutoDiag Pro", kind:"diagrams", version:1, at:new Date().toISOString(), items:[] };
  let n = 0; const total = list.reduce((a,m)=>a+(m.pages||0),0);
  for(const m of list){
    const pages = [];
    for(let i=0;i<(m.pages||0);i++){ const b = await loadPage(m.id, i); if(b) pages.push(await blobToDataURL(b)); n++; onProgress && onProgress(n,total); }
    out.items.push({ ...m, data:pages });
  }
  return new Blob([JSON.stringify(out)], { type:"application/json" });
}
export async function importLibrary(file, existing, newId, onProgress){
  const j = JSON.parse(await file.text());
  if(!j || j.kind !== "diagrams" || !Array.isArray(j.items)) throw new Error("bad");
  const have = new Set(existing.map(m=>m.id)); const added = [];
  let n = 0; const total = j.items.reduce((a,m)=>a+((m.data||[]).length),0);
  for(const it of j.items){
    const { data, ...meta } = it; const id = have.has(meta.id) ? newId() : (meta.id || newId());
    const blobs = []; for(const d of (data||[])){ blobs.push(await dataURLToBlob(d)); n++; onProgress && onProgress(n,total); }
    await savePages(id, blobs); added.push({ ...meta, id, pages:blobs.length });
  }
  return added;
}
export async function storageInfo(){
  try{ if(navigator.storage && navigator.storage.estimate){ const e = await navigator.storage.estimate(); return { used:e.usage||0, quota:e.quota||0 }; } }catch(e){}
  return null;
}
export const fmtMB = b => (b/1048576 < 10 ? (b/1048576).toFixed(1) : Math.round(b/1048576)) + " MB";
