import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { DG_SYSTEMS, dgSystemName, dgMatches, filesToPages, savePages, deletePages, loadPage, exportLibrary, importLibrary, storageInfo, fmtMB, MAX_PAGES } from "./diaglib.js";
import { CIRCUITS } from "./circuits.js";
import { TREES } from "./trees.js";
import { answer, suggestions, aiContext } from "./assistant.js";
import { askAI, AI_PROVIDERS, cleanKey } from "./ai.js";
import { DIN, WIRES, FUSES, PROTOCOLS, SECTIONS, E12, FUSE_STEPS } from "./techref.js";
import { CODES_DB, CAR_MODELS, CAR_MAKES, SYMPTOMS, SENSOR_REF, WIRE_TYPES, WIRE_COLORS, CONVERSIONS, BATTERY_TABLE, DICT, makeFromHe, relatedCodes, circuitFor } from "./data.js";
import { CODES_EN, SAFE_EN, SYMPTOMS_EN, SENSORS_EN, WIRE_TYPES_EN, WIRE_COLORS_EN, CONV_CAT_EN, BATTERY_EN } from "./data_en.js";
import { APP_VERSION, ABOUT, ctx, L, uid, esc, loadData, saveData, deleteData, resizeImage, openExt, toast, doPrint, shareText, shareWhatsApp, elmLines, protoName, isCanProto, parsePID, parseDTCs, parseVIN, decodeReadiness, parseSupported, parseFF, LIVE_PIDS, makeDemoAdapter, fmtPlate } from "./lib.js";
import { S, THEMES, THEME_ORDER, applyTheme } from "./theme.js";
import { T } from "./i18n.js";

// ═══ Language-aware data access ═══
const en = () => ctx.lang === "en";
const SEV_EN = { "נמוכה":"Low", "בינונית":"Medium", "גבוהה":"High", "קריטית":"Critical" };
const SEV_COLOR = { "נמוכה":"#22C55E", "בינונית":"#F59E0B", "גבוהה":"#EF4444", "קריטית":"#DC2626" };
function codeInfo(code){
  const d = CODES_DB[code]; if(!d) return null;
  const e = en() ? (CODES_EN[code] || null) : null;
  return {
    code, sev: d.severity, safeOk: String(d.safe).startsWith("כן"),
    title: en() ? d.en : d.he, alt: en() ? (e ? "" : d.he) : d.en,
    safe: en() ? (SAFE_EN[d.safe] || (String(d.safe).startsWith("כן") ? "Yes" : "Not recommended")) : d.safe,
    desc: e ? e.desc : d.desc, causes: e ? e.causes : d.causes, steps: e ? e.steps : d.steps, location: e ? e.location : d.location,
    missingEn: en() && !e,
  };
}
const codeTitle = c => { const d = CODES_DB[c]; return d ? (en() ? d.en : d.he) : ""; };
const sevLabel = s => en() ? (SEV_EN[s] || s) : s;
const symText = s => en() && SYMPTOMS_EN[s.id] ? SYMPTOMS_EN[s.id] : { text: s.text, tip: s.tip };
const sensorOf = (x,i) => en() && SENSORS_EN[i] ? { ...x, ...SENSORS_EN[i] } : x;
const wireTypeOf = (x,i) => en() && WIRE_TYPES_EN[i] ? WIRE_TYPES_EN[i] : x;
const wireBrandLabel = k => k === "כללי" ? T("כללי") : k;
const wireColorOf = (k,i,w) => en() && WIRE_COLORS_EN[k] && WIRE_COLORS_EN[k][i] ? { ...w, ...WIRE_COLORS_EN[k][i] } : w;
const convCat = c => en() ? (CONV_CAT_EN[c] || c) : c;
const unitL = u => en() && u==="ליטר" ? "L" : u;
const fmtDate = (at, ts) => { if(at){ try{ return new Date(at).toLocaleString(en()?"en-GB":"he-IL",{dateStyle:"short",timeStyle:"short"}); }catch(e){} } return ts || ""; };
const isCodeLike = s => /^[PCBU][0-9A-F]{4}$/i.test(String(s).trim());
const DEFAULT_SETTINGS = { name:"", phone:"", lang:"he", theme:"gold", zoom:1, guideDone:false };

// logo for reports: keep transparency (PNG), max 360px
function logoFrom(file){
  return new Promise(res=>{ try{ const u = URL.createObjectURL(file); const im = new Image();
    im.onload = ()=>{ const s = Math.min(1, 360/Math.max(im.width, im.height)); const cv = document.createElement("canvas"); cv.width = Math.max(1,Math.round(im.width*s)); cv.height = Math.max(1,Math.round(im.height*s)); cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height); URL.revokeObjectURL(u); res(cv.toDataURL("image/png")); };
    im.onerror = ()=>{ URL.revokeObjectURL(u); res(""); }; im.src = u; }catch(e){ res(""); } });
}
// tiny line chart for live data (no library)
function LiveChart({ data, big }){
  const d = (data||[]).slice(big ? -120 : -40); const W = big ? 300 : 90, H = big ? 110 : 18;
  if(d.length < 2) return big ? <div style={{ height:H+"px", display:"flex", alignItems:"center", justifyContent:"center", color:S.muted, fontSize:"12px" }}>{T("מחכה לנתונים...")}</div> : <div style={{ height:H+"px" }}/>;
  let mn = Math.min(...d), mx = Math.max(...d); if(mx-mn < 1e-6){ mx += 1; mn -= 1; }
  const pts = d.map((v,i)=>`${(i/(d.length-1)*W).toFixed(1)},${(H-2-(v-mn)/(mx-mn)*(H-4)).toFixed(1)}`).join(" ");
  return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width:"100%", height:H+"px", display:"block", marginTop:big?"6px":"2px" }} aria-hidden="true">
    {big && [0.25,0.5,0.75].map(f=> <line key={f} x1="0" x2={W} y1={H*f} y2={H*f} stroke={S.bdr} strokeWidth="0.6"/>)}
    <polyline points={pts} fill="none" stroke={S.acc} strokeWidth={big?2:1.4} strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
  </svg>;
}
// ═══ Small UI pieces ═══
function Card({ children, title, actions, style }){
  return <div style={{ background:S.card, borderRadius:"14px", padding:"14px", marginBottom:"10px", border:`1px solid ${S.bdr}`, ...style }}>
    {(title||actions) && <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"8px", marginBottom:"10px" }}>
      <div style={{ fontSize:"14px", fontWeight:700, color:S.acc, minWidth:0 }}>{title}</div>
      {actions && <div style={{ display:"flex", gap:"2px", flexShrink:0 }}>{actions}</div>}
    </div>}
    {children}
  </div>;
}
function IconBtn({ onClick, children, label, color }){
  return <button aria-label={label} title={label} onClick={onClick} style={{ background:"none", border:"none", color:color||S.muted, cursor:"pointer", fontSize:"20px", padding:"6px", minWidth:"38px", minHeight:"38px", borderRadius:"8px", lineHeight:1 }}>{children}</button>;
}
function Btn({ onClick, children, kind="primary", style, disabled, label }){
  const k = { primary:{ background:S.acc, color:S.onAcc, border:"none" }, ghost:{ background:"transparent", color:S.sub, border:`1px solid ${S.bdr}` }, danger:{ background:"transparent", color:S.red, border:`1px solid ${S.red}` }, green:{ background:S.green, color:"#fff", border:"none" }, blue:{ background:S.blue, color:"#fff", border:"none" } }[kind];
  return <button aria-label={label} disabled={disabled} onClick={onClick} style={{ ...k, padding:"11px 14px", borderRadius:"10px", fontSize:"13px", fontWeight:700, cursor:disabled?"default":"pointer", fontFamily:"inherit", opacity:disabled?.55:1, minHeight:"44px", ...style }}>{children}</button>;
}
function Field(props){
  const { area, style, ...rest } = props;
  const st = { width:"100%", padding:"10px", borderRadius:"10px", border:`1px solid ${S.bdr}`, background:S.inner, color:S.text, fontSize:"14px", fontFamily:"inherit", outline:"none", boxSizing:"border-box", ...style };
  return area ? <textarea {...rest} style={{ resize:"vertical", ...st }}/> : <input {...rest} style={st}/>;
}
function Select({ value, onChange, children, style, label }){
  return <select aria-label={label} value={value} onChange={onChange} style={{ width:"100%", padding:"10px", borderRadius:"10px", border:`1px solid ${S.bdr}`, background:S.inner, color:S.text, fontSize:"14px", fontFamily:"inherit", outline:"none", ...style }}>{children}</select>;
}
function Ext({ href, bg, children }){
  return <a href={href} target="_blank" rel="noopener noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:"5px", background:bg, color:"#fff", padding:"8px 11px", borderRadius:"9px", textDecoration:"none", fontSize:"12px", fontWeight:600 }}>{children}</a>;
}
const YT = ({ q, l }) => <Ext href={`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`} bg="#DC2626">▶ {l}</Ext>;
const GG = ({ q, l, img }) => <Ext href={`https://www.google.com/search?q=${encodeURIComponent(q)}${img?"&tbm=isch":""}`} bg="#2563EB">🔍 {l}</Ext>;
function SevBadge({ level }){ const c = SEV_COLOR[level] || S.acc; return <span style={{ background:`${c}22`, color:c, padding:"3px 9px", borderRadius:"6px", fontSize:"11px", fontWeight:700, whiteSpace:"nowrap" }}>{sevLabel(level)}</span>; }
function Chip({ children, onClick, active, mono }){
  return <button onClick={onClick} style={{ padding:"6px 11px", borderRadius:"9px", border:`1px solid ${active?S.acc:S.bdr}`, background:active?`${S.acc}22`:"transparent", color:active?S.acc:S.sub, fontSize:"12px", fontWeight:active?700:500, cursor:"pointer", fontFamily:mono?"monospace":"inherit", minHeight:"34px" }}>{children}</button>;
}
function Thumbs({ images, onOpen, size=60 }){
  if(!images || !images.length) return null;
  return <div style={{ display:"flex", flexWrap:"wrap", gap:"5px", marginTop:"6px" }}>{images.map((im,j)=> <img key={j} src={im} alt="" onClick={()=>onOpen&&onOpen(im)} style={{ width:size, height:size, objectFit:"cover", borderRadius:"6px", cursor:"zoom-in" }}/>)}</div>;
}

// ═══ Repair diary per code / vehicle (edit + delete inside edit) ═══
function NotesPanel({ sKey, notes, setNotes, askConfirm, onOpenImg }){
  const [text,setText] = useState(""); const [imgs,setImgs] = useState([]);
  const [editId,setEditId] = useState(null); const [editText,setEditText] = useState("");
  const fRef = useRef(null); const my = notes[sKey] || [];
  function add(){
    if(!text.trim() && !imgs.length) return;
    const u = { ...notes }; u[sKey] = [ ...(u[sKey]||[]), { id:uid(), text:text.trim(), images:[...imgs], at:new Date().toISOString(), ts:new Date().toLocaleString("he-IL") } ];
    setNotes(u); setText(""); setImgs([]); toast(T("✅ נשמר"));
  }
  function saveEdit(){ const u = { ...notes }; u[sKey] = (u[sKey]||[]).map(n=>n.id===editId?{ ...n, text:editText.trim() }:n); setNotes(u); setEditId(null); }
  function del(id){ askConfirm({ text:T("למחוק את הרשומה הזו?"), ok:T("מחק"), danger:true, onOk:()=>{ const u = { ...notes }; u[sKey] = (u[sKey]||[]).filter(n=>n.id!==id); if(!u[sKey].length) delete u[sKey]; setNotes(u); setEditId(null); } }); }
  function onFiles(e){ Array.from(e.target.files||[]).forEach(f=>{ if(!f.type.startsWith("image/")) return; resizeImage(f).then(d=>{ if(d) setImgs(p=>[...p,d]); }); }); e.target.value=""; }
  return <Card title={"📝 "+T("יומן תיקונים אישי")}>
    <p style={{ color:S.muted, fontSize:"12px", margin:"0 0 8px" }}>{T("רשום מה עשית כשנתקלת בתקלה זו — יעזור לך בפעם הבאה!")}</p>
    {my.map(n => <div key={n.id} style={{ background:S.inner, borderRadius:"10px", padding:"9px 10px", marginBottom:"6px", border:`1px solid ${editId===n.id?S.acc:S.bdr}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ color:S.muted, fontSize:"11px" }}>{fmtDate(n.at,n.ts)}</span>
        {editId!==n.id && <IconBtn label={T("עריכה")} onClick={()=>{ setEditId(n.id); setEditText(n.text||""); }} color={S.acc}>✏️</IconBtn>}
      </div>
      {editId===n.id ? <div>
        <Field area rows={3} value={editText} onChange={e=>setEditText(e.target.value)}/>
        <div style={{ display:"flex", gap:"6px", marginTop:"6px" }}>
          <Btn onClick={saveEdit} style={{ flex:1 }}>{T("שמור")}</Btn>
          <Btn kind="ghost" onClick={()=>setEditId(null)}>{T("ביטול")}</Btn>
          <Btn kind="danger" onClick={()=>del(n.id)}>{T("מחק")}</Btn>
        </div>
      </div> : n.text && <p style={{ color:S.text, fontSize:"13px", margin:"4px 0 0", lineHeight:1.55, whiteSpace:"pre-wrap" }}>{n.text}</p>}
      <Thumbs images={n.images} onOpen={onOpenImg}/>
    </div>)}
    <Field area rows={2} value={text} onChange={e=>setText(e.target.value)} placeholder={T("מה עשית? מה מצאת? טיפ לעתיד...")}/>
    {imgs.length>0 && <div style={{ display:"flex", flexWrap:"wrap", gap:"5px", marginTop:"6px" }}>{imgs.map((im,j)=> <div key={j} style={{ position:"relative" }}><img src={im} alt="" style={{ width:"52px", height:"52px", objectFit:"cover", borderRadius:"6px" }}/><button aria-label={T("הסר תמונה")} onClick={()=>setImgs(p=>p.filter((_,k)=>k!==j))} style={{ position:"absolute", top:"-6px", insetInlineEnd:"-6px", background:S.red, border:"none", color:"#fff", borderRadius:"50%", width:"20px", height:"20px", fontSize:"11px", cursor:"pointer" }}>✕</button></div>)}</div>}
    <div style={{ display:"flex", gap:"6px", marginTop:"8px" }}>
      <input ref={fRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display:"none" }}/>
      <Btn kind="ghost" onClick={()=>fRef.current?.click()} style={{ flex:1 }}>📷 {T("תמונה")}</Btn>
      <Btn kind="green" onClick={add} style={{ flex:1 }}>💾 {T("שמור")}</Btn>
    </div>
  </Card>;
}

// ═══ Wiring-diagram viewer: pinch / drag / double-tap zoom, pages, numbered pins with notes ═══
function DiagramViewer({ meta, onClose, onMarks, onEdit, askConfirm, backArrow }){
  const [page,setPage] = useState(0); const [url,setUrl] = useState(""); const [err,setErr] = useState(false);
  const [view,setView] = useState({ s:1, x:0, y:0 }); const [addMode,setAddMode] = useState(false);
  const [draft,setDraft] = useState(null); const [sel,setSel] = useState(null); const [selText,setSelText] = useState("");
  const box = useRef(null); const img = useRef(null); const ptrs = useRef(new Map()); const g = useRef(null); const lastTap = useRef(0);
  const marks = meta.marks || []; const pageMarks = marks.map((m,i)=>({ ...m, i })).filter(m=>(m.p||0)===page);
  useEffect(()=>{ let u = ""; let dead = false; setUrl(""); setErr(false); setView({ s:1, x:0, y:0 }); setSel(null); setDraft(null);
    loadPage(meta.id, page).then(b=>{ if(dead) return; if(!b){ setErr(true); return; } u = URL.createObjectURL(b); setUrl(u); });
    return ()=>{ dead = true; if(u) URL.revokeObjectURL(u); };
  },[meta.id, page]);
  function clamp(v){
    const el = box.current, im = img.current; if(!el || !im) return v;
    const cw = el.clientWidth, ch = el.clientHeight, iw = im.offsetWidth*v.s, ih = im.offsetHeight*v.s;
    const s = Math.min(8, Math.max(1, v.s));
    const x = iw <= cw ? (cw-iw)/2 : Math.min(0, Math.max(cw-iw, v.x));
    const y = ih <= ch ? Math.max(0, Math.min((ch-ih)/2, v.y)) : Math.min(40, Math.max(ch-ih-40, v.y));
    return { s, x, y };
  }
  function zoomAt(cx, cy, ns, from){ const v = from || view; const s = Math.min(8, Math.max(1, ns)); const px = (cx - v.x)/v.s, py = (cy - v.y)/v.s; return clamp({ s, x: cx - px*s, y: cy - py*s }); }
  const rel = e => { const r = box.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function down(e){
    box.current.setPointerCapture && box.current.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, rel(e));
    const ps = [...ptrs.current.values()];
    if(ps.length===1) g.current = { mode:"pan", p0:ps[0], v0:view, moved:false, t0:Date.now() };
    if(ps.length===2){ const d = Math.hypot(ps[0].x-ps[1].x, ps[0].y-ps[1].y); g.current = { mode:"pinch", d0:d||1, m0:{ x:(ps[0].x+ps[1].x)/2, y:(ps[0].y+ps[1].y)/2 }, v0:view, moved:true }; }
  }
  function move(e){
    if(!ptrs.current.has(e.pointerId) || !g.current) return;
    ptrs.current.set(e.pointerId, rel(e)); const ps = [...ptrs.current.values()]; const G = g.current;
    if(G.mode==="pinch" && ps.length>=2){
      const d = Math.hypot(ps[0].x-ps[1].x, ps[0].y-ps[1].y); const m = { x:(ps[0].x+ps[1].x)/2, y:(ps[0].y+ps[1].y)/2 };
      const s = Math.min(8, Math.max(1, G.v0.s*d/G.d0)); const px = (G.m0.x-G.v0.x)/G.v0.s, py = (G.m0.y-G.v0.y)/G.v0.s;
      setView(clamp({ s, x: m.x - px*s, y: m.y - py*s }));
    } else if(G.mode==="pan" && ps.length===1){
      const dx = ps[0].x-G.p0.x, dy = ps[0].y-G.p0.y; if(Math.abs(dx)+Math.abs(dy)>6) G.moved = true;
      if(G.moved) setView(clamp({ s:G.v0.s, x:G.v0.x+dx, y:G.v0.y+dy }));
    }
  }
  function up(e){
    const G = g.current; const p = ptrs.current.get(e.pointerId); ptrs.current.delete(e.pointerId);
    if(ptrs.current.size===1 && G && G.mode==="pinch"){ const q = [...ptrs.current.values()][0]; g.current = { mode:"pan", p0:q, v0:view, moved:true, t0:0 }; return; }
    if(ptrs.current.size) return; g.current = null;
    if(!G || G.mode!=="pan" || G.moved || !p || Date.now()-G.t0>350) return;
    // a tap
    if(addMode && img.current){ const x = (p.x-view.x)/view.s/img.current.offsetWidth, y = (p.y-view.y)/view.s/img.current.offsetHeight;
      if(x>=0&&x<=1&&y>=0&&y<=1){ setDraft({ x, y, text:"" }); setSel(null); } return; }
    const now = Date.now();
    if(now-lastTap.current<320){ lastTap.current = 0; setView(view.s>1.2 ? clamp({ s:1, x:0, y:0 }) : zoomAt(p.x, p.y, 2.6)); }
    else lastTap.current = now;
  }
  function wheel(e){ const p = rel(e); setView(zoomAt(p.x, p.y, view.s*(e.deltaY<0?1.2:1/1.2))); }
  const btnZoom = f => { const el = box.current; if(!el) return; setView(zoomAt(el.clientWidth/2, el.clientHeight/2, view.s*f)); };
  function saveDraft(){ if(!draft) return; onMarks([ ...marks, { p:page, x:draft.x, y:draft.y, text:draft.text.trim() } ]); setDraft(null); setAddMode(false); toast(T("✅ נשמר")); }
  function saveSel(){ onMarks(marks.map((m,i)=>i===sel?{ ...m, text:selText.trim() }:m)); setSel(null); }
  function delSel(){ const i = sel; askConfirm({ text:T("למחוק את הסימון הזה?"), ok:T("מחק"), danger:true, onOk:()=>{ onMarks(marks.filter((_,j)=>j!==i)); setSel(null); } }); }
  const n = meta.pages||1; const bar = { background:"rgba(15,23,42,.94)", color:"#fff", display:"flex", alignItems:"center", gap:"6px", padding:"8px 10px" };
  const vb = { background:"transparent", border:"1px solid rgba(255,255,255,.25)", color:"#fff", borderRadius:"10px", minWidth:"42px", minHeight:"40px", fontSize:"16px", cursor:"pointer", fontFamily:"inherit" };
  const pinNo = m => pageMarks.findIndex(x=>x.i===m.i)+1;
  return createPortal(<div dir={en()?"ltr":"rtl"} style={{ position:"fixed", inset:0, zIndex:250, background:"#0B0F17", display:"flex", flexDirection:"column", fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif" }}>
    <div style={bar}>
      <button onClick={onClose} style={{ ...vb, padding:"0 12px", fontSize:"13px", fontWeight:700, color:S.acc }}>{backArrow} {T("סכמות")}</button>
      <div style={{ flex:1, minWidth:0 }}><div style={{ fontWeight:700, fontSize:"14px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} dir="auto">{meta.title || dgSystemName(meta.system, en())}</div><div style={{ fontSize:"11px", opacity:.7, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }} dir="auto">{[meta.make, meta.model, dgYears(meta)].filter(Boolean).join(" · ")}</div></div>
      <button onClick={onEdit} aria-label={T("עריכה")} style={vb}>✏️</button>
    </div>
    <div ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel} style={{ flex:1, position:"relative", overflow:"hidden", touchAction:"none", cursor:addMode?"crosshair":"grab", background:"#2B2F36" }}>
      {err && <p style={{ color:"#fff", textAlign:"center", marginTop:"40px" }}>⚠️ {T("הדף לא נמצא במכשיר")}</p>}
      {url && <div style={{ position:"absolute", left:0, top:0, width:"100%", transformOrigin:"0 0", transform:`translate(${view.x}px,${view.y}px) scale(${view.s})` }}>
        <img ref={img} src={url} alt="" draggable={false} onLoad={()=>setView(v=>clamp(v))} style={{ width:"100%", display:"block", userSelect:"none", background:"#fff" }}/>
        {pageMarks.map(m=> <button key={m.i} onPointerDown={e=>e.stopPropagation()} onClick={()=>{ setSel(m.i); setSelText(m.text||""); setDraft(null); }} style={{ position:"absolute", left:`${m.x*100}%`, top:`${m.y*100}%`, transform:`translate(-50%,-50%) scale(${1/view.s})`, width:"30px", height:"30px", borderRadius:"50%", background:sel===m.i?S.acc:"#E53935", color:"#fff", border:"2px solid #fff", fontWeight:800, fontSize:"13px", boxShadow:"0 2px 6px rgba(0,0,0,.5)", cursor:"pointer", padding:0 }}>{pinNo(m)}</button>)}
        {draft && <div style={{ position:"absolute", left:`${draft.x*100}%`, top:`${draft.y*100}%`, transform:`translate(-50%,-50%) scale(${1/view.s})`, width:"30px", height:"30px", borderRadius:"50%", background:S.acc, border:"2px solid #fff" }}/>}
      </div>}
      {addMode && !draft && <div style={{ position:"absolute", top:8, left:"50%", transform:"translateX(-50%)", background:S.acc, color:S.onAcc, padding:"6px 12px", borderRadius:"10px", fontSize:"12px", fontWeight:700, pointerEvents:"none" }}>📍 {T("הקש על המקום לסימון")}</div>}
    </div>
    {(draft || sel!==null) && <div style={{ background:S.card, padding:"10px", borderTop:`2px solid ${S.acc}` }}>
      {draft ? <>
        <Field value={draft.text} onChange={e=>setDraft({ ...draft, text:e.target.value })} placeholder={T("מה יש כאן? (למשל: ירוק-לבן = אות חיישן)")} aria-label={T("הערה לסימון")} autoFocus/>
        <div style={{ display:"flex", gap:"6px", marginTop:"6px" }}><Btn onClick={saveDraft} style={{ flex:1 }}>💾 {T("שמור")}</Btn><Btn kind="ghost" onClick={()=>{ setDraft(null); }}>{T("ביטול")}</Btn></div>
      </> : <>
        <Field value={selText} onChange={e=>setSelText(e.target.value)} aria-label={T("הערה לסימון")} placeholder={T("הערה לסימון")}/>
        <div style={{ display:"flex", gap:"6px", marginTop:"6px" }}><Btn onClick={saveSel} style={{ flex:1 }}>💾 {T("שמור")}</Btn><Btn kind="ghost" onClick={()=>setSel(null)}>{T("סגור")}</Btn><Btn kind="danger" onClick={delSel}>{T("מחק")}</Btn></div>
      </>}
    </div>}
    <div style={{ ...bar, justifyContent:"space-between", paddingBottom:"calc(8px + env(safe-area-inset-bottom))" }}>
      <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
        <button style={vb} disabled={page<=0} aria-label={T("הדף הקודם")} onClick={()=>setPage(page-1)}>{en()?"‹":"›"}</button>
        <span style={{ fontSize:"13px", minWidth:"46px", textAlign:"center" }}>{page+1}/{n}</span>
        <button style={vb} disabled={page>=n-1} aria-label={T("הדף הבא")} onClick={()=>setPage(page+1)}>{en()?"›":"‹"}</button>
      </div>
      <div style={{ display:"flex", gap:"6px" }}>
        <button style={vb} aria-label={T("הקטן")} onClick={()=>btnZoom(1/1.5)}>−</button>
        <button style={vb} aria-label={T("הגדל")} onClick={()=>btnZoom(1.5)}>＋</button>
        <button style={{ ...vb, background:addMode?S.acc:"transparent", color:addMode?S.onAcc:"#fff" }} aria-label={T("הוסף סימון")} onClick={()=>{ setAddMode(!addMode); setDraft(null); setSel(null); }}>📍</button>
      </div>
    </div>
    {meta.notes && page===0 && !draft && sel===null && <div style={{ position:"absolute", bottom:"70px", insetInline:"10px", background:"rgba(15,23,42,.85)", color:"#fff", fontSize:"12px", padding:"6px 10px", borderRadius:"10px", pointerEvents:"none", whiteSpace:"pre-wrap" }} dir="auto">📝 {meta.notes}</div>}
  </div>, document.body);
}
const dgYears = m => m.yFrom && m.yTo ? (m.yFrom===m.yTo ? String(m.yFrom) : `${m.yFrom}–${m.yTo}`) : m.yFrom ? `${m.yFrom}+` : m.yTo ? `–${m.yTo}` : "";

// ═══ Add / edit a diagram (delete lives only here, with confirm) ═══
function DiagramSheet({ init, preset, busy, onSave, onDelete, onClose, askConfirm, backArrow }){
  const [make,setMake] = useState(init ? init.make||"" : (preset&&preset.make)||"");
  const [model,setModel] = useState(init ? init.model||"" : (preset&&preset.model)||"");
  const [yFrom,setYFrom] = useState(init ? (init.yFrom||"") : (preset&&preset.year)||"");
  const [yTo,setYTo] = useState(init ? (init.yTo||"") : (preset&&preset.year)||"");
  const [system,setSystem] = useState(init ? init.system||"other" : "engine");
  const [title,setTitle] = useState(init ? init.title||"" : ""); const [notes,setNotes] = useState(init ? init.notes||"" : "");
  const [files,setFiles] = useState([]); const fRef = useRef(null);
  function pick(e){ const f = Array.from(e.target.files||[]); e.target.value=""; if(f.length) setFiles(p=>[...p, ...f]); }
  function save(){
    if(!make.trim()){ toast(T("נא למלא יצרן")); return; }
    if(!init && !files.length){ toast(T("נא לבחור קובץ PDF או תמונות")); return; }
    const yf = parseInt(yFrom)||0, yt = parseInt(yTo)||0;
    onSave({ make:make.trim(), model:model.trim(), yFrom:yf&&yt&&yf>yt?yt:yf, yTo:yf&&yt&&yf>yt?yf:yt, system, title:title.trim(), notes:notes.trim() }, files);
  }
  const lab = { color:S.sub, fontSize:"12px", fontWeight:700, display:"block" };
  return createPortal(<div dir={en()?"ltr":"rtl"} style={{ position:"fixed", inset:0, zIndex:260, background:S.bg, overflow:"auto", fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif", color:S.text }}>
    <div style={{ position:"sticky", top:0, background:S.card, borderBottom:`2px solid ${S.acc}`, padding:"8px 10px", display:"flex", alignItems:"center", gap:"8px", zIndex:2 }}>
      <button onClick={onClose} disabled={!!busy} style={{ background:"transparent", border:`1px solid ${S.bdr}`, color:S.acc, borderRadius:"10px", padding:"8px 12px", fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", minHeight:"40px" }}>{backArrow} {T("סכמות")}</button>
      <h2 style={{ fontSize:"16px", margin:0 }}>{init?T("עריכת סכמה"):T("סכמה חדשה")}</h2>
    </div>
    <div style={{ padding:"12px", maxWidth:"720px", margin:"0 auto", display:"flex", flexDirection:"column", gap:"10px" }}>
      <label style={lab}>{T("יצרן")} *<Field value={make} onChange={e=>setMake(e.target.value)} list="dg-makes" placeholder="Toyota" style={{ marginTop:"4px" }}/></label>
      <datalist id="dg-makes">{CAR_MAKES.map(m=> <option key={m} value={m}/>)}</datalist>
      <label style={lab}>{T("דגם")}<Field value={model} onChange={e=>setModel(e.target.value)} placeholder="Corolla" style={{ marginTop:"4px" }}/></label>
      <div style={{ display:"flex", gap:"8px" }}>
        <label style={{ ...lab, flex:1 }}>{T("משנה")}<Field value={yFrom} onChange={e=>setYFrom(e.target.value.replace(/\D/g,"").slice(0,4))} inputMode="numeric" placeholder="2014" style={{ marginTop:"4px" }}/></label>
        <label style={{ ...lab, flex:1 }}>{T("עד שנה")}<Field value={yTo} onChange={e=>setYTo(e.target.value.replace(/\D/g,"").slice(0,4))} inputMode="numeric" placeholder="2018" style={{ marginTop:"4px" }}/></label>
      </div>
      <label style={lab}>{T("מערכת")}<Select value={system} onChange={e=>setSystem(e.target.value)} label={T("מערכת")} style={{ marginTop:"4px" }}>{DG_SYSTEMS.map(s=> <option key={s[0]} value={s[0]}>{en()?s[2]:s[1]}</option>)}</Select></label>
      <label style={lab}>{T("כותרת (לא חובה)")}<Field value={title} onChange={e=>setTitle(e.target.value)} placeholder={T("למשל: מחשב מנוע 1ZR — מחברים A ו-B")} style={{ marginTop:"4px" }}/></label>
      <label style={lab}>{T("הערות")}<Field area rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder={T("מקור הסכמה, טיפים, מה בדקת...")} style={{ marginTop:"4px" }}/></label>
      <input ref={fRef} type="file" accept="application/pdf,image/*" multiple onChange={pick} style={{ display:"none" }}/>
      <Btn kind="ghost" onClick={()=>fRef.current?.click()} disabled={!!busy}>📎 {init?T("הוסף דפים (PDF או תמונות)"):T("בחר PDF או תמונות")}</Btn>
      {files.length>0 && <div style={{ background:S.inner, borderRadius:"10px", padding:"8px 10px" }}>{files.map((f,i)=> <div key={i} style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", color:S.sub }}><span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} dir="auto">{/pdf/i.test(f.type)||/\.pdf$/i.test(f.name)?"📄":"🖼️"} {f.name}</span><span>{fmtMB(f.size)}</span><IconBtn label={T("הסר")} onClick={()=>setFiles(files.filter((_,j)=>j!==i))}>✕</IconBtn></div>)}</div>}
      {init && <p style={{ color:S.muted, fontSize:"12px", margin:0 }}>{T("בסכמה יש {n} דפים",{ n:init.pages||0 })}</p>}
      <p style={{ color:S.muted, fontSize:"11px", margin:0 }}>{T("PDF נשמר כתמונות של כל דף, כך שהוא נפתח גם בלי אינטרנט. עד {n} דפים לסכמה.",{ n:MAX_PAGES })}</p>
      {busy && <p style={{ color:S.acc, fontWeight:700, fontSize:"13px", margin:0 }}>⏳ {busy}</p>}
      <div style={{ display:"flex", gap:"8px" }}>
        <Btn kind="green" onClick={save} disabled={!!busy} style={{ flex:2, fontSize:"15px" }}>💾 {T("שמור")}</Btn>
        {init && <Btn kind="danger" disabled={!!busy} onClick={()=>askConfirm({ text:T("למחוק את הסכמה וכל הדפים שלה?"), ok:T("מחק"), danger:true, onOk:onDelete })}>🗑️ {T("מחק")}</Btn>}
      </div>
    </div>
  </div>, document.body);
}

// ═══ AutoDiag assistant: answers offline from the app's knowledge; optional online AI with the user's own key ═══
function MiniMd({ text }){
  const lines = String(text||"").split("\n");
  const inline = s => String(s).split("**").map((p,i)=> i%2 ? <strong key={i} style={{ color:S.text }}>{p}</strong> : <span key={i}>{p}</span>);
  return <>{lines.map((l,i)=>{
    if(!l.trim()) return <div key={i} style={{ height:"6px" }}/>;
    const b = /^\s*[•\-\*]\s+/.test(l), n = /^\s*\d+\.\s+/.exec(l);
    return <p key={i} style={{ margin:"0 0 3px", lineHeight:1.6, paddingInlineStart:(b||n)?"14px":0, position:"relative" }}>{(b||n) && <span style={{ position:"absolute", insetInlineStart:0, color:S.acc }}>{n?n[0].trim():"•"}</span>}{inline(l.replace(/^\s*[•\-\*]\s+|^\s*\d+\.\s+/,""))}</p>;
  })}</>;
}
function AssistantPanel({ onClose, getCtx, messages, setMessages, aiCfg, setAiCfg, onAction, actLabel, askConfirm, backArrow, view, setView }){
  const [q,setQ] = useState(""); const [busy,setBusy] = useState(""); const [listening,setListening] = useState(false); const [showKey,setShowKey] = useState(false);
  const endRef = useRef(null); const recRef = useRef(null); const inRef = useRef(null);
  const hasKey = !!cleanKey(aiCfg.key);
  const SR = typeof window!=="undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  useEffect(()=>{ try{ endRef.current && endRef.current.scrollIntoView({ behavior:"smooth", block:"end" }); }catch(e){} },[messages.length, busy]);
  useEffect(()=>()=>{ try{ recRef.current && recRef.current.stop(); window.speechSynthesis && window.speechSynthesis.cancel(); }catch(e){} },[]);
  const add = m => setMessages(p=>[...p, { id:uid(), at:Date.now(), ...m }].slice(-80));
  async function goAI(question, offline){
    if(!navigator.onLine){ add({ role:"bot", text:T("אין חיבור לאינטרנט — התשובה למעלה היא מהמידע שבאפליקציה."), err:true }); return; }
    setBusy("ai");
    try{
      const ctx = getCtx(); const hist = messages.filter(m=>m.role==="user"||m.ai).slice(-6).map(m=>({ role:m.role, text:m.text||"" }));
      const txt = await askAI({ provider:aiCfg.provider, key:aiCfg.key, model:aiCfg.model, question, appKnowledge: offline ? offline.ctxText : "", carContext: aiContext(ctx), history:hist, lang:ctx.lang });
      add({ role:"bot", ai:true, text: txt || T("לא התקבלה תשובה.") });
    }catch(e){
      const m = String(e && e.message || e);
      add({ role:"bot", err:true, text: m==="no-key" ? T("לא הוגדר מפתח AI.") : m==="timeout" ? T("ה-AI לא ענה בזמן. נסה שוב.") : /api key|permission|401|403|invalid/i.test(m) ? T("המפתח לא התקבל — בדוק אותו בהגדרות העוזר.") : T("שגיאה מה-AI: {m}",{ m:m.slice(0,140) }) });
    }finally{ setBusy(""); }
  }
  function send(text){
    const question = String(text ?? q).trim(); if(!question || busy) return;
    setQ(""); add({ role:"user", text:question });
    setBusy("local");
    setTimeout(()=>{
      let r; try{ r = answer(question, getCtx()); }catch(e){ r = { parts:[T("משהו השתבש בעיבוד השאלה.")], acts:[], conf:0, ctxText:"" }; }
      add({ role:"bot", text:r.parts.join("\n\n"), acts:r.acts, conf:r.conf, q:question, ctxText:r.ctxText });
      setBusy("");
      if(hasKey && aiCfg.auto && r.conf < 0.6) goAI(question, r);
    }, 60);
  }
  function mic(){
    if(!SR) return;
    if(listening){ try{ recRef.current && recRef.current.stop(); }catch(e){} return; }
    try{
      const rec = new SR(); recRef.current = rec; rec.lang = en() ? "en-US" : "he-IL"; rec.interimResults = true; rec.maxAlternatives = 1;
      let finalText = "";
      rec.onresult = e => { let t = ""; for(let i=0;i<e.results.length;i++) t += e.results[i][0].transcript; finalText = t; setQ(t); };
      rec.onend = () => { setListening(false); if(finalText.trim()) send(finalText); };
      rec.onerror = ev => { setListening(false); if(ev && ev.error==="network") toast(T("זיהוי דיבור צריך אינטרנט במכשיר הזה")); };
      setListening(true); rec.start();
    }catch(e){ setListening(false); }
  }
  function speak(text){
    try{
      const ss = window.speechSynthesis; if(!ss) return; ss.cancel();
      const u = new SpeechSynthesisUtterance(String(text).replace(/\*\*/g,"").replace(/[•📍📘🧭📖📊📐📝📋⚠️✅]/g,"")); u.lang = en() ? "en-US" : "he-IL"; u.rate = 1.02; ss.speak(u);
    }catch(e){}
  }
  const sugg = suggestions(getCtx());
  const head = { position:"sticky", top:0, background:S.card, borderBottom:`2px solid ${S.acc}`, padding:"8px 10px", display:"flex", alignItems:"center", gap:"8px", zIndex:2 };
  const backBtn = { background:"transparent", border:`1px solid ${S.bdr}`, color:S.acc, borderRadius:"10px", padding:"8px 12px", fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", minHeight:"40px", whiteSpace:"nowrap" };
  const lab = { color:S.sub, fontSize:"12px", fontWeight:700, display:"block" };
  return createPortal(<div dir={en()?"ltr":"rtl"} style={{ position:"fixed", inset:0, zIndex:230, background:S.bg, color:S.text, display:"flex", flexDirection:"column", fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif" }}>
    <div style={head}>
      <button onClick={view==="settings" ? ()=>setView("chat") : onClose} style={backBtn}>{backArrow} {view==="settings" ? T("העוזר") : T("חזרה")}</button>
      <div style={{ flex:1, minWidth:0 }}><div style={{ fontWeight:800, fontSize:"15px" }}>🤖 {view==="settings" ? T("הגדרות העוזר") : T("העוזר של AutoDiag")}</div>
        {view!=="settings" && <div style={{ fontSize:"11px", color:hasKey?S.green:S.muted }}>{hasKey ? "● "+T("מקומי + AI ({p})",{ p:(AI_PROVIDERS[aiCfg.provider]||AI_PROVIDERS.gemini).name }) : "● "+T("עובד בלי אינטרנט, מהמידע שבאפליקציה")}</div>}</div>
      {view!=="settings" && <IconBtn label={T("הגדרות העוזר")} onClick={()=>setView("settings")}>⚙️</IconBtn>}
    </div>
    {view==="settings" ? <div style={{ flex:1, overflow:"auto", padding:"12px", maxWidth:"720px", width:"100%", margin:"0 auto", boxSizing:"border-box" }}>
      <Card title={"🧠 "+T("איך העוזר עובד")}><p style={{ color:S.sub, fontSize:"13px", lineHeight:1.65, margin:0 }}>{T("בלי מפתח ובלי אינטרנט העוזר עונה מכל מה שבאפליקציה: מאגר הקודים ושילובי קודים, הסריקה האחרונה, עצי אבחון, סכמות טיפוסיות, ערכי חיישנים, חישובים, והיומן וההערות שלך. אם תוסיף מפתח AI משלך, הוא יוכל גם לשלוח את השאלה לבינה מלאכותית ברשת — יחד עם מה שהאפליקציה כבר מצאה.")}</p></Card>
      <Card title={"🌐 "+T("AI ברשת (לא חובה)")}>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          <label style={lab}>{T("ספק")}<Select value={aiCfg.provider} onChange={e=>setAiCfg({ ...aiCfg, provider:e.target.value, model:"" })} label={T("ספק")} style={{ marginTop:"4px" }}>{Object.entries(AI_PROVIDERS).map(([k,p])=> <option key={k} value={k}>{p.name}</option>)}</Select></label>
          <label style={lab}>{T("מפתח API")}<div style={{ display:"flex", gap:"6px", marginTop:"4px" }}><Field type={showKey?"text":"password"} value={aiCfg.key} onChange={e=>setAiCfg({ ...aiCfg, key:e.target.value })} placeholder={aiCfg.provider==="openai"?"sk-...":"AIza..."} autoComplete="off" style={{ direction:"ltr", fontFamily:"monospace" }}/><Btn kind="ghost" onClick={()=>setShowKey(!showKey)} label={T("הצג מפתח")}>{showKey?"🙈":"👁️"}</Btn></div></label>
          <button onClick={()=>openExt((AI_PROVIDERS[aiCfg.provider]||AI_PROVIDERS.gemini).keyUrl)} style={{ background:"none", border:"none", color:S.blue, textAlign:"start", padding:0, cursor:"pointer", fontFamily:"inherit", fontSize:"13px" }}>🔑 {aiCfg.provider==="openai" ? T("איפה מקבלים מפתח OpenAI") : T("איפה מקבלים מפתח Gemini חינמי")} ↗</button>
          <label style={lab}>{T("מודל (לא חובה)")}<Field value={aiCfg.model} onChange={e=>setAiCfg({ ...aiCfg, model:e.target.value })} placeholder={(AI_PROVIDERS[aiCfg.provider]||AI_PROVIDERS.gemini).model} style={{ marginTop:"4px", direction:"ltr", fontFamily:"monospace" }}/></label>
          <label style={{ display:"flex", alignItems:"center", gap:"8px", color:S.text, fontSize:"13px", cursor:"pointer" }}><input type="checkbox" checked={!!aiCfg.auto} onChange={e=>setAiCfg({ ...aiCfg, auto:e.target.checked })} style={{ width:"20px", height:"20px", accentColor:S.acc }}/>{T("שאל את ה-AI אוטומטית כשאין תשובה טובה באפליקציה")}</label>
          <p style={{ color:S.muted, fontSize:"11px", margin:0, lineHeight:1.5 }}>🔒 {T("המפתח נשמר רק בטלפון. כשאתה שולח שאלה ל-AI, היא נשלחת לספק שבחרת יחד עם פרטי הרכב והסריקה — לא מספר רישוי ולא שם לקוח.")}</p>
        </div>
      </Card>
      <Card title={"🧹 "+T("שיחה")}><Btn kind="danger" disabled={!messages.length} onClick={()=>askConfirm({ text:T("למחוק את כל השיחה עם העוזר?"), ok:T("מחק"), danger:true, onOk:()=>setMessages([]) })} style={{ width:"100%" }}>🗑️ {T("נקה שיחה")}</Btn></Card>
    </div> : <>
      <div style={{ flex:1, overflow:"auto", padding:"12px 10px", maxWidth:"760px", width:"100%", margin:"0 auto", boxSizing:"border-box" }}>
        {!messages.length && <div style={{ textAlign:"center", padding:"14px 6px", color:S.sub }}>
          <div style={{ fontSize:"42px" }}>🤖</div>
          <p style={{ fontSize:"14px", lineHeight:1.65, margin:"6px 0 12px" }}>{T("שאל אותי על קוד או כמה קודים יחד, על תקלה, על ערך שמדדת, על חיישן, הדק או פין — או בקש לנתח את הסריקה. אני עובד גם בלי אינטרנט.")}</p>
        </div>}
        {messages.map(m=> m.role==="user"
          ? <div key={m.id} style={{ display:"flex", justifyContent:"flex-end", margin:"0 0 8px" }}><div style={{ background:S.acc, color:S.onAcc, padding:"9px 12px", borderRadius:"14px", borderEndEndRadius:"4px", maxWidth:"85%", fontSize:"14px", fontWeight:600, whiteSpace:"pre-wrap" }}>{m.text}</div></div>
          : <div key={m.id} style={{ margin:"0 0 10px", maxWidth:"94%" }}>
              <div style={{ background:m.err?`${S.red}14`:m.ai?`${S.blue}14`:S.card, border:`1px solid ${m.err?S.red:m.ai?S.blue:S.bdr}`, padding:"10px 12px", borderRadius:"14px", borderEndStartRadius:"4px", fontSize:"14px", color:S.sub }}>
                {m.ai && <div style={{ color:S.blue, fontSize:"11px", fontWeight:800, marginBottom:"4px" }}>🌐 {T("תשובת AI")}</div>}
                <MiniMd text={m.text}/>
              </div>
              {(m.acts||[]).length>0 && <div style={{ display:"flex", flexWrap:"wrap", gap:"5px", marginTop:"5px" }}>{m.acts.map((a,i)=> <button key={i} onClick={()=>onAction(a)} style={{ background:S.inner, border:`1px solid ${S.bdr}`, color:S.acc, borderRadius:"9px", padding:"6px 10px", fontSize:"12px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{actLabel(a)}</button>)}</div>}
              <div style={{ display:"flex", gap:"2px", marginTop:"2px" }}>
                <IconBtn label={T("הקרא")} onClick={()=>speak(m.text)}>🔊</IconBtn>
                <IconBtn label={T("העתק")} onClick={()=>{ try{ navigator.clipboard.writeText(String(m.text).replace(/\*\*/g,"")); toast(T("הועתק")); }catch(e){} }}>📋</IconBtn>
                {!m.ai && !m.err && m.q && hasKey && <button onClick={()=>goAI(m.q, m)} disabled={!!busy} style={{ background:"none", border:`1px solid ${S.blue}`, color:S.blue, borderRadius:"9px", padding:"4px 10px", fontSize:"12px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>🌐 {T("הרחבה מ-AI")}</button>}
                {!m.ai && !m.err && m.q && !hasKey && m.conf < 0.6 && <button onClick={()=>setView("settings")} style={{ background:"none", border:"none", color:S.muted, fontSize:"11px", cursor:"pointer", fontFamily:"inherit", textDecoration:"underline" }}>{T("רוצה תשובה מהרשת? הוסף מפתח AI")}</button>}
              </div>
            </div>)}
        {busy && <div style={{ color:S.muted, fontSize:"13px", padding:"6px" }}>{busy==="ai" ? "🌐 "+T("שואל את ה-AI...") : "🤔 "+T("חושב...")}</div>}
        <div ref={endRef}/>
      </div>
      <div style={{ background:S.card, borderTop:`1px solid ${S.bdr}`, padding:"8px 10px calc(8px + env(safe-area-inset-bottom))" }}>
        <div style={{ maxWidth:"760px", margin:"0 auto" }}>
          {(!messages.length || messages.length < 3) && <div style={{ display:"flex", gap:"6px", overflowX:"auto", paddingBottom:"7px" }}>{sugg.map(s=> <button key={s} onClick={()=>send(s)} style={{ flexShrink:0, background:S.inner, border:`1px solid ${S.bdr}`, color:S.sub, borderRadius:"16px", padding:"6px 11px", fontSize:"12px", cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>{s}</button>)}</div>}
          <div style={{ display:"flex", gap:"6px", alignItems:"flex-end" }}>
            <Field area rows={1} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); send(); } }} placeholder={listening ? T("מקשיב...") : T("שאל שאלה...")} aria-label={T("שאלה לעוזר")} style={{ minHeight:"44px", maxHeight:"120px", fontSize:"15px" }}/>
            {SR && <Btn kind={listening?"danger":"ghost"} onClick={mic} label={T("דבר")} style={{ minWidth:"46px" }}>{listening?"⏹":"🎤"}</Btn>}
            <Btn onClick={()=>send()} disabled={!q.trim() || !!busy} label={T("שלח")} style={{ minWidth:"52px" }}>➤</Btn>
          </div>
        </div>
      </div>
    </>}
  </div>, document.body);
}

// ═══ MAIN APP ═══
export default function App(){
  // navigation
  const [tab,setTab] = useState("home");
  const [sub,setSub] = useState(null); // { id, from }
  // settings + data
  const [settings,setSettings] = useState(DEFAULT_SETTINGS);
  const [notes,setNotes] = useState({}); const [favs,setFavs] = useState([]);
  const [history,setHistory] = useState([]); const [workLog,setWorkLog] = useState([]);
  const [loaded,setLoaded] = useState(false);
  // overlays
  const [toastMsg,setToastMsg] = useState("");
  const [confirmBox,setConfirmBox] = useState(null);
  const [guideStep,setGuideStep] = useState(-1);
  const [showHist,setShowHist] = useState(false);
  const [imgView,setImgView] = useState(null);
  const [wlSheet,setWlSheet] = useState(null); // { id|null }
  // code search
  const [codeInput,setCodeInput] = useState(""); const [codeResult,setCodeResult] = useState(null); const [notFound,setNotFound] = useState(null);
  const [homeQuery,setHomeQuery] = useState("");
  // OBD locator
  const [make,setMake] = useState(""); const [makeCustom,setMakeCustom] = useState("");
  const [model,setModel] = useState(""); const [modelCustom,setModelCustom] = useState(""); const [year,setYear] = useState("");
  // work log form
  const [wlPlate,setWlPlate] = useState(""); const [wlDesc,setWlDesc] = useState(""); const [wlImgs,setWlImgs] = useState([]);
  const [wlCost,setWlCost] = useState(""); const [wlHours,setWlHours] = useState(""); const [wlCodes,setWlCodes] = useState([]);
  const [logFilter,setLogFilter] = useState("");
  const [timerOn,setTimerOn] = useState(false); const [timerStart,setTimerStart] = useState(0); const [timerElapsed,setTimerElapsed] = useState(0);
  // tools
  const [selSymptoms,setSelSymptoms] = useState([]);
  const [wireMake,setWireMake] = useState("כללי"); const [wdMake,setWdMake] = useState(""); const [wdModel,setWdModel] = useState("");
  const [convSel,setConvSel] = useState(0); const [convVal,setConvVal] = useState("");
  const [ohmV,setOhmV] = useState(""); const [ohmI,setOhmI] = useState(""); const [ohmR,setOhmR] = useState("");
  const [allSearch,setAllSearch] = useState("");
  // scanner
  const [scanDev,setScanDev] = useState(null); const [scanStatus,setScanStatus] = useState("disconnected");
  const [scanCodes,setScanCodes] = useState(null); // { stored, pending, permanent }
  const [scanLive,setScanLive] = useState({}); const [scanLog,setScanLog] = useState([]);
  const [scanVin,setScanVin] = useState(""); const [scanReady,setScanReady] = useState(null); const [scanFF,setScanFF] = useState(null);
  const [scanBusy,setScanBusy] = useState(""); const [liveOn,setLiveOn] = useState(false); const [termCmd,setTermCmd] = useState("");
  const scanBuf = useRef(""); const scanCh = useRef(null); const scanWaiter = useRef(null); const scanQueue = useRef(Promise.resolve()); const scanProto = useRef("");
  const scanSup = useRef(null); const liveRef = useRef(false);
  const liveHist = useRef({}); const [liveTick,setLiveTick] = useState(0); const [liveSel,setLiveSel] = useState(""); const recRef = useRef(false); const recRows = useRef([]); const [recOn,setRecOn] = useState(false);
  // vehicle (plate lookup / VIN)
  const [vehicle,setVehicle] = useState(null); const [vehicles,setVehicles] = useState([]);
  const [plateIn,setPlateIn] = useState(""); const [plateBusy,setPlateBusy] = useState(false); const [plateMsg,setPlateMsg] = useState("");
  const [wlVeh,setWlVeh] = useState(null);
  // wiring-diagram library
  const [diagrams,setDiagrams] = useState([]); const [dgSheet,setDgSheet] = useState(null); const [dgView,setDgView] = useState(null);
  const [dgBusy,setDgBusy] = useState(""); const [dgQuery,setDgQuery] = useState(""); const [dgOnlyVeh,setDgOnlyVeh] = useState(false); const [dgStore,setDgStore] = useState(null);
  const dgImpRef = useRef(null); const [circOpen,setCircOpen] = useState("");
  // troubleshooting trees + calculators
  const [treeSel,setTreeSel] = useState(null); // { id, path:[nodeId] }
  const [cv,setCv] = useState({ vdL:"3", vdA:"1.5", vdI:"10", ledV:"14.4", ledF:"2.0", ledI:"20", drI:"60", drAh:"60", pwW:"120", pwV:"12" });
  const setC = (k,v) => setCv(p=>({ ...p, [k]:v }));
  // assistant
  const [assistOpen,setAssistOpen] = useState(false); const [assistView,setAssistView] = useState("chat");
  const [chat,setChat] = useState([]); const [aiCfg,setAiCfg] = useState({ provider:"gemini", key:"", model:"", auto:true });
  // refs
  const rRef = useRef(null); const wlFRef = useRef(null); const importRef = useRef(null); const topRef = useRef(null);
  const hist = useRef({ guard:false }); const exitArm = useRef(false); const backRef = useRef(()=>{}); const pressT = useRef(null);

  // apply language + theme before painting children
  ctx.lang = settings.lang; ctx.user = { name:settings.name, phone:settings.phone, address:settings.address||"", bizId:settings.bizId||"", logo:settings.logo||"" };
  applyTheme(settings.theme);
  const dir = settings.lang==="en" ? "ltr" : "rtl";

  // ─── load ───
  useEffect(()=>{ (async()=>{
    const [n,f,h,w,st,vh,vhs,dgs,ch,ai] = await Promise.all([loadData("adp_notes",{}),loadData("adp_favs",[]),loadData("adp_history",[]),loadData("adp_worklog",[]),loadData("adp_settings",DEFAULT_SETTINGS),loadData("adp_vehicle",null),loadData("adp_vehicles",[]),loadData("adp_diagrams",[]),loadData("adp_chat",[]),loadData("adp_ai",null)]);
    const s2 = { ...DEFAULT_SETTINGS, ...st };
    setNotes(n); setFavs(f); setHistory(h); setWorkLog(w); setSettings(s2); setVehicle(vh); setVehicles(vhs||[]); setDiagrams(dgs||[]); setChat(ch||[]); if(ai) setAiCfg(p=>({ ...p, ...ai })); setLoaded(true);
    if(!s2.guideDone) setGuideStep(0);
  })(); },[]);
  useEffect(()=>{ if(loaded) saveData("adp_notes",notes); },[notes,loaded]);
  useEffect(()=>{ if(loaded) saveData("adp_vehicle",vehicle); },[vehicle,loaded]);
  useEffect(()=>{ if(loaded) saveData("adp_vehicles",vehicles); },[vehicles,loaded]);
  useEffect(()=>{ if(loaded) saveData("adp_diagrams",diagrams); },[diagrams,loaded]);
  useEffect(()=>{ if(loaded) saveData("adp_chat",chat); },[chat,loaded]);
  useEffect(()=>{ if(loaded) saveData("adp_ai",aiCfg); },[aiCfg,loaded]);
  useEffect(()=>{ if(loaded) saveData("adp_favs",favs); },[favs,loaded]);
  useEffect(()=>{ if(loaded) saveData("adp_history",history); },[history,loaded]);
  useEffect(()=>{ if(loaded) saveData("adp_worklog",workLog); },[workLog,loaded]);
  useEffect(()=>{ if(loaded) saveData("adp_settings",settings); },[settings,loaded]);
  useEffect(()=>{ try{ document.documentElement.lang = settings.lang; document.documentElement.dir = dir; }catch(e){} },[settings.lang]);

  // ─── toasts ───
  useEffect(()=>{
    let t=null;
    const show = msg => { setToastMsg(msg); clearTimeout(t); t=setTimeout(()=>setToastMsg(""),4000); };
    const onErr = () => show(T("⚠️ השמירה נכשלה — ייתכן שהזיכרון במכשיר מלא. כדאי לגבות ולמחוק תמונות ישנות."));
    const onToast = e => show(e.detail||"");
    window.addEventListener("adp-save-error",onErr); window.addEventListener("adp-toast",onToast);
    try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{}); }catch(e){}
    return ()=>{ window.removeEventListener("adp-save-error",onErr); window.removeEventListener("adp-toast",onToast); clearTimeout(t); };
  },[]);
  useEffect(()=>{ if((codeResult||notFound)&&rRef.current) rRef.current.scrollIntoView({ behavior:"smooth", block:"start" }); },[codeResult,notFound]);
  useEffect(()=>{ if(!timerOn) return; const iv=setInterval(()=>setTimerElapsed(Date.now()-timerStart),1000); return ()=>clearInterval(iv); },[timerOn,timerStart]);
  useEffect(()=>{ try{ window.scrollTo(0,0); }catch(e){} },[tab,sub]);
  useEffect(()=>{ if(sub && sub.id==="circuits" && circOpen){ const t = setTimeout(()=>{ const el = document.getElementById("circ-"+circOpen); if(el) el.scrollIntoView({ behavior:"smooth", block:"start" }); },120); return ()=>clearTimeout(t); } },[sub]);

  // ─── phone back button (AppNest mandatory requirement 1) ───
  // One "guard" history entry always exists, except during the 2-second exit window.
  function syncHistory(){
    const need = !exitArm.current;
    if(need && !hist.current.guard){ history_push(); hist.current.guard = true; }
  }
  function history_push(){ try{ window.history.pushState({ adp:1 }, ""); }catch(e){} }
  function handleBack(){
    if(confirmBox){ setConfirmBox(null); return; }
    if(imgView){ setImgView(null); return; }
    if(guideStep>=0){ finishGuide(); return; }
    if(dgSheet){ if(!dgBusy) setDgSheet(null); return; }
    if(assistOpen){ if(assistView!=="chat") setAssistView("chat"); else setAssistOpen(false); return; }
    if(dgView){ setDgView(null); return; }
    if(wlSheet){ closeSheet(); return; }
    if(showHist){ setShowHist(false); return; }
    if(sub && sub.id==="trees" && treeSel){ if(treeSel.path.length>1) setTreeSel({ ...treeSel, path:treeSel.path.slice(0,-1) }); else setTreeSel(null); return; }
    if(sub){ backSub(); return; }
    if(tab!=="home"){ setTab("home"); return; }
    exitArm.current = true;
    toast(T("לחץ שוב כדי לצאת"));
    setTimeout(()=>{ exitArm.current = false; syncHistory(); }, 2000);
  }
  backRef.current = handleBack;
  useEffect(()=>{
    syncHistory();
    const onPop = () => { hist.current.guard = false; backRef.current(); syncHistory(); };
    window.addEventListener("popstate", onPop);
    return ()=>window.removeEventListener("popstate", onPop);
  },[]);

  // ─── navigation helpers ───
  function goTab(t){ if(t===tab && !sub){ try{ window.scrollTo({ top:0, behavior:"smooth" }); }catch(e){} return; } setSub(null); setTab(t); }
  function openSub(id){ if(sub && sub.id===id) return; setSub({ id, from: sub ? sub.from : tab, prev: sub || null }); }
  function backSub(){ if(sub && sub.prev) setSub(sub.prev); else { setTab(sub ? sub.from : "home"); setSub(null); } }
  const SUB_TITLES = { obd:"מיקום שקע OBD", diag:"מחשבון אבחון", sensors:"חיישנים ומצבר", wires:"חיווט", convert:"ממיר ומחשבון אוהם", all:"מאגר קודים", settings:"הגדרות", about:"אודות", lib:"הסכמות שלי", circuits:"סכמות טיפוסיות", trees:"עצי אבחון", ref:"מידע טכני", calc:"מחשבונים" };
  const TAB_NAMES = { home:"בית", code:"קוד", scan:"סורק", log:"יומן", more:"עוד" };
  const setS = patch => setSettings(p=>({ ...p, ...patch }));
  const askConfirm = c => setConfirmBox(c);
  function finishGuide(){ setGuideStep(-1); setS({ guideDone:true }); }

  // ─── code search ───
  function searchCode(c){
    const code = String(c||codeInput).trim().toUpperCase(); if(!code) return;
    setCodeResult(null); setNotFound(null);
    if(CODES_DB[code]){ setCodeResult(code); } else setNotFound(code);
    setHistory(p=>[ ...p.filter(h=>h.code!==code), { code, at:new Date().toISOString(), ts:new Date().toLocaleString("he-IL") } ].slice(-100));
    setCodeInput(code); setSub(null); setTab("code"); setShowHist(false);
  }
  function toggleFav(code){ setFavs(p=>p.includes(code)?p.filter(c=>c!==code):[...p,code]); }

  // ─── work log ───
  function openSheet(entry, presetCodes, presetVeh, presetDesc){ setPlateMsg("");
    if(entry){ setWlPlate(entry.plate||""); setWlDesc(entry.desc||""); setWlImgs(entry.images||[]); setWlCost(entry.cost||""); setWlHours(entry.hours||""); setWlCodes(entry.codes||[]); setWlVeh(entry.veh||null); setWlSheet({ id:entry.id }); }
    else { const v = presetVeh===undefined ? vehicle : presetVeh; setWlPlate(v&&v.plate?fmtPlate(v.plate):(v&&v.vin?v.vin:"")); setWlDesc(presetDesc||""); setWlImgs([]); setWlCost(""); setWlHours(""); setWlCodes(presetCodes||[]); setWlVeh(v||null); setWlSheet({ id:null }); }
  }
  function closeSheet(){ setWlSheet(null); setTimerOn(false); }
  function saveSheet(){
    if(!wlPlate.trim()){ toast(T("נא למלא מספר רכב / זיהוי")); return; }
    const hrs = wlHours || (timerElapsed>0 ? (timerElapsed/3600000).toFixed(2) : "");
    if(wlSheet.id){ setWorkLog(p=>p.map(w=>w.id===wlSheet.id?{ ...w, plate:wlPlate.trim(), desc:wlDesc.trim(), images:[...wlImgs], cost:wlCost, hours:hrs, codes:wlCodes, veh:wlVeh }:w)); }
    else { setWorkLog(p=>[{ id:uid(), plate:wlPlate.trim(), desc:wlDesc.trim(), images:[...wlImgs], at:new Date().toISOString(), ts:new Date().toLocaleString("he-IL"), codes:wlCodes, cost:wlCost, hours:hrs, veh:wlVeh }, ...p]); }
    setTimerOn(false); setTimerElapsed(0); setWlSheet(null); toast(T("✅ נשמר ביומן"));
  }
  function deleteSheet(){ const id = wlSheet.id; askConfirm({ text:T("למחוק את הרכב הזה מהיומן? אי אפשר לבטל."), ok:T("מחק"), danger:true, onOk:()=>{ setWorkLog(p=>p.filter(x=>x.id!==id)); setWlSheet(null); } }); }
  function onWlFiles(e){ Array.from(e.target.files||[]).forEach(f=>{ if(!f.type.startsWith("image/")) return; resizeImage(f).then(d=>{ if(d) setWlImgs(p=>[...p,d]); }); }); e.target.value=""; }
  function longPress(fn){ return { onPointerDown:()=>{ clearTimeout(pressT.current); pressT.current=setTimeout(fn,550); }, onPointerUp:()=>clearTimeout(pressT.current), onPointerLeave:()=>clearTimeout(pressT.current), onPointerCancel:()=>clearTimeout(pressT.current) }; }
  function logCsv(){
    const rows = [[T("תאריך"),T("רכב"),T("תיאור"),T("קודים"),T("עלות"),T("שעות")]].concat(workLog.map(w=>[fmtDate(w.at,w.ts),w.plate,w.desc||"",(w.codes||[]).join(" "),w.cost||"",w.hours||""]));
    const csv = "﻿"+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n");
    download(csv,`autodiag-log-${new Date().toISOString().slice(0,10)}.csv`,"text/csv;charset=utf-8");
  }
  function logPrint(list){
    doPrint(T("יומן עבודה"), list.map(w=>`<div style="border:1px solid #ddd;padding:8px;border-radius:6px;margin-bottom:8px"><strong>${esc(w.plate)}</strong> <small>(${esc(fmtDate(w.at,w.ts))})</small>${w.desc?`<p style="white-space:pre-wrap">${esc(w.desc)}</p>`:""}${w.cost?`<p>💰 ${esc(T("עלות"))}: ${esc(w.cost)} ₪</p>`:""}${w.hours?`<p>⏱️ ${esc(T("שעות"))}: ${esc(w.hours)}</p>`:""}${w.codes&&w.codes.length?`<p>${esc(T("קודים"))}: ${esc(w.codes.join(", "))}</p>`:""}${w.images&&w.images.length?`<div style="display:flex;gap:4px;flex-wrap:wrap">${w.images.map(i=>`<img src="${i}" style="width:110px;height:110px;object-fit:cover;border-radius:4px"/>`).join("")}</div>`:""}</div>`).join(""), []);
  }

  // ─── backup / restore / delete all ───
  function download(content, name, type){
    try{ const blob = new Blob([content],{ type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000); }
    catch(e){ toast(T("ההורדה נכשלה")); }
  }
  function doExport(){
    const data = { app:"AutoDiag Pro", version:APP_VERSION, exported:new Date().toISOString(), user:settings.name||"", summary:{ worklog:workLog.length, notes:Object.values(notes).reduce((a,b)=>a+b.length,0), favorites:favs.length, vehicles:vehicles.length }, notes, favs, history, workLog, vehicles, settings };
    download(JSON.stringify(data,null,1),`autodiag-backup-${new Date().toISOString().slice(0,10)}.json`,"application/json");
    toast(T("✅ קובץ הגיבוי נוצר"));
  }
  function doImport(e){
    const file = e.target.files?.[0]; e.target.value=""; if(!file) return;
    const r = new FileReader();
    r.onload = ev => {
      let d=null; try{ d = JSON.parse(ev.target.result); }catch(err){}
      if(!d || typeof d!=="object" || !(d.notes||d.workLog||d.favs)){ toast(T("❌ הקובץ אינו גיבוי של AutoDiag Pro")); return; }
      askConfirm({ text:T("השחזור יחליף את כל הנתונים שבמכשיר בנתונים מהגיבוי. להמשיך?"), ok:T("שחזר"), onOk:()=>{
        setNotes(d.notes||{}); setFavs(d.favs||[]); setHistory(d.history||[]); setWorkLog(d.workLog||[]); if(d.vehicles) setVehicles(d.vehicles);
        if(d.settings) setSettings(p=>({ ...p, ...d.settings, guideDone:true }));
        toast(T("✅ הגיבוי שוחזר"));
      } });
    };
    r.readAsText(file);
  }
  function deleteAll(){
    askConfirm({ text:T("למחוק את כל הנתונים? (יומן, הערות, תמונות, מועדפים, היסטוריה)"), ok:T("המשך"), danger:true, onOk:()=>setTimeout(()=>askConfirm({ text:T("בטוח? הפעולה לא ניתנת לביטול. מומלץ לגבות קודם."), ok:T("מחק הכל"), danger:true, onOk:async()=>{
      await Promise.all(["adp_notes","adp_favs","adp_history","adp_worklog","adp_vehicle","adp_vehicles","adp_diagrams","adp_chat","adp_ai"].map(deleteData));
      for(const m of diagrams) await deletePages(m.id, m.pages||0);
      setNotes({}); setFavs([]); setHistory([]); setWorkLog([]); setVehicle(null); setVehicles([]); setDiagrams([]); setChat([]); setAiCfg({ provider:"gemini", key:"", model:"", auto:true }); toast(T("כל הנתונים נמחקו"));
    } }),50) });
  }
  function shareApp(){
    const url = ABOUT.link.includes("appnest") ? location.origin + location.pathname : location.href;
    if(navigator.share){ navigator.share({ title:"AutoDiag Pro", text:T("אפליקציית אבחון רכב לחשמלאי רכב"), url }).catch(()=>{}); }
    else { try{ navigator.clipboard.writeText(url); toast(T("הקישור הועתק")); }catch(e){ openExt(url); } }
  }

  // ─── vehicle: plate lookup (Cloudflare Function → data.gov.il) ───
  const vehMake = v => v ? (v.makeEn || makeFromHe(v.makeHe) || makeFromHe(v.maker) || v.maker || v.makeHe || "") : "";
  const vehLabel = v => v ? ([vehMake(v), v.model, v.year].filter(Boolean).join(" ") || (v.vin ? "VIN "+v.vin : "")) : "";
  function setCurrentVehicle(v){
    if(!v) { setVehicle(null); return; }
    const vv = { ...v, makeEn: v.makeEn || makeFromHe(v.makeHe) || makeFromHe(v.maker), at:new Date().toISOString() };
    setVehicle(vv);
    if(vv.plate) setVehicles(p=>[vv, ...p.filter(x=>x.plate!==vv.plate)].slice(0,20));
  }
  async function lookupPlate(n, onFound){
    const d = String(n||"").replace(/\D/g,"");
    if(d.length<5 || d.length>8){ setPlateMsg(T("מספר רישוי צריך להכיל 5 עד 8 ספרות")); return null; }
    setPlateBusy(true); setPlateMsg("");
    try{
      const r = await fetch(`./api/plate?n=${d}`, { headers:{ "Accept":"application/json" } });
      const ct = r.headers.get("content-type")||"";
      if(!ct.includes("json")) throw new Error("no-api");
      const j = await r.json();
      if(!j.ok) throw new Error(j.error||"error");
      if(!j.found){ setPlateMsg(T("הרכב {p} לא נמצא במאגר הרכבים הפעילים של משרד התחבורה.",{ p:fmtPlate(d) })); return null; }
      setCurrentVehicle(j.vehicle); setPlateIn(""); onFound && onFound(j.vehicle); return j.vehicle;
    }catch(e){
      setPlateMsg(String(e.message)==="no-api" ? T("החיפוש לפי מספר רישוי עובד רק מהכתובת autodiag-pro.pages.dev.") : T("אין חיבור למאגר משרד התחבורה כרגע. נסה שוב בעוד רגע."));
      return null;
    }finally{ setPlateBusy(false); }
  }
  function vehToObd(v){
    const mk = vehMake(v); const inList = CAR_MAKES.includes(mk);
    setMake(inList ? mk : "__custom__"); setMakeCustom(inList ? "" : (mk || v.makeHe || ""));
    const models = inList ? (CAR_MODELS[mk]||[]) : [];
    const m = models.find(x=>x.toLowerCase().replace(/[^a-z0-9]/g,"")===String(v.model||"").toLowerCase().replace(/[^a-z0-9]/g,""));
    if(inList){ setModel(m || "__custom__"); setModelCustom(m ? "" : (v.model||"")); } else setModelCustom(v.model||"");
    setYear(v.year ? String(v.year) : ""); openSub("obd");
  }
  function vehToWires(v){ setWdMake(vehMake(v)); setWdModel([v.model, v.year].filter(Boolean).join(" ")); openSub("wires"); }
  function vehRows(v){
    const fuel = v.fuel ? (en() ? ({ "בנזין":"Petrol", "דיזל":"Diesel", "חשמל":"Electric", "היברידי":"Hybrid", "גפ\"מ":"LPG" }[v.fuel] || v.fuel) : v.fuel) : "";
    return [
      [T("רכב"), vehLabel(v)], [T("מספר רישוי"), v.plate?fmtPlate(v.plate):""], [T("יצרן במשרד"), v.makeHe],
      [T("קוד דגם"), [v.modelCode, v.trim].filter(Boolean).join(" · ")], [T("קוד מנוע"), v.engineCode],
      [T("נפח מנוע"), v.cc ? `${v.cc} cc` : ""], [T("כוח"), v.hp ? `${v.hp} ${T("כ\"ס")}` : ""], [T("דלק"), fuel],
      [T("תיבה"), v.auto===true ? T("אוטומטית") : v.auto===false ? T("ידנית") : ""], [T("הנעה"), v.drive], [T("מרכב"), v.body],
      ["VIN", v.vin], [T("צבע"), v.color], [T("בעלות"), v.ownership], [T("טסט אחרון"), v.lastTest], [T("תוקף רישיון"), v.testValid],
      [T("צמיגים"), v.tyresFront ? (v.tyresRear && v.tyresRear!==v.tyresFront ? `${v.tyresFront} / ${v.tyresRear}` : v.tyresFront) : ""],
    ].filter(r=>r[1]);
  }

  // ─── customer report from a log entry ───
  function customerReport(w){
    const en_ = en(); const v = w.veh;
    const rows = [[T("תאריך"), fmtDate(w.at,w.ts)], [T("מספר רישוי"), w.plate]].concat(v ? vehRows(v).filter(r=>r[0]!==T("מספר רישוי")) : []);
    const codesHtml = (w.codes||[]).length ? `<h3>${esc(T("קודי תקלה שנמצאו"))}</h3><table style="width:100%;border-collapse:collapse">${w.codes.map(c=>`<tr><td style="border:1px solid #ddd;padding:6px;font-family:monospace;font-weight:bold;white-space:nowrap">${esc(c)}</td><td style="border:1px solid #ddd;padding:6px">${esc(codeTitle(c)||T("לא במאגר"))}</td></tr>`).join("")}</table>` : "";
    const html = `<table style="width:100%;border-collapse:collapse;margin-bottom:10px">${rows.map(([k,val])=>`<tr><td style="border:1px solid #ddd;padding:6px;background:#FAF6EA;width:34%">${esc(k)}</td><td style="border:1px solid #ddd;padding:6px" dir="auto">${esc(val)}</td></tr>`).join("")}</table>${codesHtml}${w.desc?`<h3>${esc(T("העבודה שבוצעה"))}</h3><p style="white-space:pre-wrap">${esc(w.desc)}</p>`:""}${(w.cost||w.hours)?`<h3>${esc(T("עלות וזמן"))}</h3><p>${w.cost?`${esc(T("עלות"))}: <strong>${esc(w.cost)} ₪</strong>`:""}${w.cost&&w.hours?" · ":""}${w.hours?`${esc(T("שעות עבודה"))}: ${esc(w.hours)}`:""}</p>`:""}${w.images&&w.images.length?`<h3>${esc(T("תמונות"))}</h3><div style="display:flex;gap:6px;flex-wrap:wrap">${w.images.map(i=>`<img src="${i}" style="width:150px;height:150px;object-fit:cover;border-radius:6px"/>`).join("")}</div>`:""}<div style="display:flex;justify-content:space-between;margin-top:36px;gap:20px"><div style="flex:1;border-top:1px solid #999;padding-top:4px;font-size:12px">${esc(T("חתימת הלקוח"))}</div><div style="flex:1;border-top:1px solid #999;padding-top:4px;font-size:12px">${esc(T("חתימת המוסך / החשמלאי"))}</div></div>`;
    doPrint(`${T("דוח עבודה ללקוח")} — ${fmtPlate(w.plate)}`, html, []);
  }
  function reportText(w){
    const v = w.veh;
    return [`${T("רכב")}: ${fmtPlate(w.plate)}${v?` · ${vehLabel(v)}`:""}`, w.codes&&w.codes.length?`${T("קודים")}: ${w.codes.map(c=>`${c} (${codeTitle(c)||"?"})`).join(", ")}`:"", w.desc?`${T("העבודה שבוצעה")}: ${w.desc}`:"", w.cost?`${T("עלות")}: ${w.cost} ₪`:"", w.hours?`${T("שעות")}: ${w.hours}`:""].filter(Boolean).join("\n");
  }

  // ─── ELM327 scanner ───
  const BLE_PROFILES = [
    { name:"Vgate iCar Pro", svc:"e7810a71-73ae-499d-8c15-faa9aef0c3f2", tx:"bef8d6c9-9c21-4c9e-b632-bd58c1009f9f", rx:"bef8d6c9-9c21-4c9e-b632-bd58c1009f9f" },
    { name:"Vgate (FFF0)", svc:"0000fff0-0000-1000-8000-00805f9b34fb", tx:"0000fff2-0000-1000-8000-00805f9b34fb", rx:"0000fff1-0000-1000-8000-00805f9b34fb" },
    { name:"Generic ELM327", svc:"0000ffe0-0000-1000-8000-00805f9b34fb", tx:"0000ffe1-0000-1000-8000-00805f9b34fb", rx:"0000ffe1-0000-1000-8000-00805f9b34fb" },
    { name:"KONNWEI/Generic2", svc:"0000ffe5-0000-1000-8000-00805f9b34fb", tx:"0000ffe9-0000-1000-8000-00805f9b34fb", rx:"0000ffe9-0000-1000-8000-00805f9b34fb" },
    { name:"OBDLink", svc:"0000fef1-0000-1000-8000-00805f9b34fb", tx:"0000fef2-0000-1000-8000-00805f9b34fb", rx:"0000fef2-0000-1000-8000-00805f9b34fb" },
  ];
  const slog = m => setScanLog(p=>[...p.slice(-299), m]);
  function resetScan(){ liveHist.current = {}; setLiveSel(""); recRef.current=false; setRecOn(false); setScanCodes(null); setScanVin(""); setScanReady(null); setScanFF(null); setScanLive({}); scanSup.current=null; liveRef.current=false; setLiveOn(false); }
  async function initElm(label){
    slog("⚙️ "+T("אתחול ELM327..."));
    const id = await scanSendCmd("ATZ",4000);
    const ver = (elmLines(id).find(l=>/ELM|v\d/i.test(l))||"").trim();
    slog(ver ? "🔧 "+ver : "⚠️ "+T("המתאם לא ענה ל-ATZ (ממשיך בכל זאת)"));
    for(const cmd of ["ATE0","ATL0","ATS0","ATH0","ATAT1","ATSP0"]) await scanSendCmd(cmd,2500);
    const volt = elmLines(await scanSendCmd("ATRV",2500)).find(l=>/\d/.test(l));
    if(volt){ setScanLive(p=>({ ...p, batt:volt.replace(/[^\d.]/g,"") })); slog("🔋 "+T("מתח מצבר: {v}",{ v:volt })); }
    slog("🚗 "+T("מתחבר למחשב הרכב (זה יכול לקחת עד 10 שניות)..."));
    const probe = await scanSendCmd("0100",12000); const probeLines = elmLines(probe);
    const sup = parseSupported(probe,"00");
    if(!sup.size){ slog("⚠️ "+T("המתאם מחובר, אבל מחשב הרכב לא ענה ({r}). ודא שההצתה דלוקה (ON) ונסה שוב.",{ r:probeLines.join(" | ")||T("אין תשובה") })); }
    else {
      for(const base of ["20","40","60","80","A0"]){ const prev = base==="20"?"20":base; if(!sup.has(prev)) break; parseSupported(await scanSendCmd("01"+base,4000),base).forEach(x=>sup.add(x)); }
      scanSup.current = sup; slog("📋 "+T("מחשב הרכב תומך ב-{n} נתונים חיים",{ n:LIVE_PIDS.filter(p=>sup.has(p.pid)).length }));
    }
    scanProto.current = elmLines(await scanSendCmd("ATDPN",2500)).join("").replace(/^A/i,"").trim();
    slog("📶 "+T("פרוטוקול: {p}",{ p:protoName(scanProto.current) }));
    setScanStatus("connected"); slog("✅ "+T("מחובר ומוכן! ({n})",{ n:label }));
    if(sup.size) await scanQuickRead();
  }
  async function scanConnect(){
    if(!navigator.bluetooth){ setScanStatus("unsupported"); return; }
    try{
      resetScan(); setScanStatus("searching"); slog("🔍 "+T("מחפש מתאמים..."));
      const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices:true, optionalServices:BLE_PROFILES.map(p=>p.svc) });
      setScanStatus("connecting"); setScanDev(dev); slog("📡 "+T("מתחבר ל-{n}...",{ n:dev.name||"Unknown" }));
      dev.addEventListener("gattserverdisconnected",()=>{ scanCh.current=null; liveRef.current=false; setLiveOn(false); setScanStatus("disconnected"); if(scanWaiter.current){ const w=scanWaiter.current; scanWaiter.current=null; w(scanBuf.current); } slog("🔌 "+T("המתאם התנתק")); });
      const server = await dev.gatt.connect();
      let writeCh=null, profile=null;
      for(const pr of BLE_PROFILES){
        try{
          const svc = await server.getPrimaryService(pr.svc);
          const rxCh = await svc.getCharacteristic(pr.rx);
          await rxCh.startNotifications();
          rxCh.addEventListener("characteristicvaluechanged",e=>{ scanBuf.current += new TextDecoder().decode(e.target.value); if(scanBuf.current.includes(">")&&scanWaiter.current){ const w=scanWaiter.current; scanWaiter.current=null; w(scanBuf.current); } });
          if(pr.tx===pr.rx) writeCh=rxCh; else { try{ writeCh = await svc.getCharacteristic(pr.tx); }catch(e2){ writeCh=rxCh; } }
          profile=pr; slog("✅ "+T("פרופיל: {n}",{ n:pr.name })); break;
        }catch(e){}
      }
      if(!writeCh){ setScanStatus("error"); slog("❌ "+T("המתאם לא חושף שירות ELM327 מוכר. ייתכן שזה מתאם Bluetooth קלאסי (לא BLE) או WiFi.")); try{ dev.gatt.disconnect(); }catch(e){} return; }
      scanCh.current = writeCh;
      await initElm(profile.name);
    }catch(err){
      const m = String(err&&err.message||err);
      setScanStatus(/cancel/i.test(m)?"disconnected":"error");
      slog(/cancel/i.test(m) ? "ℹ️ "+T("החיפוש בוטל") : "❌ "+m);
    }
  }
  async function scanDemo(){
    resetScan(); setScanLog([]); scanCh.current = makeDemoAdapter(); setScanDev(null); setScanStatus("connecting");
    slog("🎮 "+T("מצב הדגמה — סימולציה של רכב, בלי מתאם אמיתי"));
    await initElm("DEMO");
  }
  function scanDisconnect(){ liveRef.current=false; setLiveOn(false); try{ if(scanDev?.gatt?.connected) scanDev.gatt.disconnect(); }catch(e){} scanCh.current=null; setScanDev(null); setScanStatus("disconnected"); slog("🔌 "+T("מנותק")); }
  // one command at a time; resolves at the ">" prompt or on timeout
  function scanSendCmd(cmd, timeout=5000){
    const run = () => new Promise(resolve=>{
      const ch = scanCh.current; if(!ch){ resolve(""); return; }
      if(ch.demo){ setTimeout(()=>resolve(ch.respond(cmd)), 60+Math.random()*80); return; }
      scanBuf.current = ""; let done=false;
      const finish = v => { if(done) return; done=true; clearTimeout(t); scanWaiter.current=null; resolve(v); };
      const t = setTimeout(()=>finish(scanBuf.current), timeout);
      scanWaiter.current = finish;
      const bytes = new TextEncoder().encode(cmd+"\r"); const pr = ch.properties||{};
      (async()=>{ try{ for(let i=0;i<bytes.length;i+=20){ const part=bytes.slice(i,i+20);
        if(pr.write&&ch.writeValueWithResponse) await ch.writeValueWithResponse(part);
        else if(pr.writeWithoutResponse&&ch.writeValueWithoutResponse) await ch.writeValueWithoutResponse(part);
        else await ch.writeValue(part); } }catch(e){ finish(""); } })();
    });
    const p = scanQueue.current.then(run,run); scanQueue.current = p.catch(()=>{}); return p;
  }
  async function scanReadDTCs(){
    if(!scanCh.current) return; setScanBusy("codes"); slog("📡 "+T("קורא קודים..."));
    try{
      const can = isCanProto(scanProto.current);
      const rawS = await scanSendCmd("03",8000);
      if(elmLines(rawS).some(l=>/UNABLE TO CONNECT|ERROR/i.test(l))){ slog("⚠️ "+T("תשובת המתאם: {r}",{ r:elmLines(rawS).join(" | ") })); return; }
      const stored = parseDTCs(rawS,"43",can);
      const pending = parseDTCs(await scanSendCmd("07",8000),"47",can).filter(c=>!stored.includes(c));
      const permanent = parseDTCs(await scanSendCmd("0A",8000),"4A",can).filter(c=>!stored.includes(c)&&!pending.includes(c));
      setScanCodes({ stored, pending, permanent });
      const n = stored.length+pending.length+permanent.length;
      slog(n ? "🔍 "+T("נמצאו {n} קודים: {c}",{ n, c:[...stored,...pending,...permanent].join(", ") }) : "✅ "+T("אין קודי תקלה!"));
      const ffRaw = await scanSendCmd("020200",4000); const ffd = parseFF(ffRaw,"02");
      if(ffd && ffd!=="0000"){
        const ffCode = parseDTCs("43"+"01"+ffd,"43",true)[0] || "";
        const vals = {};
        for(const p of LIVE_PIDS.slice(0,10)){ if(scanSup.current && !scanSup.current.has(p.pid)) continue; const d = parseFF(await scanSendCmd("02"+p.pid+"00",3000),p.pid); if(d) vals[p.pid]=p.f(d); }
        setScanFF({ code:ffCode, vals });
      } else setScanFF(null);
    } finally { setScanBusy(""); }
  }
  async function scanReadInfo(){
    if(!scanCh.current) return; setScanBusy("info");
    try{
      const vin = parseVIN(await scanSendCmd("0902",6000));
      if(vin){ setScanVin(vin); slog("🔑 VIN: "+vin); } else slog("ℹ️ "+T("הרכב לא מסר VIN (נפוץ ברכבים ישנים)"));
      const rd = decodeReadiness(parsePID(await scanSendCmd("0101",4000),"01"));
      setScanReady(rd);
      if(rd) slog(`💡 MIL ${rd.mil?T("דולקת"):T("כבויה")} · ${T("{n} קודים שמורים",{ n:rd.dtcCount })}`);
    } finally { setScanBusy(""); }
  }
  async function scanQuickRead(){ await scanReadInfo(); await scanReadDTCs(); }
  function scanClearDTCs(){
    if(!scanCh.current) return;
    askConfirm({ text:T("למחוק את קודי התקלה מהרכב? גם נתוני Freeze Frame ומצב המוכנות יימחקו. מומלץ עם הצתה דלוקה ומנוע כבוי."), ok:T("מחק קודים"), danger:true, onOk:async()=>{
      const lines = elmLines(await scanSendCmd("04",8000));
      if(lines.some(l=>/^44/.test(l.replace(/\s/g,"")))){ setScanCodes({ stored:[], pending:[], permanent:[] }); setScanFF(null); slog("🗑️ "+T("קודים נמחקו!")); await scanReadInfo(); }
      else slog("⚠️ "+T("לא התקבל אישור מחיקה ({r}). נסה שוב עם מנוע כבוי והצתה דלוקה.",{ r:lines.join(" | ")||T("אין תשובה") }));
    } });
  }
  const livePids = () => LIVE_PIDS.filter(p=>!scanSup.current || scanSup.current.has(p.pid));
  async function scanReadLiveOnce(){
    const snap = {};
    for(const p of livePids()){
      if(!scanCh.current) break;
      const d = parsePID(await scanSendCmd("01"+p.pid,3000),p.pid);
      const v = d ? p.f(d) : "N/A"; snap[p.pid] = v;
      setScanLive(prev=>({ ...prev, [p.pid]: v }));
    }
    // history for the graphs + optional recording
    const H = liveHist.current; const t = Date.now();
    for(const k in snap){ const n = parseFloat(snap[k]); if(!isFinite(n)) continue; (H[k] = H[k] || []).push(n); if(H[k].length > 120) H[k].shift(); }
    if(recRef.current){ recRows.current.push({ t, ...snap }); if(recRows.current.length > 5000) recRows.current.shift(); }
    setLiveTick(x=>x+1);
  }
  function recToggle(){
    if(recRef.current){ recRef.current = false; setRecOn(false); toast(T("ההקלטה נעצרה — {n} דגימות",{ n:recRows.current.length })); return; }
    recRows.current = []; recRef.current = true; setRecOn(true); if(!liveRef.current) toggleLive();
  }
  function recCsv(){
    const rows = recRows.current; if(!rows.length) return;
    const pids = LIVE_PIDS.filter(p=>rows.some(r=>r[p.pid]!==undefined));
    const t0 = rows[0].t;
    const head = ["time_s", ...pids.map(p=>`${en()?p.en:p.he} (${p.unit})`)].join(",");
    const body = rows.map(r=>[((r.t-t0)/1000).toFixed(1), ...pids.map(p=>r[p.pid]===undefined?"":String(r[p.pid]).replace(/,/g,"."))].join(",")).join("\n");
    download("\ufeff"+head+"\n"+body, `autodiag-live-${new Date().toISOString().slice(0,16).replace(/[:T]/g,"-")}.csv`, "text/csv;charset=utf-8");
  }
  async function toggleLive(){
    if(liveRef.current){ liveRef.current=false; setLiveOn(false); return; }
    liveRef.current=true; setLiveOn(true);
    while(liveRef.current && scanCh.current){ await scanReadLiveOnce(); await new Promise(r=>setTimeout(r,300)); }
    liveRef.current=false; setLiveOn(false);
  }
  async function scanTerminal(){
    const c = termCmd.trim().toUpperCase(); if(!c || !scanCh.current) return;
    if(/^0?4$/.test(c)){ scanClearDTCs(); setTermCmd(""); return; }
    slog("> "+c); const r = await scanSendCmd(c,6000); slog("< "+(elmLines(r).join(" | ")||T("אין תשובה"))); setTermCmd("");
  }
  function scanToLog(){
    const all = scanCodes ? [...scanCodes.stored, ...scanCodes.pending, ...scanCodes.permanent] : [];
    const lines = [];
    if(scanVin) lines.push("VIN: "+scanVin);
    if(scanReady) lines.push(`MIL ${scanReady.mil?T("דולקת"):T("כבויה")} · ${T("בדיקות שלא הושלמו")}: ${scanReady.monitors.filter(m=>!m.done).length}`);
    if(scanCodes && scanCodes.pending.length) lines.push(`${T("ממתינים")}: ${scanCodes.pending.join(", ")}`);
    const v = vehicle && (!scanVin || !vehicle.vin || vehicle.vin===scanVin) ? vehicle : (scanVin ? { vin:scanVin } : null);
    setTab("log"); openSheet(null, all, v, lines.join("\n"));
  }

  // ─── wiring-diagram library ───
  const dgVeh = () => vehicle ? { make:vehMake(vehicle), model:vehicle.model||"", year:vehicle.year||"" } : null;
  const dgForVeh = v => v ? diagrams.filter(m=>dgMatches(m, vehMake(v), v.model, v.year)) : [];
  function refreshStore(){ storageInfo().then(setDgStore); }
  async function saveDiagram(fields, files){
    const isNew = !dgSheet.meta; const old = dgSheet.meta;
    try{
      let pages = [], thumb = "", cut = false;
      if(files.length){ setDgBusy(T("מכין דפים...")); const r = await filesToPages(files, (d,t)=>setDgBusy(T("מכין דף {d} מתוך {t}",{ d, t }))); pages = r.pages; thumb = r.thumb; cut = r.cut; }
      if(isNew && !pages.length){ toast(T("לא נמצאו דפים בקבצים שנבחרו")); return; }
      const id = isNew ? uid() : old.id; const start = isNew ? 0 : (old.pages||0);
      const room = Math.max(0, MAX_PAGES - start); if(pages.length > room){ pages = pages.slice(0, room); cut = true; }
      if(pages.length){ setDgBusy(T("שומר...")); await savePages(id, pages, start); }
      const meta = isNew ? { id, ...fields, pages:pages.length, thumb, marks:[], at:new Date().toISOString() } : { ...old, ...fields, pages:start+pages.length, thumb: old.thumb || thumb };
      setDiagrams(p => isNew ? [meta, ...p] : p.map(m=>m.id===id?meta:m));
      if(dgView && dgView.id===id) setDgView(meta);
      setDgSheet(null); toast(cut ? T("נשמרו רק {n} הדפים הראשונים",{ n:MAX_PAGES }) : T("✅ נשמר")); refreshStore();
    }catch(e){ toast(String(e&&e.message)==="no-idb" ? T("המכשיר לא מאפשר לשמור קבצים גדולים") : T("לא הצלחתי לקרוא את הקובץ. נסה PDF אחר או תמונות.")); }
    finally{ setDgBusy(""); }
  }
  async function deleteDiagram(){
    const m = dgSheet && dgSheet.meta; if(!m) return;
    await deletePages(m.id, m.pages||0); setDiagrams(p=>p.filter(x=>x.id!==m.id)); setDgSheet(null); setDgView(null); toast(T("נמחק")); refreshStore();
  }
  const setMarks = (id, marks) => { setDiagrams(p=>p.map(m=>m.id===id?{ ...m, marks }:m)); setDgView(v=>v&&v.id===id?{ ...v, marks }:v); };
  async function dgExport(){
    if(!diagrams.length) return;
    try{ setDgBusy(T("מכין קובץ...")); const b = await exportLibrary(diagrams, (d,t)=>setDgBusy(T("מכין דף {d} מתוך {t}",{ d, t })));
      const url = URL.createObjectURL(b); const a = document.createElement("a"); a.href=url; a.download=`autodiag-diagrams-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),4000);
      toast(T("✅ קובץ הגיבוי נוצר"));
    }catch(e){ toast(T("ההורדה נכשלה")); } finally{ setDgBusy(""); }
  }
  async function dgImport(e){
    const f = e.target.files?.[0]; e.target.value=""; if(!f) return;
    try{ setDgBusy(T("משחזר...")); const added = await importLibrary(f, diagrams, uid, (d,t)=>setDgBusy(T("משחזר דף {d} מתוך {t}",{ d, t })));
      setDiagrams(p=>[...added, ...p]); toast(T("נוספו {n} סכמות",{ n:added.length })); refreshStore();
    }catch(err){ toast(T("❌ הקובץ אינו גיבוי סכמות של AutoDiag Pro")); } finally{ setDgBusy(""); }
  }
  function openLib(onlyVeh){ setDgOnlyVeh(!!onlyVeh); setDgQuery(""); refreshStore(); openSub("lib"); }

  // ─── assistant glue ───
  function assistCtx(){
    const hasScan = !!(scanCodes || scanVin || scanReady || Object.keys(scanLive).length);
    return { lang:settings.lang, vehicle, current: (tab==="code" && codeResult) ? { code:codeResult } : null,
      scan: hasScan ? { codes:scanCodes, vin:scanVin, ready:scanReady, ff:scanFF, live:scanLive } : null,
      notes, workLog, diagrams };
  }
  function openAssist(){ setAssistView("chat"); setAssistOpen(true); }
  function assistAct(a){
    if(!a) return;
    const close = () => setAssistOpen(false);
    if(a.type==="code"){ close(); searchCode(a.id); }
    else if(a.type==="tree"){ close(); setTreeSel({ id:a.id, path:[TREES.find(t=>t.id===a.id).start] }); openSub("trees"); }
    else if(a.type==="circuit"){ close(); setCircOpen(a.id); openSub("circuits"); }
    else if(a.type==="sub"){ close(); if(a.id==="lib") openLib(false); else openSub(a.id); }
    else if(a.type==="lib"){ close(); openLib(true); }
    else if(a.type==="tab"){ close(); goTab(a.id); }
    else if(a.type==="log"){ close(); setLogFilter(a.id); goTab("log"); }
    else if(a.type==="plate"){ close(); goTab("home"); lookupPlate(a.id); }
    else if(a.type==="diagram"){ const m = diagrams.find(x=>x.id===a.id); if(m){ close(); setDgView(m); } }
  }
  function assistActLabel(a){
    const L2 = o => en() ? o.en : o.he;
    switch(a.type){
      case "code": return "⚠️ "+a.id;
      case "tree": { const t = TREES.find(x=>x.id===a.id); return "🧭 "+(t?L2(t.title):T("עצי אבחון")); }
      case "circuit": { const cc = CIRCUITS.find(x=>x.id===a.id); return "📘 "+(cc?(en()?cc.en.title:cc.he.title):T("סכמות טיפוסיות")); }
      case "sub": return ({ ref:"📖 "+T("מידע טכני"), calc:"🧮 "+T("מחשבונים"), convert:"🔄 "+T("ממיר ומחשבון אוהם"), sensors:"📊 "+T("חיישנים ומצבר"), diag:"🩺 "+T("מחשבון אבחון"), wires:"🧵 "+T("חיווט"), lib:"📐 "+T("הסכמות שלי"), settings:"⚙️ "+T("הגדרות") })[a.id] || T(SUB_TITLES[a.id]||"");
      case "lib": return "📐 "+T("הסכמות של הרכב");
      case "tab": return ({ scan:"🔗 "+T("סורק"), log:"📋 "+T("יומן"), home:"🏠 "+T("בית"), code:"⚠️ "+T("קוד") })[a.id] || a.id;
      case "log": return "📋 "+T("פתח ביומן");
      case "plate": return "🔎 "+T("חפש במשרד התחבורה");
      case "diagram": return "📐 "+T("פתח סכמה");
      default: return "›";
    }
  }

  // ─── derived ───
  const actualMake = make==="__custom__" ? makeCustom : make;
  const modelsList = make && make!=="__custom__" ? (CAR_MODELS[make]||[]) : [];
  const actualModel = make==="__custom__" ? modelCustom : (model==="__custom__" ? modelCustom : model);
  const obdVeh = actualMake && actualModel ? `${actualMake} ${actualModel} ${year}`.trim() : "";
  const years = Array.from({ length:35 },(_,i)=>new Date().getFullYear()-i);
  const convC = CONVERSIONS[convSel];
  const convResult = convVal!=="" ? (convC.formula ? convC.formula(parseFloat(convVal)) : parseFloat(convVal)*convC.factor) : null;
  const symptomCodes = [...new Set(selSymptoms.flatMap(id=>(SYMPTOMS.find(s=>s.id===id)||{ codes:[] }).codes))];
  const totalCodes = Object.keys(CODES_DB).length;

  if(!loaded) return <div style={{ background:S.bg, color:S.acc, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px" }}>🔧 {T("טוען...")}</div>;

  // ═══ SCREENS ═══
  const backArrow = dir==="rtl" ? "→" : "←";

  function Header(){
    if(sub){
      const fromName = sub.prev ? T(SUB_TITLES[sub.prev.id]||"") : T(TAB_NAMES[sub.from]||"בית");
      return <div style={{ position:"sticky", top:0, zIndex:50, background:S.card, borderBottom:`2px solid ${S.acc}`, padding:"8px 10px", display:"flex", alignItems:"center", gap:"8px" }}>
        <button onClick={backSub} style={{ background:"transparent", border:`1px solid ${S.bdr}`, color:S.acc, borderRadius:"10px", padding:"8px 12px", fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", minHeight:"40px", whiteSpace:"nowrap" }}>{backArrow} {fromName}</button>
        <h1 style={{ fontSize:"16px", fontWeight:800, color:S.text, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{T(SUB_TITLES[sub.id]||"")}</h1>
      </div>;
    }
    return <div style={{ position:"sticky", top:0, zIndex:50, background:S.card, borderBottom:`2px solid ${S.acc}`, padding:"8px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"8px", minWidth:0 }}>
        <img src="./icon-192.png" alt="" width="34" height="34" style={{ borderRadius:"9px" }}/>
        <div style={{ minWidth:0 }}>
          <h1 style={{ fontSize:"17px", fontWeight:800, color:S.acc, margin:0, whiteSpace:"nowrap" }}>AutoDiag Pro <span style={{ fontSize:"10px", color:S.muted, fontWeight:600 }}>v{APP_VERSION}</span></h1>
          <p style={{ fontSize:"11px", color:S.muted, margin:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{tab==="home" ? T("כלי עבודה לחשמלאי רכב") : T(TAB_NAMES[tab])}</p>
        </div>
      </div>
      <div style={{ display:"flex" }}>
        <IconBtn label={T("החלף עיצוב")} onClick={()=>{ const i=THEME_ORDER.indexOf(settings.theme); setS({ theme:THEME_ORDER[(i+1)%THEME_ORDER.length] }); }}>🎨</IconBtn>
        <IconBtn label={T("אודות")} onClick={()=>openSub("about")}>ℹ️</IconBtn>
      </div>
    </div>;
  }

  function VehicleCard({ compact }){
    const v = vehicle;
    const plateBox = <div>
      <div style={{ display:"flex", gap:"6px" }}>
        <Field value={plateIn} onChange={e=>{ setPlateIn(e.target.value); setPlateMsg(""); }} onKeyDown={e=>{ if(e.key==="Enter") lookupPlate(plateIn); }} inputMode="numeric" placeholder={T("מספר רישוי, למשל 12-345-67")} aria-label={T("מספר רישוי")} style={{ fontFamily:"monospace", fontSize:"16px", fontWeight:700, letterSpacing:"1px", direction:"ltr", textAlign:"center", background:"#FFD400", color:"#111", border:"2px solid #111" }}/>
        <Btn onClick={()=>lookupPlate(plateIn)} disabled={plateBusy}>{plateBusy?"…":"🔎 "+T("חפש")}</Btn>
      </div>
      {plateMsg && <p style={{ color:S.warn, fontSize:"12px", margin:"6px 0 0" }}>{plateMsg}</p>}
      {!v && vehicles.length>0 && <div style={{ display:"flex", flexWrap:"wrap", gap:"5px", marginTop:"8px" }}>{vehicles.slice(0,6).map(x=> <Chip key={x.plate} onClick={()=>setCurrentVehicle(x)}>{fmtPlate(x.plate)} · {vehMake(x)} {x.model}</Chip>)}</div>}
    </div>;
    if(!v) return <Card title={"🚗 "+T("רכב לפי מספר רישוי")}>{plateBox}<p style={{ color:S.muted, fontSize:"11px", margin:"8px 0 0" }}>{T("הפרטים מגיעים מהמאגר הפתוח של משרד התחבורה: דגם, שנה, קוד מנוע, נפח, VIN ותוקף רישיון.")}</p></Card>;
    const rows = vehRows(v);
    return <Card title={<span>🚗 {T("הרכב הנוכחי")}</span>} actions={<IconBtn label={T("נקה רכב נוכחי")} onClick={()=>setVehicle(null)}>✕</IconBtn>}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"8px", flexWrap:"wrap" }}>
        {v.plate && <span style={{ background:"#FFD400", color:"#111", fontFamily:"monospace", fontWeight:800, fontSize:"16px", padding:"4px 10px", borderRadius:"6px", border:"2px solid #111", direction:"ltr" }}>{fmtPlate(v.plate)}</span>}
        <span style={{ color:S.text, fontWeight:800, fontSize:"16px" }} dir="auto">{vehLabel(v)}</span>
      </div>
      {!compact && <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:"3px 12px", fontSize:"12px", marginBottom:"10px" }}>
        {rows.slice(2).map(([k,val])=> [<span key={k+"k"} style={{ color:S.muted }}>{k}</span>, <span key={k+"v"} style={{ color:S.sub, fontWeight:600, wordBreak:"break-all" }} dir="auto">{val}</span>])}
      </div>}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
        <Btn kind="ghost" onClick={()=>vehToObd(v)}>🔌 {T("מיקום OBD")}</Btn>
        <Btn kind="ghost" onClick={()=>openLib(true)}>📐 {T("סכמות חשמל")}{dgForVeh(v).length?` (${dgForVeh(v).length})`:""}</Btn>
        <Btn kind="ghost" onClick={()=>{ setTab("log"); openSheet(null,[],v); }}>📋 {T("רשומת יומן")}</Btn>
        <Btn kind="ghost" onClick={()=>goTab("scan")}>🔗 {T("סרוק את הרכב")}</Btn>
      </div>
      {!compact && vehMake(v) && <details style={{ marginTop:"10px" }}><summary style={{ color:S.acc, fontSize:"13px", fontWeight:700, cursor:"pointer" }}>📝 {T("ידע על הדגם")} — {vehMake(v)} {v.model}{(notes[`m_${vehMake(v)}_${v.model||""}`]||[]).length?` (${notes[`m_${vehMake(v)}_${v.model||""}`].length})`:""}</summary><p style={{ color:S.muted, fontSize:"12px", margin:"6px 0" }}>{T("טיפים שצברת על הדגם הזה — מקום ההארקה, איפה המחשבים, תקלות שחוזרות. יופיע בכל רכב מאותו דגם.")}</p><NotesPanel sKey={`m_${vehMake(v)}_${v.model||""}`} notes={notes} setNotes={setNotes} askConfirm={askConfirm} onOpenImg={setImgView}/></details>}
      <details style={{ marginTop:"10px" }}><summary style={{ color:S.muted, fontSize:"12px", cursor:"pointer" }}>{T("רכב אחר")}</summary><div style={{ marginTop:"8px" }}>{plateBox}</div></details>
    </Card>;
  }

  function Home(){
    const q = homeQuery.trim(); const ql = q.toLowerCase();
    let res = null;
    if(q.length>1){
      const codes = Object.keys(CODES_DB).filter(c=>c.toLowerCase().includes(ql)||CODES_DB[c].he.includes(q)||CODES_DB[c].en.toLowerCase().includes(ql)).slice(0,8);
      const logs = workLog.filter(w=>(w.plate||"").toLowerCase().includes(ql)||(w.desc||"").toLowerCase().includes(ql)).slice(0,6);
      const nts = []; Object.entries(notes).forEach(([k,arr])=>arr.forEach(n=>{ if((n.text||"").toLowerCase().includes(ql)) nts.push({ k, n }); }));
      res = { codes, logs, nts:nts.slice(0,6) };
    }
    const tiles = [
      ["⚠️","קוד תקלה",()=>goTab("code")],["🔗","סורק OBD",()=>goTab("scan")],["📋","יומן עבודה",()=>goTab("log")],
      ["🤖","העוזר",openAssist],
      ["🔌","מיקום שקע OBD",()=>openSub("obd")],["🩺","מחשבון אבחון",()=>openSub("diag")],["📊","חיישנים ומצבר",()=>openSub("sensors")],
      ["🧵","חיווט",()=>openSub("wires")],["📐","סכמות חשמל",()=>openLib(false)],["📘","סכמות טיפוסיות",()=>openSub("circuits")],
      ["🧭","עצי אבחון",()=>{ setTreeSel(null); openSub("trees"); }],["📖","מידע טכני",()=>openSub("ref")],["🧮","מחשבונים",()=>openSub("calc")],
      ["🔄","ממיר ואוהם",()=>openSub("convert")],["📚","מאגר קודים",()=>openSub("all")],
    ];
    const recent = history.slice().reverse().slice(0,8).map(h=>h.code);
    return <>
      <Card>
        <div style={{ display:"flex", gap:"6px" }}>
          <Field value={homeQuery} onChange={e=>setHomeQuery(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&isCodeLike(homeQuery)){ searchCode(homeQuery); setHomeQuery(""); } }} placeholder={T("חפש קוד, תקלה, רכב או הערה...")} aria-label={T("חיפוש")}/>
          {isCodeLike(homeQuery) && <Btn onClick={()=>{ searchCode(homeQuery); setHomeQuery(""); }}>{T("חפש")}</Btn>}
        </div>
        {res && <div style={{ marginTop:"8px" }}>
          {res.codes.map(c=> <button key={c} onClick={()=>{ searchCode(c); setHomeQuery(""); }} style={rowBtn()}><span style={{ color:S.acc, fontWeight:700, fontFamily:"monospace", minWidth:"58px" }}>{c}</span><span style={{ color:S.sub, fontSize:"12px", flex:1 }}>{codeTitle(c)}</span></button>)}
          {res.logs.map(w=> <button key={w.id} onClick={()=>{ setHomeQuery(""); setTab("log"); openSheet(w); }} style={rowBtn()}><span>📋</span><span style={{ color:S.text, fontWeight:700 }}>{w.plate}</span><span style={{ color:S.muted, fontSize:"12px", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{w.desc}</span></button>)}
          {res.nts.map(({ k,n })=> <button key={n.id} onClick={()=>{ setHomeQuery(""); if(k.startsWith("c_")) searchCode(k.slice(2)); }} style={rowBtn()}><span>📝</span><span style={{ color:S.acc, fontFamily:"monospace" }}>{k.replace(/^c_|^obd_|^m_/,"").replace(/_/g," ")}</span><span style={{ color:S.sub, fontSize:"12px", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.text}</span></button>)}
          {!res.codes.length&&!res.logs.length&&!res.nts.length && <p style={{ color:S.muted, fontSize:"12px", textAlign:"center", padding:"8px" }}>{T("לא נמצאו תוצאות")}</p>}
        </div>}
      </Card>
      {VehicleCard({})}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px", marginBottom:"10px" }}>
        {tiles.map(([ic,lb,fn])=> <button key={lb} onClick={fn} style={{ background:S.card, border:`1px solid ${S.bdr}`, borderRadius:"14px", padding:"14px 6px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:"6px", fontFamily:"inherit", minHeight:"88px" }}>
          <span style={{ fontSize:"26px" }}>{ic}</span><span style={{ color:S.text, fontSize:"12px", fontWeight:700, lineHeight:1.25, textAlign:"center" }}>{T(lb)}</span>
        </button>)}
      </div>
      {favs.length>0 && <Card title={"⭐ "+T("מועדפים")}><div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>{favs.map(f=> <Chip key={f} mono active onClick={()=>searchCode(f)}>{f}</Chip>)}</div></Card>}
      {recent.length>0 && <Card title={"🕐 "+T("חיפושים אחרונים")}><div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>{recent.map(f=> <Chip key={f} mono onClick={()=>searchCode(f)}>{f}</Chip>)}</div></Card>}
    </>;
  }
  function rowBtn(){ return { display:"flex", alignItems:"center", gap:"8px", width:"100%", padding:"9px 6px", background:"transparent", border:"none", borderBottom:`1px solid ${S.bdr}`, cursor:"pointer", fontFamily:"inherit", textAlign:"start", minHeight:"42px" }; }

  function CodeTab(){
    const ci = codeResult ? codeInfo(codeResult) : null;
    return <>
      <Card title={"🔍 "+T("חיפוש קוד תקלה")} actions={<IconBtn label={T("היסטוריה")} onClick={()=>setShowHist(true)}>🕐</IconBtn>}>
        <div style={{ display:"flex", gap:"6px" }}>
          <Field value={codeInput} onChange={e=>setCodeInput(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&searchCode()} placeholder="P0107" maxLength={12} aria-label={T("קוד תקלה")} style={{ color:S.acc, fontSize:"19px", fontWeight:700, fontFamily:"monospace", letterSpacing:"2px", textAlign:"center", direction:"ltr" }}/>
          <Btn onClick={()=>searchCode()}>{T("חפש")}</Btn>
        </div>
        <div style={{ marginTop:"8px", display:"flex", flexWrap:"wrap", gap:"5px" }}>{["P0107","P0300","P0171","P0420","P0335","U0100","C0035","B1234"].map(c=> <Chip key={c} mono active={favs.includes(c)} onClick={()=>searchCode(c)}>{c}</Chip>)}</div>
      </Card>
      {favs.length>0 && <Card title={"⭐ "+T("מועדפים")}><div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>{favs.map(f=> <Chip key={f} mono active onClick={()=>searchCode(f)}>{f}</Chip>)}</div></Card>}
      {ci && <div ref={rRef}>
        <Card title={<span style={{ fontFamily:"monospace", fontSize:"18px" }}>{ci.code}</span>} actions={<>
          <IconBtn label={T("מועדף")} onClick={()=>toggleFav(ci.code)} color={S.acc}>{favs.includes(ci.code)?"⭐":"☆"}</IconBtn>
          <IconBtn label={T("שתף")} onClick={()=>shareText(`${T("קוד")} ${ci.code}`,`${ci.title}\n${ci.desc}\n\n${T("גורמים")}:\n• ${ci.causes.join("\n• ")}`)}>📤</IconBtn>
          <IconBtn label={T("הדפס")} onClick={()=>doPrint(`${T("קוד")} ${ci.code}`,`<h2>${esc(ci.code)} — ${esc(ci.title)}</h2>${ci.alt?`<p><em>${esc(ci.alt)}</em></p>`:""}<p>${esc(ci.desc)}</p><h3>${esc(T("גורמים"))}</h3><ul>${ci.causes.map(c=>`<li>${esc(c)}</li>`).join("")}</ul><h3>${esc(T("שלבי בדיקה"))}</h3><ol>${ci.steps.map(s=>`<li>${esc(s)}</li>`).join("")}</ol><h3>${esc(T("מיקום"))}</h3><p>${esc(ci.location)}</p><p><strong>${esc(T("חומרה"))}: ${esc(sevLabel(ci.sev))} · ${esc(T("נסיעה"))}: ${esc(ci.safe)}</strong></p>`, notes[`c_${ci.code}`]||[])}>🖨️</IconBtn>
        </>}>
          <h2 style={{ color:S.text, fontSize:"16px", fontWeight:700, margin:"0 0 3px" }}>{ci.title}</h2>
          {ci.alt && <p style={{ color:S.muted, fontSize:"12px", fontStyle:"italic", margin:"0 0 8px" }}>{ci.alt}</p>}
          {ci.missingEn && <p style={{ color:S.warn, fontSize:"11px", margin:"0 0 8px" }}>{T("פרטי הקוד הזה עדיין בעברית בלבד.")}</p>}
          <div style={{ display:"flex", gap:"6px", marginBottom:"10px", flexWrap:"wrap" }}><SevBadge level={ci.sev}/><span style={{ background:ci.safeOk?`${S.green}22`:`${S.red}22`, color:ci.safeOk?S.green:S.red, padding:"3px 9px", borderRadius:"6px", fontSize:"11px", fontWeight:700 }}>{ci.safeOk?"✓":"✕"} {T("נסיעה")}: {ci.safe}</span></div>
          <div style={{ background:S.inner, borderRadius:"10px", padding:"10px", marginBottom:"10px" }}><p style={{ color:S.sub, fontSize:"13px", lineHeight:1.6, margin:0 }}>{ci.desc}</p></div>
          <h3 style={h3()}>🔍 {T("גורמים")}</h3>{ci.causes.map((c,i)=> <div key={i} style={li()}><span style={{ color:S.acc }}>•</span><span>{c}</span></div>)}
          <h3 style={h3()}>🛠️ {T("שלבי בדיקה")}</h3>{ci.steps.map((s,i)=> <div key={i} style={li()}><span style={{ color:S.acc, fontWeight:700, minWidth:"18px" }}>{i+1}.</span><span>{s}</span></div>)}
          <h3 style={h3()}>📍 {T("מיקום")}</h3><div style={{ background:S.inner, borderRadius:"10px", padding:"10px" }}><p style={{ color:S.sub, fontSize:"13px", lineHeight:1.6, margin:0 }}>{ci.location}</p></div>
          {circuitFor(ci.code) && (()=>{ const cc = CIRCUITS.find(x=>x.id===circuitFor(ci.code)); return cc ? <div style={{ marginTop:"10px" }}><Btn kind="blue" onClick={()=>{ setCircOpen(cc.id); openSub("circuits"); }} style={{ width:"100%" }}>📘 {T("סכמה טיפוסית")}: {en()?cc.en.title:cc.he.title}</Btn></div> : null; })()}
          {relatedCodes(ci.code).length>0 && <><h3 style={h3()}>🔗 {T("קודים קשורים")}</h3><div style={{ display:"flex", flexWrap:"wrap", gap:"5px" }}>{relatedCodes(ci.code).map(r=> <button key={r} onClick={()=>searchCode(r)} title={codeTitle(r)} style={{ background:S.inner, border:`1px solid ${S.bdr}`, borderRadius:"8px", padding:"5px 8px", cursor:"pointer", fontFamily:"inherit", textAlign:"start", maxWidth:"100%" }}><span style={{ color:S.acc, fontFamily:"monospace", fontWeight:700, fontSize:"12px" }}>{r}</span> <span style={{ color:S.muted, fontSize:"11px" }}>{codeTitle(r).replace(/^.*? — /,"").slice(0,28)}</span></button>)}</div></>}
          <div style={{ marginTop:"10px", display:"flex", gap:"8px" }}><Btn kind="ghost" onClick={()=>{ setTab("log"); openSheet(null,[ci.code]); }} style={{ flex:1 }}>📋 {T("רשומת יומן")}</Btn><Btn kind="blue" onClick={openAssist} style={{ flex:1 }}>🤖 {T("שאל את העוזר")}</Btn></div>
        </Card>
        <Card title={"🔗 "+T("קישורים")}><div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}><YT q={`${ci.code} diagnosis fix`} l={T("תיקון {c}",{ c:ci.code })}/><YT q={`${ci.code} explained`} l={T("הסבר")}/><GG q={`${ci.code} sensor location`} l={T("תמונות")} img/><GG q={`${ci.code} repair guide`} l={T("מדריך")}/></div></Card>
        <NotesPanel sKey={`c_${ci.code}`} notes={notes} setNotes={setNotes} askConfirm={askConfirm} onOpenImg={setImgView}/>
      </div>}
      {notFound && <div ref={rRef}>
        <Card title={<span><span style={{ fontFamily:"monospace" }}>{notFound}</span> — {T("לא במאגר")}</span>}>
          <p style={{ color:S.sub, fontSize:"13px", marginBottom:"10px" }}>{T("הקוד לא נמצא ב-{n} הקודים שבמאגר. אפשר לחפש ברשת, ולרשום למטה מה עשית:",{ n:totalCodes })}</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}><YT q={`${notFound} OBD2 diagnosis fix`} l={T("חפש {c}",{ c:notFound })}/><GG q={`${notFound} OBD2 code meaning`} l="Google"/><GG q={`${notFound} sensor location`} l={T("תמונות")} img/></div>
        </Card>
        <NotesPanel sKey={`c_${notFound}`} notes={notes} setNotes={setNotes} askConfirm={askConfirm} onOpenImg={setImgView}/>
      </div>}
    </>;
  }
  const h3 = () => ({ color:S.acc, fontSize:"13px", fontWeight:700, margin:"12px 0 6px" });
  const li = () => ({ display:"flex", gap:"7px", marginBottom:"4px", fontSize:"13px", color:S.sub, lineHeight:1.5 });

  function ScanTab(){
    const busy = scanStatus==="searching"||scanStatus==="connecting";
    const conn = scanStatus==="connected";
    const isDemo = !!(scanCh.current && scanCh.current.demo);
    const RD_NAMES = { misfire:"פספוסי הצתה", fuel:"מערכת דלק", components:"רכיבים", catalyst:"קטליזטור", heatedCat:"קטליזטור מחומם", evap:"EVAP", secAir:"אוויר משני", ac:"מזגן", o2:"חיישני חמצן", o2Heater:"חימום חיישני חמצן", egr:"EGR / VVT", nmhcCat:"קטליזטור NMHC", noxScr:"NOx / SCR", boost:"לחץ טורבו", egs:"חיישני פליטה", pmFilter:"מסנן חלקיקים", egrVvt:"EGR / VVT" };
    const codeRow = (c,color) => <button key={c} onClick={()=>searchCode(c)} style={{ ...rowBtn(), border:`1px solid ${color}`, borderRadius:"10px", marginBottom:"5px" }}><span style={{ color, fontWeight:700, fontFamily:"monospace", minWidth:"58px" }}>{c}</span><span style={{ color:S.sub, fontSize:"12px" }}>{codeTitle(c)||T("לא במאגר")}</span></button>;
    const allCodes = scanCodes ? scanCodes.stored.length+scanCodes.pending.length+scanCodes.permanent.length : 0;
    return <>
      <Card title={"🔗 "+T("חיבור לסורק ELM327")} actions={conn && <span style={{ color:isDemo?S.warn:S.green, fontWeight:700, fontSize:"12px", padding:"4px 8px", border:`1px solid ${isDemo?S.warn:S.green}`, borderRadius:"8px" }}>● {isDemo?T("הדגמה"):T("מחובר")}</span>}>
        {!conn && <p style={{ color:S.muted, fontSize:"12px", margin:"0 0 10px" }}>{T("חבר מתאם ELM327 BLE לשקע OBD, הדלק הצתה ולחץ התחבר. עובד ב-Chrome באנדרואיד ובמחשב.")}</p>}
        {scanStatus==="unsupported" && <div style={{ background:`${S.red}18`, border:`1px solid ${S.red}`, borderRadius:"10px", padding:"9px", marginBottom:"10px" }}><p style={{ color:S.red, fontSize:"12px", margin:0 }}>⚠️ {T("הדפדפן לא תומך ב-Web Bluetooth. השתמש ב-Chrome באנדרואיד או במחשב.")}</p></div>}
        {!conn
          ? <div style={{ display:"flex", gap:"8px" }}><Btn kind="green" disabled={busy} onClick={scanConnect} style={{ flex:2 }}>{scanStatus==="searching"?"🔍 "+T("מחפש..."):scanStatus==="connecting"?"🔄 "+T("מתחבר..."):"🔗 "+T("התחבר לסורק")}</Btn><Btn kind="ghost" disabled={busy} onClick={scanDemo} style={{ flex:1 }}>🎮 {T("הדגמה")}</Btn></div>
          : <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}><Btn onClick={scanQuickRead} disabled={!!scanBusy} style={{ flex:2 }}>{scanBusy?"⏳ "+T("קורא..."):"🔍 "+T("סריקה מלאה")}</Btn><Btn kind="danger" onClick={scanDisconnect} style={{ flex:1 }}>🔌 {T("נתק")}</Btn></div>}
        {conn && (scanVin || scanLive.batt || scanReady) && <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:"3px 12px", fontSize:"12px", marginTop:"10px" }}>
          {scanVin && [<span key="vk" style={{ color:S.muted }}>VIN</span>, <span key="vv" style={{ color:S.text, fontFamily:"monospace", fontWeight:700, direction:"ltr", textAlign:"start" }}>{scanVin}</span>]}
          {scanLive.batt && [<span key="bk" style={{ color:S.muted }}>{T("מצבר")}</span>, <span key="bv" style={{ color:S.text, fontWeight:700 }}>{scanLive.batt} V</span>]}
          {scanReady && [<span key="mk" style={{ color:S.muted }}>{T("נורית מנוע")}</span>, <span key="mv" style={{ color:scanReady.mil?S.red:S.green, fontWeight:700 }}>{scanReady.mil?"🔴 "+T("דולקת"):"🟢 "+T("כבויה")} · {T("{n} קודים שמורים",{ n:scanReady.dtcCount })}</span>]}
          <span style={{ color:S.muted }}>{T("פרוטוקול")}</span><span style={{ color:S.sub }}>{protoName(scanProto.current)}</span>
        </div>}
        {conn && scanVin && vehicle && vehicle.vin && vehicle.vin!==scanVin && <p style={{ color:S.warn, fontSize:"12px", margin:"8px 0 0" }}>⚠️ {T("ה-VIN שנקרא שונה מה-VIN של הרכב הנוכחי ({p}). ודא שזה הרכב הנכון.",{ p:fmtPlate(vehicle.plate) })}</p>}
      </Card>
      {conn && <>
        <Card title={"📡 "+T("קודי תקלה")+(scanCodes?` (${allCodes})`:"")} actions={<IconBtn label={T("קרא קודים")} onClick={scanReadDTCs}>🔄</IconBtn>}>
          {!scanCodes ? <p style={{ color:S.muted, fontSize:"12px" }}>{scanBusy==="codes"?T("קורא קודים..."):T("עוד לא נקראו קודים")}</p> : allCodes===0 ? <p style={{ color:S.green, fontWeight:700, fontSize:"13px" }}>✅ {T("אין קודי תקלה!")}</p> : <>
            {scanCodes.stored.length>0 && <><div style={{ color:S.red, fontSize:"12px", fontWeight:700, margin:"0 0 5px" }}>{T("שמורים (פעילים)")}</div>{scanCodes.stored.map(c=>codeRow(c,S.red))}</>}
            {scanCodes.pending.length>0 && <><div style={{ color:S.warn, fontSize:"12px", fontWeight:700, margin:"8px 0 5px" }}>{T("ממתינים — זוהו פעם אחת, עוד לא הדליקו נורית")}</div>{scanCodes.pending.map(c=>codeRow(c,S.warn))}</>}
            {scanCodes.permanent.length>0 && <><div style={{ color:S.blue, fontSize:"12px", fontWeight:700, margin:"8px 0 5px" }}>{T("קבועים — יימחקו לבד אחרי שהמחשב יאשר את התיקון")}</div>{scanCodes.permanent.map(c=>codeRow(c,S.blue))}</>}
          </>}
          <div style={{ display:"flex", gap:"8px", marginTop:"8px" }}>
            <Btn kind="ghost" onClick={scanToLog} style={{ flex:1 }}>📋 {T("שמור ביומן")}</Btn>
            <Btn kind="danger" onClick={scanClearDTCs} style={{ flex:1 }}>🗑️ {T("מחק קודים")}</Btn>
          </div>
        </Card>
        {scanFF && <Card title={"❄️ Freeze Frame"+(scanFF.code?` — ${scanFF.code}`:"")}>
          <p style={{ color:S.muted, fontSize:"12px", margin:"0 0 8px" }}>{T("מצב המנוע ברגע שהתקלה נשמרה")}</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"6px" }}>{LIVE_PIDS.filter(p=>scanFF.vals[p.pid]!==undefined).map(p=> <div key={p.pid} style={{ background:S.inner, borderRadius:"10px", padding:"7px", textAlign:"center" }}><p style={{ color:S.muted, fontSize:"11px", margin:0 }}>{en()?p.en:p.he}</p><span dir="ltr" style={{ color:S.acc, fontSize:"16px", fontWeight:800, fontFamily:"monospace", unicodeBidi:"isolate" }}>{scanFF.vals[p.pid]}</span><p style={{ color:S.muted, fontSize:"10px", margin:0 }}>{p.unit}</p></div>)}</div>
        </Card>}
        {scanReady && <Card title={"✅ "+T("מוכנות בדיקות (Readiness)")}>
          <p style={{ color:S.muted, fontSize:"12px", margin:"0 0 8px" }}>{T("בדיקות שהמחשב מריץ בעצמו בנסיעה. אחרי מחיקת קודים הן מתאפסות ומשלימות אחרי נסיעה של 50–100 ק\"מ.")}</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>{scanReady.monitors.map(m=> <span key={m.key} style={{ padding:"5px 9px", borderRadius:"8px", fontSize:"12px", fontWeight:600, background:m.done?`${S.green}18`:`${S.warn}18`, color:m.done?S.green:S.warn, border:`1px solid ${m.done?S.green:S.warn}` }}>{m.done?"✓":"…"} {T(RD_NAMES[m.key]||m.key)}</span>)}</div>
        </Card>}
        <Card title={"📊 "+T("נתונים בזמן אמת")} actions={recOn ? <span style={{ color:S.red, fontSize:"12px", fontWeight:700 }}>● {T("מקליט · {n}",{ n:recRows.current.length })}</span> : null}>
          <div style={{ display:"flex", gap:"8px", marginBottom:"10px", flexWrap:"wrap" }}>
            <Btn kind={liveOn?"danger":"blue"} onClick={toggleLive} style={{ flex:2 }}>{liveOn?"⏸️ "+T("עצור"):"▶️ "+T("הפעל קריאה רציפה")}</Btn>
            {!liveOn && <Btn kind="ghost" onClick={scanReadLiveOnce} style={{ flex:1 }}>🔄 {T("פעם אחת")}</Btn>}
            <Btn kind={recOn?"danger":"ghost"} onClick={recToggle} style={{ flex:1 }}>{recOn?"⏹ "+T("עצור הקלטה"):"⏺ "+T("הקלט")}</Btn>
            {!recOn && recRows.current.length>0 && <Btn kind="ghost" onClick={recCsv} style={{ flex:1 }}>📥 CSV ({recRows.current.length})</Btn>}
          </div>
          {liveSel && (()=>{ const p = LIVE_PIDS.find(x=>x.pid===liveSel); const arr = liveHist.current[liveSel] || []; return <div style={{ background:S.inner, borderRadius:"12px", padding:"10px", marginBottom:"10px", border:`1px solid ${S.acc}` }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}><span style={{ color:S.acc, fontWeight:800, fontSize:"14px" }}>{p?(en()?p.en:p.he):liveSel} <span dir="ltr" style={{ color:S.text, unicodeBidi:"isolate" }}>{scanLive[liveSel]||"—"} {p&&p.unit}</span></span><IconBtn label={T("סגור גרף")} onClick={()=>setLiveSel("")}>✕</IconBtn></div>
            <LiveChart data={arr} big/>
            {arr.length>1 && <div style={{ display:"flex", justifyContent:"space-between", color:S.muted, fontSize:"12px" }} dir="ltr"><span>min {Math.min(...arr).toFixed(1)}</span><span>avg {(arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1)}</span><span>max {Math.max(...arr).toFixed(1)}</span></div>}
          </div>; })()}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"6px" }}>
            {livePids().map(p=> <button key={p.pid} onClick={()=>setLiveSel(liveSel===p.pid?"":p.pid)} style={{ background:S.inner, borderRadius:"10px", padding:"8px 4px 4px", textAlign:"center", border:`1px solid ${liveSel===p.pid?S.acc:"transparent"}`, cursor:"pointer", fontFamily:"inherit" }}><p style={{ color:S.muted, fontSize:"11px", margin:"0 0 2px" }}>{en()?p.en:p.he}</p><span dir="ltr" style={{ color:S.acc, fontSize:"17px", fontWeight:800, fontFamily:"monospace", unicodeBidi:"isolate" }}>{scanLive[p.pid]||"—"}</span><p style={{ color:S.muted, fontSize:"10px", margin:"2px 0 0" }}>{p.unit}</p><LiveChart data={liveHist.current[p.pid]}/></button>)}
          </div>
          <p style={{ color:S.muted, fontSize:"11px", margin:"8px 0 0" }}>{T("לחץ על נתון כדי לראות גרף גדול. ההקלטה שומרת את כל הנתונים לקובץ CSV שנפתח באקסל.")}</p>
        </Card>
      </>}
      <Card title={"📋 "+T("יומן סורק")} actions={scanLog.length>0&&<IconBtn label={T("נקה")} onClick={()=>setScanLog([])}>🧹</IconBtn>}>
        {scanLog.length===0 ? <p style={{ color:S.muted, fontSize:"12px", textAlign:"center" }}>{T("עדיין לא התחברת")}</p> : <div style={{ maxHeight:"220px", overflowY:"auto" }}>{scanLog.map((l,i)=> <p key={i} dir="auto" style={{ color:S.sub, fontSize:"12px", margin:"3px 0", borderBottom:`1px solid ${S.bdr}`, paddingBottom:"3px", fontFamily:"monospace", wordBreak:"break-word" }}>{l}</p>)}</div>}
        {conn && <div style={{ display:"flex", gap:"6px", marginTop:"8px" }}><Field value={termCmd} onChange={e=>setTermCmd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&scanTerminal()} placeholder={T("פקודה ידנית (למשל ATRV או 010C)")} aria-label={T("פקודה ידנית")} style={{ fontFamily:"monospace", direction:"ltr" }}/><Btn kind="ghost" onClick={scanTerminal}>{T("שלח")}</Btn></div>}
      </Card>
      <Card title={"💡 "+T("מדריך")}><div style={{ fontSize:"13px", color:S.sub, lineHeight:1.7 }}>
        <p>1. {T("קנה מתאם ELM327 BLE (למשל Vgate iCar Pro BT 4.0)")}</p><p>2. {T("חבר לשקע OBD-II ברכב והדלק הצתה")}</p><p>3. {T("הפעל Bluetooth ומיקום בטלפון")}</p><p>4. {T("לחץ \"התחבר\" ובחר את המתאם (למשל IOS-Vlink)")}</p>
        <p style={{ color:S.warn }}>⚠️ {T("דרוש מתאם BLE — מתאם Bluetooth קלאסי (BT 2.0/3.0) או WiFi לא יתחבר מהדפדפן.")}</p>
        <p>🎮 {T("רוצה לראות איך זה נראה בלי רכב? לחץ \"הדגמה\".")}</p>
      </div></Card>
    </>;
  }

  function LogTab(){
    const ql = logFilter.trim().toLowerCase();
    const list = ql ? workLog.filter(w=>(w.plate||"").toLowerCase().includes(ql)||(w.desc||"").toLowerCase().includes(ql)||(w.codes||[]).join(" ").toLowerCase().includes(ql)) : workLog;
    const sumCost = list.reduce((a,w)=>a+(parseFloat(w.cost)||0),0);
    return <>
      <Btn onClick={()=>openSheet(null)} style={{ width:"100%", marginBottom:"10px", fontSize:"15px" }}>＋ {T("רכב חדש ביומן")}</Btn>
      {workLog.length>0 && <Card>
        <Field value={logFilter} onChange={e=>setLogFilter(e.target.value)} placeholder={T("סנן לפי רכב, תיאור או קוד...")} aria-label={T("סינון")}/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"8px", flexWrap:"wrap", gap:"6px" }}>
          <span style={{ color:S.muted, fontSize:"12px" }}>{T("{n} רשומות",{ n:list.length })}{sumCost>0?` · 💰 ${sumCost.toLocaleString()} ₪`:""}</span>
          <div style={{ display:"flex" }}><IconBtn label={T("הדפס")} onClick={()=>logPrint(list)}>🖨️</IconBtn><IconBtn label={T("ייצוא לאקסל (CSV)")} onClick={logCsv}>📊</IconBtn></div>
        </div>
      </Card>}
      {list.map(w=> <div key={w.id} {...longPress(()=>openSheet(w))} style={{ background:S.card, borderRadius:"14px", padding:"12px", marginBottom:"8px", border:`1px solid ${S.bdr}`, userSelect:"none" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"6px" }}>
          <div style={{ minWidth:0 }}><div style={{ color:S.acc, fontWeight:800, fontSize:"16px" }} dir="auto">{w.plate}</div>{w.veh && <div style={{ color:S.sub, fontSize:"12px", fontWeight:600 }} dir="auto">🚗 {vehLabel(w.veh)}</div>}<div style={{ color:S.muted, fontSize:"11px" }}>{fmtDate(w.at,w.ts)}</div></div>
          <div style={{ display:"flex", flexShrink:0 }}>
            <IconBtn label={T("דוח ללקוח")} onClick={()=>customerReport(w)} color={S.blue}>📄</IconBtn>
            <IconBtn label={T("שתף")} onClick={()=>shareWhatsApp(`${T("יומן")}: ${w.plate}`, reportText(w))}>📤</IconBtn>
            <IconBtn label={T("עריכה")} onClick={()=>openSheet(w)} color={S.acc}>✏️</IconBtn>
          </div>
        </div>
        {w.desc && <p style={{ color:S.text, fontSize:"13px", margin:"6px 0 0", lineHeight:1.5, whiteSpace:"pre-wrap" }}>{w.desc}</p>}
        {(w.cost||w.hours) && <div style={{ display:"flex", gap:"12px", marginTop:"6px" }}>{w.cost&&<span style={{ color:S.green, fontSize:"12px", fontWeight:700 }}>💰 {w.cost} ₪</span>}{w.hours&&<span style={{ color:S.blue, fontSize:"12px", fontWeight:700 }}>⏱️ {w.hours} {T("שעות")}</span>}</div>}
        {w.codes&&w.codes.length>0 && <div style={{ display:"flex", gap:"4px", marginTop:"6px", flexWrap:"wrap" }}>{w.codes.map(c=> <span key={c} onClick={()=>searchCode(c)} style={{ background:`${S.acc}22`, color:S.acc, padding:"2px 8px", borderRadius:"6px", fontSize:"11px", fontFamily:"monospace", cursor:"pointer" }}>{c}</span>)}</div>}
        <Thumbs images={w.images} onOpen={setImgView} size={56}/>
      </div>)}
      {workLog.length===0 && <Card><p style={{ color:S.muted, fontSize:"13px", textAlign:"center", padding:"18px" }}>{T("עדיין אין רכבים ביומן. הוסף את הרכב הראשון!")}</p></Card>}
      {workLog.length>0 && <p style={{ color:S.muted, fontSize:"11px", textAlign:"center" }}>{T("טיפ: לחיצה ארוכה על רשומה פותחת עריכה")}</p>}
    </>;
  }

  function MoreTab(){
    const items = [
      ["🔌","מיקום שקע OBD",()=>openSub("obd")],["🩺","מחשבון אבחון",()=>openSub("diag")],["📊","חיישנים ומצבר",()=>openSub("sensors")],
      ["🧵","חיווט",()=>openSub("wires")],["📐","סכמות חשמל",()=>openLib(false)],["📘","סכמות טיפוסיות",()=>openSub("circuits")],
      ["🧭","עצי אבחון",()=>{ setTreeSel(null); openSub("trees"); }],["📖","מידע טכני",()=>openSub("ref")],["🧮","מחשבונים",()=>openSub("calc")],
      ["🔄","ממיר ומחשבון אוהם",()=>openSub("convert")],["📚","מאגר קודים",()=>openSub("all")],
      ["⚙️","הגדרות",()=>openSub("settings")],["💾","גיבוי לקובץ",doExport],["📂","שחזור מגיבוי",()=>importRef.current?.click()],
      ["📖","מדריך פתיחה",()=>setGuideStep(0)],["ℹ️","אודות",()=>openSub("about")],["🔒","מדיניות פרטיות",()=>openExt("./privacy_policy.html")],
    ];
    return <Card>{items.map(([ic,lb,fn])=> <button key={lb} onClick={fn} style={{ ...rowBtn(), padding:"13px 6px", minHeight:"50px" }}><span style={{ fontSize:"20px", width:"28px", textAlign:"center" }}>{ic}</span><span style={{ color:S.text, fontSize:"14px", fontWeight:600, flex:1 }}>{T(lb)}</span><span style={{ color:S.muted }}>{dir==="rtl"?"‹":"›"}</span></button>)}</Card>;
  }

  function ObdScreen(){
    return <>
      <Card title={"📍 "+T("מצא שקע OBD-II")}>
        <div style={{ display:"flex", flexDirection:"column", gap:"7px" }}>
          <Select label={T("יצרן")} value={make} onChange={e=>{ setMake(e.target.value); setModel(""); setModelCustom(""); setMakeCustom(""); }}><option value="">{T("בחר יצרן...")}</option>{CAR_MAKES.map(m=> <option key={m} value={m}>{m}</option>)}<option value="__custom__">✏️ {T("הזן ידנית...")}</option></Select>
          {make==="__custom__" && <Field value={makeCustom} onChange={e=>setMakeCustom(e.target.value)} placeholder={T("שם היצרן...")}/>}
          {make && make!=="__custom__" && <Select label={T("דגם")} value={model} onChange={e=>setModel(e.target.value)}><option value="">{T("בחר דגם...")}</option>{modelsList.map(m=> <option key={m} value={m}>{m}</option>)}<option value="__custom__">✏️ {T("הזן ידנית...")}</option></Select>}
          {((make==="__custom__"&&makeCustom)||(make&&make!=="__custom__"&&model==="__custom__")) && <Field value={modelCustom} onChange={e=>setModelCustom(e.target.value)} placeholder={T("שם הדגם...")}/>}
          <Select label={T("שנה")} value={year} onChange={e=>setYear(e.target.value)}><option value="">{T("שנה (אופציונלי)")}</option>{years.map(y=> <option key={y} value={y}>{y}</option>)}</Select>
        </div>
      </Card>
      {obdVeh && <>
        <Card title={<span dir="auto">🔍 {obdVeh}</span>}>
          <p style={{ color:S.sub, fontSize:"13px", lineHeight:1.6, marginBottom:"10px" }}>📍 {T("ברוב הרכבים שקע ה-OBD מתחת ללוח המחוונים בצד הנהג, בגובה הברכיים. לפעמים הוא מוסתר מאחורי כיסוי.")}</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}><GG q={`${obdVeh} OBD2 port location`} l={T("תמונות")} img/><YT q={`${obdVeh} OBD2 port location`} l={T("סרטון")}/><YT q={`${obdVeh} diagnostic port`} l={T("חיפוש נוסף")}/></div>
        </Card>
        <NotesPanel sKey={`obd_${obdVeh}`} notes={notes} setNotes={setNotes} askConfirm={askConfirm} onOpenImg={setImgView}/>
      </>}
      <Card title={"💡 "+T("טיפים")}><div style={{ fontSize:"13px", color:S.sub, lineHeight:1.7 }}>
        <p>1. {T("מתחת ללוח, צד נהג, גובה ברכיים")}</p><p>2. {T("לפעמים מאחורי כיסוי פלסטיק או מגש")}</p><p>3. {T("ביפניים — ליד קופסת הנתיכים. באירופאים — ליד הקונסולה")}</p><p>4. {T("מחבר טרפז של 16 פינים = OBD")}</p>
      </div></Card>
      <Card title={"📌 "+T("פינאוט שקע OBD-II (16 פין)")}>
        <div style={{ background:S.inner, borderRadius:"10px", padding:"10px", marginBottom:"8px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:"3px", direction:"ltr", maxWidth:"300px", margin:"0 auto" }}>
            {[{ n:1,c:"#666",t:"" },{ n:2,c:"#2563EB",t:"J1850+" },{ n:3,c:"#666",t:"" },{ n:4,c:"#A16207",t:"GND" },{ n:5,c:"#A16207",t:"GND" },{ n:6,c:"#16A34A",t:"CAN-H" },{ n:7,c:"#D97706",t:"K-Line" },{ n:8,c:"#666",t:"" },{ n:9,c:"#666",t:"" },{ n:10,c:"#2563EB",t:"J1850-" },{ n:11,c:"#666",t:"" },{ n:12,c:"#666",t:"" },{ n:13,c:"#666",t:"" },{ n:14,c:"#16A34A",t:"CAN-L" },{ n:15,c:"#D97706",t:"L-Line" },{ n:16,c:"#DC2626",t:"+12V" }].map(p=> <div key={p.n} style={{ background:p.c+"22", border:`1px solid ${p.c}`, borderRadius:"4px", padding:"2px", textAlign:"center", minHeight:"34px", display:"flex", flexDirection:"column", justifyContent:"center" }}><span style={{ color:p.c, fontSize:"11px", fontWeight:700 }}>{p.n}</span>{p.t&&<span style={{ color:p.c, fontSize:"8px", fontWeight:600 }}>{p.t}</span>}</div>)}
          </div>
        </div>
        <div style={{ fontSize:"12px", color:S.sub, lineHeight:1.7 }}>
          <p>{T("פין 16 — +12V ישיר ממצבר (תמיד חי)")}</p><p>{T("פין 4, 5 — אדמה (שלדה + אות)")}</p><p>{T("פין 6 — CAN High · פין 14 — CAN Low")}</p><p>{T("פין 7 — K-Line (ISO 9141)")}</p>
          <p>💡 {T("בדיקה מהירה: מדוד 12V בין פין 16 לפין 4. אין מתח? בדוק את הנתיך של שקע ה-OBD.")}</p><p>💡 {T("CAN: מדוד כ-60Ω בין פין 6 לפין 14 (מצבר מנותק).")}</p>
        </div>
      </Card>
    </>;
  }

  function DiagScreen(){
    return <>
      <Card title={"🩺 "+T("מחשבון אבחון")}>
        <p style={{ color:S.muted, fontSize:"12px", margin:"0 0 8px" }}>{T("בחר סימפטומים — ותקבל קודי תקלה אפשריים")}</p>
        {SYMPTOMS.map(s=>{ const on = selSymptoms.includes(s.id); return <button key={s.id} onClick={()=>setSelSymptoms(p=>on?p.filter(x=>x!==s.id):[...p,s.id])} style={{ display:"block", width:"100%", textAlign:"start", padding:"11px 12px", marginBottom:"5px", borderRadius:"10px", border:`1px solid ${on?S.acc:S.bdr}`, background:on?`${S.acc}18`:"transparent", cursor:"pointer", fontFamily:"inherit", color:on?S.acc:S.sub, fontSize:"13px", fontWeight:on?700:500, minHeight:"44px" }}>{symText(s).text}</button>; })}
      </Card>
      {selSymptoms.map(id=>{ const s = SYMPTOMS.find(x=>x.id===id); if(!s) return null; const st = symText(s); return <Card key={id} title={st.text}>
        <p style={{ color:S.green, fontSize:"12px", margin:"0 0 8px" }}>💡 {st.tip}</p>
        <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>{s.codes.map(c=> <button key={c} onClick={()=>searchCode(c)} style={{ ...rowBtn(), border:`1px solid ${S.bdr}`, borderRadius:"10px" }}><span style={{ color:S.acc, fontWeight:700, fontFamily:"monospace", minWidth:"58px" }}>{c}</span><span style={{ color:S.sub, fontSize:"12px" }}>{codeTitle(c)}</span></button>)}</div>
      </Card>; })}
      {selSymptoms.length>1 && <Card title={"📊 "+T("סה\"כ {n} קודים אפשריים",{ n:symptomCodes.length })}><div style={{ display:"flex", flexWrap:"wrap", gap:"5px" }}>{symptomCodes.map(c=> <Chip key={c} mono onClick={()=>searchCode(c)}>{c}</Chip>)}</div></Card>}
    </>;
  }

  function SensorsScreen(){
    return <>
      {SENSOR_REF.map((x0,i)=>{ const x = sensorOf(x0,i); return <Card key={i} title={"⚡ "+x.name}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
          <div style={{ background:S.inner, borderRadius:"8px", padding:"7px" }}><span style={{ color:S.muted, fontSize:"11px" }}>{T("מתח")}</span><p style={{ color:S.acc, fontSize:"14px", fontWeight:700, margin:"1px 0 0", fontFamily:"monospace" }} dir="auto">{x.voltage}</p></div>
          <div style={{ background:S.inner, borderRadius:"8px", padding:"7px" }}><span style={{ color:S.muted, fontSize:"11px" }}>{T("התנגדות")}</span><p style={{ color:S.green, fontSize:"14px", fontWeight:700, margin:"1px 0 0", fontFamily:"monospace" }} dir="auto">{x.resist}</p></div>
        </div>
        <p style={{ color:S.sub, fontSize:"12px", margin:"7px 0 0" }}>💡 {x.notes}</p>
      </Card>; })}
      <Card title={"🔋 "+T("טבלת מצבר — מתח לפי טעינה")}>
        <p style={{ color:S.muted, fontSize:"12px", margin:"0 0 6px" }}>{T("מדוד מצבר כבוי, ללא עומס, אחרי 30 דקות מנוחה")}</p>
        {BATTERY_TABLE.map((b,i)=> <div key={i} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"7px 8px", background:i%2===0?S.inner:"transparent", borderRadius:"6px" }}><span style={{ color:S.acc, fontWeight:700, fontSize:"14px", fontFamily:"monospace", minWidth:"62px", direction:"ltr" }}>{b.v}V</span><span style={{ color:i<2?S.green:i<4?S.warn:S.red, fontWeight:700, fontSize:"13px", minWidth:"46px" }}>{b.pct}</span><span style={{ color:S.text, fontSize:"12px" }}>{en()&&BATTERY_EN[i]?BATTERY_EN[i]:b.s}</span></div>)}
        <div style={{ marginTop:"8px", padding:"8px", background:S.inner, borderRadius:"8px", fontSize:"12px", color:S.sub, lineHeight:1.7 }}>
          <p>💡 {T("מנוע דולק: 13.5–14.5V = אלטרנטור תקין")}</p><p>💡 {T("בזמן התנעה: לא יורד מתחת ל-9.6V = מצבר וסטרטר תקינים")}</p><p>💡 {T("זרם חושך: מתחת ל-50mA = תקין")}</p>
        </div>
      </Card>
      <Card title={"📖 "+T("מילון מונחים — אנגלית ↔ עברית")}>
        {DICT.map((d,i)=> <div key={i} style={{ display:"flex", gap:"10px", padding:"6px 4px", borderBottom:`1px solid ${S.bdr}` }}><span style={{ color:S.acc, fontSize:"12px", fontWeight:700, fontFamily:"monospace", minWidth:"130px", direction:"ltr", textAlign:"start" }}>{d.en}</span><span style={{ color:S.text, fontSize:"12px" }}>{d.he}</span></div>)}
      </Card>
    </>;
  }

  function WiresScreen(){
    return <>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"10px" }}>
        <Btn onClick={()=>openLib(false)} style={{ minHeight:"60px" }}>📐 {T("הסכמות שלי")}{diagrams.length?` (${diagrams.length})`:""}</Btn>
        <Btn kind="blue" onClick={()=>openSub("circuits")} style={{ minHeight:"60px" }}>📘 {T("סכמות טיפוסיות")}</Btn>
      </div>
      <Card title={"🎨 "+T("צבעי חיווט לפי יצרן")}>
        <Select label={T("יצרן")} value={wireMake} onChange={e=>setWireMake(e.target.value)} style={{ marginBottom:"8px" }}>{Object.keys(WIRE_COLORS).map(k=> <option key={k} value={k}>{wireBrandLabel(k)}</option>)}</Select>
        {(WIRE_COLORS[wireMake]||[]).map((w0,i)=>{ const w = wireColorOf(wireMake,i,w0); return <div key={i} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"8px", background:S.inner, borderRadius:"10px", marginBottom:"4px" }}><div style={{ width:"24px", height:"24px", borderRadius:"50%", background:w.c, border:"2px solid #777", flexShrink:0 }}/><div><span style={{ color:S.text, fontSize:"13px", fontWeight:700 }}>{w.n}</span><span style={{ color:S.muted, fontSize:"12px" }}> — {w.u}</span></div></div>; })}
        <p style={{ color:S.muted, fontSize:"11px", marginTop:"6px" }}>⚠️ {T("ודא תמיד מול הסכמה של הדגם הספציפי.")}</p>
      </Card>
      <Card title={"🔌 "+T("סוגי חוטים ברכב")}>{WIRE_TYPES.map((t0,i)=>{ const t = wireTypeOf(t0,i); return <div key={i} style={{ background:S.inner, borderRadius:"10px", padding:"9px 10px", marginBottom:"5px", border:`1px solid ${S.bdr}` }}><span style={{ color:S.acc, fontSize:"13px", fontWeight:700 }}>{t.name}</span><p style={{ color:S.sub, fontSize:"12px", margin:"3px 0" }}>{t.desc}</p><p style={{ color:S.green, fontSize:"12px", margin:0 }}>📌 {T("שימוש")}: {t.use}</p></div>; })}</Card>
      <Card title={"📐 "+T("חפש סכמת חשמל לפי רכב")}>
        <p style={{ color:S.muted, fontSize:"12px", margin:"0 0 8px" }}>{T("הכנס יצרן ודגם — ותקבל קישור לסכמות חשמל ביוטיוב ובגוגל")}</p>
        <div style={{ display:"flex", gap:"6px", marginBottom:"8px" }}><Field value={wdMake} onChange={e=>setWdMake(e.target.value)} placeholder={T("יצרן (למשל Toyota)")}/><Field value={wdModel} onChange={e=>setWdModel(e.target.value)} placeholder={T("דגם (למשל Corolla)")}/></div>
        {wdMake.trim() ? <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}><YT q={`${wdMake} ${wdModel} wiring diagram schematic`} l={T("סכמות ביוטיוב")}/><GG q={`${wdMake} ${wdModel} wiring diagram`} l={T("תמונות בגוגל")} img/></div> : <p style={{ color:S.muted, fontSize:"11px" }}>{T("הקלד לפחות יצרן")}</p>}
      </Card>
    </>;
  }

  function LibScreen(){
    const v = vehicle; const ql = dgQuery.trim().toLowerCase();
    let list = dgOnlyVeh && v ? dgForVeh(v) : diagrams;
    if(ql) list = list.filter(m=>[m.make, m.model, m.title, m.notes, dgSystemName(m.system,false), dgSystemName(m.system,true), String(m.yFrom||""), ...(m.marks||[]).map(x=>x.text)].join(" ").toLowerCase().includes(ql));
    const groups = {}; list.forEach(m=>{ const k = m.make||"?"; (groups[k] = groups[k]||[]).push(m); });
    const keys = Object.keys(groups).sort((a,b)=>a.localeCompare(b));
    return <>
      <Btn onClick={()=>setDgSheet({ meta:null })} style={{ width:"100%", marginBottom:"10px", fontSize:"15px" }}>＋ {T("הוסף סכמה (PDF או תמונה)")}</Btn>
      {diagrams.length>0 && <Card>
        <Field value={dgQuery} onChange={e=>setDgQuery(e.target.value)} placeholder={T("חפש יצרן, דגם, מערכת או הערה...")} aria-label={T("חיפוש סכמות")}/>
        {v && <div style={{ display:"flex", gap:"6px", marginTop:"8px", flexWrap:"wrap" }}><Chip active={!dgOnlyVeh} onClick={()=>setDgOnlyVeh(false)}>{T("הכל")} ({diagrams.length})</Chip><Chip active={dgOnlyVeh} onClick={()=>setDgOnlyVeh(true)}>🚗 {vehLabel(v)} ({dgForVeh(v).length})</Chip></div>}
      </Card>}
      {keys.map(k=> <Card key={k} title={<span dir="auto">🚗 {k} <span style={{ color:S.muted, fontWeight:500 }}>({groups[k].length})</span></span>}>
        {groups[k].sort((a,b)=>(a.model||"").localeCompare(b.model||"")||(a.system||"").localeCompare(b.system||"")).map(m=> <div key={m.id} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"7px 0", borderBottom:`1px solid ${S.bdr}` }}>
          <button onClick={()=>setDgView(m)} style={{ display:"flex", alignItems:"center", gap:"10px", flex:1, minWidth:0, background:"none", border:"none", padding:0, cursor:"pointer", fontFamily:"inherit", textAlign:"start" }}>
            {m.thumb ? <img src={m.thumb} alt="" style={{ width:"58px", height:"58px", objectFit:"cover", objectPosition:"top", borderRadius:"8px", background:"#fff", flexShrink:0 }}/> : <span style={{ width:"58px", height:"58px", borderRadius:"8px", background:S.inner, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"24px", flexShrink:0 }}>📐</span>}
            <span style={{ minWidth:0 }}>
              <span style={{ display:"block", color:S.text, fontWeight:700, fontSize:"14px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} dir="auto">{m.title || dgSystemName(m.system, en())}</span>
              <span style={{ display:"block", color:S.sub, fontSize:"12px" }} dir="auto">{[m.model, dgYears(m)].filter(Boolean).join(" · ") || T("כל הדגמים")}</span>
              <span style={{ display:"block", color:S.muted, fontSize:"11px" }}>{m.title ? dgSystemName(m.system, en())+" · " : ""}{T("{n} דפים",{ n:m.pages||0 })}{(m.marks||[]).length?` · 📍${m.marks.length}`:""}</span>
            </span>
          </button>
          <IconBtn label={T("עריכה")} onClick={()=>setDgSheet({ meta:m })} color={S.acc}>✏️</IconBtn>
        </div>)}
      </Card>)}
      {diagrams.length===0 && <Card><div style={{ textAlign:"center", padding:"10px", color:S.sub, fontSize:"13px", lineHeight:1.7 }}>
        <div style={{ fontSize:"40px" }}>📐</div>
        <p>{T("כאן נשמרות סכמות החשמל שלך — PDF או תמונות — לפי יצרן, דגם, שנה ומערכת.")}</p>
        <p>{T("הכל נשמר בטלפון ונפתח גם בלי אינטרנט. אפשר להגדיל, לעבור בין דפים ולסמן נקודות עם הערות.")}</p>
        <p style={{ color:S.muted, fontSize:"12px" }}>{T("כשתחפש רכב לפי מספר רישוי, הסכמות שלו יופיעו בכרטיס הרכב.")}</p>
      </div></Card>}
      {diagrams.length>0 && list.length===0 && <Card><p style={{ color:S.muted, fontSize:"13px", textAlign:"center" }}>{T("לא נמצאו סכמות")}</p></Card>}
      <Card title={"💾 "+T("גיבוי הסכמות")}>
        <p style={{ color:S.muted, fontSize:"12px", margin:"0 0 8px" }}>{T("הסכמות לא נכללות בגיבוי הרגיל כי הן כבדות. כאן אפשר לשמור את כולן לקובץ אחד ולשחזר בטלפון אחר.")}{dgStore&&dgStore.used?` ${T("בשימוש: {u}",{ u:fmtMB(dgStore.used) })}`:""}</p>
        <input ref={dgImpRef} type="file" accept="application/json,.json" onChange={dgImport} style={{ display:"none" }}/>
        <div style={{ display:"flex", gap:"8px" }}><Btn kind="ghost" disabled={!diagrams.length||!!dgBusy} onClick={dgExport} style={{ flex:1 }}>💾 {T("ייצוא לקובץ")}</Btn><Btn kind="ghost" disabled={!!dgBusy} onClick={()=>dgImpRef.current?.click()} style={{ flex:1 }}>📂 {T("ייבוא מקובץ")}</Btn></div>
        {dgBusy && !dgSheet && <p style={{ color:S.acc, fontWeight:700, fontSize:"13px", margin:"8px 0 0" }}>⏳ {dgBusy}</p>}
      </Card>
      <Btn kind="blue" onClick={()=>openSub("circuits")} style={{ width:"100%" }}>📘 {T("סכמות טיפוסיות — מעגלים נפוצים עם נקודות בדיקה")}</Btn>
    </>;
  }
  function CircuitsScreen(){
    return <>
      <Card><p style={{ color:S.sub, fontSize:"13px", margin:0, lineHeight:1.6 }}>{T("סכמות כלליות של מעגלים נפוצים ברכב, עם ערכים ונקודות בדיקה. הן עוזרות להבין ולאבחן — אבל הן לא סכמת יצרן של דגם מסוים. צבעי חוטים ומספרי פינים משתנים בין רכבים.")}</p></Card>
      {CIRCUITS.map(cc=>{ const x = en() ? cc.en : cc.he; return <details key={cc.id} id={"circ-"+cc.id} open={circOpen===cc.id} onToggle={e=>{ if(e.currentTarget.open && circOpen!==cc.id) setCircOpen(cc.id); }} style={{ background:S.card, borderRadius:"14px", border:`1px solid ${S.bdr}`, marginBottom:"8px", overflow:"hidden" }}>
        <summary style={{ padding:"13px 14px", cursor:"pointer", color:S.acc, fontWeight:700, fontSize:"14px", listStyle:"none", display:"flex", alignItems:"center", gap:"8px" }}><span style={{ fontSize:"20px" }}>{cc.icon}</span><span style={{ flex:1 }}>{x.title}</span><span style={{ color:S.muted }}>▾</span></summary>
        <div style={{ padding:"0 14px 14px" }}>
          <div dir="ltr" style={{ background:S.inner, borderRadius:"12px", padding:"8px", color:S.text, marginBottom:"10px" }} dangerouslySetInnerHTML={{ __html: cc.draw() }}/>
          <p style={{ color:S.sub, fontSize:"13px", lineHeight:1.6, margin:"0 0 8px" }}>{x.desc}</p>
          <div style={{ color:S.acc, fontSize:"13px", fontWeight:700, marginBottom:"4px" }}>🔍 {T("מה לבדוק")}</div>
          {x.tests.map((s,i)=> <p key={i} style={{ color:S.text, fontSize:"13px", lineHeight:1.55, margin:"0 0 5px", paddingInlineStart:"14px", position:"relative" }}><span style={{ position:"absolute", insetInlineStart:0, color:S.acc }}>•</span>{s}</p>)}
        </div>
      </details>; })}
    </>;
  }
  function TreesScreen(){
    const L2 = o => en() ? o.en : o.he;
    if(!treeSel) return <>
      <Card><p style={{ color:S.sub, fontSize:"13px", margin:0, lineHeight:1.6 }}>{T("בחר תקלה, ענה על השאלות לפי מה שאתה מודד — והאפליקציה תוביל אותך לסיבה. בכל שלב אפשר לחזור אחורה.")}</p></Card>
      {TREES.map(tr=> <button key={tr.id} onClick={()=>setTreeSel({ id:tr.id, path:[tr.start] })} style={{ ...rowBtn(), background:S.card, border:`1px solid ${S.bdr}`, borderRadius:"14px", padding:"14px", marginBottom:"8px", minHeight:"58px" }}><span style={{ fontSize:"24px" }}>{tr.icon}</span><span style={{ color:S.text, fontSize:"14px", fontWeight:700, flex:1 }}>{L2(tr.title)}</span><span style={{ color:S.muted }}>{dir==="rtl"?"‹":"›"}</span></button>)}
    </>;
    const tr = TREES.find(t=>t.id===treeSel.id); const nid = treeSel.path[treeSel.path.length-1]; const n = tr.nodes[nid];
    const cc = n.circuit ? CIRCUITS.find(x=>x.id===n.circuit) : null;
    return <>
      <Card title={<span>{tr.icon} {L2(tr.title)}</span>} actions={<span style={{ color:S.muted, fontSize:"12px" }}>{T("שלב {n}",{ n:treeSel.path.length })}</span>}>
        {n.end ? <>
          <div style={{ background:`${S.green}14`, border:`1px solid ${S.green}`, borderRadius:"12px", padding:"12px", marginBottom:"10px" }}><div style={{ color:S.green, fontWeight:800, fontSize:"13px", marginBottom:"4px" }}>✅ {T("כיוון לתיקון")}</div><p style={{ color:S.text, fontSize:"14px", lineHeight:1.65, margin:0 }}>{L2(n.end)}</p></div>
          {cc && <Btn kind="blue" onClick={()=>{ setCircOpen(cc.id); openSub("circuits"); }} style={{ width:"100%", marginBottom:"8px" }}>📘 {T("סכמה טיפוסית")}: {en()?cc.en.title:cc.he.title}</Btn>}
          {(n.codes||[]).length>0 && <><div style={{ color:S.muted, fontSize:"12px", margin:"4px 0" }}>{T("קודים קשורים")}</div><div style={{ display:"flex", flexWrap:"wrap", gap:"5px", marginBottom:"8px" }}>{n.codes.map(cd=> <Chip key={cd} mono onClick={()=>searchCode(cd)}>{cd}</Chip>)}</div></>}
        </> : <>
          <p style={{ color:S.text, fontSize:"15px", fontWeight:700, lineHeight:1.55, margin:"0 0 8px" }}>{L2(n.q)}</p>
          {n.hint && <p style={{ color:S.muted, fontSize:"12px", margin:"0 0 10px", lineHeight:1.5 }}>💡 {L2(n.hint)}</p>}
          <div style={{ display:"flex", flexDirection:"column", gap:"7px" }}>{n.opts.map((op,i)=> <button key={i} onClick={()=>setTreeSel({ ...treeSel, path:[...treeSel.path, op.next] })} style={{ background:S.inner, border:`1px solid ${S.bdr}`, borderRadius:"12px", padding:"12px", color:S.text, fontSize:"14px", fontWeight:600, textAlign:"start", cursor:"pointer", fontFamily:"inherit", minHeight:"48px" }}>{L2(op.t)}</button>)}</div>
        </>}
        <div style={{ display:"flex", gap:"8px", marginTop:"10px" }}>
          {treeSel.path.length>1 && <Btn kind="ghost" onClick={()=>setTreeSel({ ...treeSel, path:treeSel.path.slice(0,-1) })} style={{ flex:1 }}>{backArrow} {T("צעד אחורה")}</Btn>}
          <Btn kind="ghost" onClick={()=>setTreeSel(n.end?{ id:tr.id, path:[tr.start] }:null)} style={{ flex:1 }}>{n.end?"🔄 "+T("מההתחלה"):"☰ "+T("כל העצים")}</Btn>
        </div>
      </Card>
      {treeSel.path.length>1 && <Card title={"🧾 "+T("התשובות שלך")}>{treeSel.path.slice(0,-1).map((id,i)=>{ const nn = tr.nodes[id]; const nx = treeSel.path[i+1]; const op = (nn.opts||[]).find(o=>o.next===nx); return <p key={i} style={{ color:S.sub, fontSize:"12px", margin:"0 0 5px", lineHeight:1.5 }}><span style={{ color:S.muted }}>{i+1}. {L2(nn.q)}</span><br/>→ <strong style={{ color:S.text }}>{op?L2(op.t):""}</strong></p>; })}</Card>}
    </>;
  }
  function RefScreen(){
    const L2 = o => en() ? o.en : o.he;
    const th = { color:S.muted, fontSize:"11px", fontWeight:700, padding:"5px", textAlign:"start", borderBottom:`1px solid ${S.bdr}` };
    const td = { color:S.text, fontSize:"13px", padding:"6px 5px", borderBottom:`1px solid ${S.bdr}`, verticalAlign:"top" };
    const det = (id, icon, title, body) => <details key={id} style={{ background:S.card, borderRadius:"14px", border:`1px solid ${S.bdr}`, marginBottom:"8px", overflow:"hidden" }}>
      <summary style={{ padding:"13px 14px", cursor:"pointer", color:S.acc, fontWeight:700, fontSize:"14px", listStyle:"none", display:"flex", alignItems:"center", gap:"8px" }}><span style={{ fontSize:"20px" }}>{icon}</span><span style={{ flex:1 }}>{title}</span><span style={{ color:S.muted }}>▾</span></summary>
      <div style={{ padding:"0 14px 14px" }}>{body}</div></details>;
    return <>
      {det("din","🔢",T("מספרי הדקים (DIN 72552)"), <table style={{ width:"100%", borderCollapse:"collapse" }}><tbody>{DIN.map(([k,v])=> <tr key={k}><td style={{ ...td, color:S.acc, fontWeight:800, fontFamily:"monospace", whiteSpace:"nowrap", width:"1%" }}>{k}</td><td style={td}>{L2(v)}</td></tr>)}</tbody></table>)}
      {det("wire","🧵",T("עובי חוט מול זרם"), <><table style={{ width:"100%", borderCollapse:"collapse" }}><thead><tr><th style={th}>mm²</th><th style={th}>AWG</th><th style={th}>{T("זרם רציף (A)")}</th></tr></thead><tbody>{WIRES.map(([a,g,i])=> <tr key={a}><td style={{ ...td, fontWeight:700 }}>{a}</td><td style={td}>{g}</td><td style={{ ...td, color:S.acc, fontWeight:700 }}>{i}</td></tr>)}</tbody></table><p style={{ color:S.muted, fontSize:"11px", margin:"8px 0 0" }}>{T("ערכים טיפוסיים לחוט קצר בצרור. בחוט ארוך — חשב מפל מתח במחשבון. הנתיך מגן על החוט, לא על הצרכן.")}</p></>)}
      {det("fuse","🟥",T("צבעי נתיכים"), <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"6px" }}>{FUSES.map(([a,col,nm])=> <div key={a} style={{ display:"flex", alignItems:"center", gap:"8px", background:S.inner, borderRadius:"10px", padding:"7px" }}><span style={{ width:"22px", height:"30px", borderRadius:"4px", background:col, border:"1px solid #777", flexShrink:0 }}/><span><b style={{ color:S.text, fontSize:"14px" }}>{a}A</b><br/><span style={{ color:S.muted, fontSize:"11px" }}>{L2(nm)}</span></span></div>)}</div>)}
      {det("proto","📡",T("פרוטוקולי OBD"), <table style={{ width:"100%", borderCollapse:"collapse" }}><thead><tr><th style={th}>{T("פרוטוקול")}</th><th style={th}>{T("פינים")}</th><th style={th}>{T("איפה")}</th></tr></thead><tbody>{PROTOCOLS.map(([n,pins,d])=> <tr key={n}><td style={{ ...td, fontWeight:700, fontSize:"12px" }}>{n}</td><td style={{ ...td, fontFamily:"monospace" }}>{pins}</td><td style={{ ...td, fontSize:"12px", color:S.sub }}>{L2(d)}</td></tr>)}</tbody></table>)}
      {SECTIONS.map(s=> det(s.id, s.icon, L2(s.title), s.items.map((it,i)=> <p key={i} style={{ color:S.text, fontSize:"13px", lineHeight:1.6, margin:"0 0 7px", paddingInlineStart:"14px", position:"relative" }}><span style={{ position:"absolute", insetInlineStart:0, color:S.acc }}>•</span>{L2(it)}</p>)))}
      <Btn kind="blue" onClick={()=>openSub("circuits")} style={{ width:"100%", marginBottom:"8px" }}>📘 {T("סכמות טיפוסיות עם נקודות בדיקה")}</Btn>
      <Btn kind="ghost" onClick={()=>openSub("sensors")} style={{ width:"100%" }}>📊 {T("ערכי חיישנים ומצבר")}</Btn>
    </>;
  }
  function CalcScreen(){
    const num = k => parseFloat(String(cv[k]).replace(",","."));
    const inp = (k, label, unit) => <label style={{ flex:1, minWidth:"90px", color:S.sub, fontSize:"11px", fontWeight:700 }}>{label}<div style={{ display:"flex", alignItems:"center", gap:"4px", marginTop:"3px" }}><Field value={cv[k]} onChange={e=>setC(k,e.target.value)} inputMode="decimal" style={{ textAlign:"center", fontWeight:700 }}/><span style={{ color:S.muted, fontSize:"12px", whiteSpace:"nowrap" }}>{unit}</span></div></label>;
    const nu = s => <span dir="ltr" style={{ unicodeBidi:"isolate", display:"inline-block" }}>{s}</span>;
    const out = (txt, col) => <div style={{ background:S.inner, borderRadius:"10px", padding:"10px", marginTop:"10px", color:col||S.text, fontSize:"14px", fontWeight:700, lineHeight:1.6 }}>{txt}</div>;
    // voltage drop: copper 0.0175 Ω·mm²/m, length is round trip
    const L_ = num("vdL"), A_ = num("vdA"), I_ = num("vdI");
    const vd = L_>0&&A_>0&&I_>=0 ? I_*0.0175*L_/A_ : null; const vdp = vd!==null ? vd/12*100 : null;
    const minA = L_>0&&I_>0 ? [0.35,0.5,0.75,1,1.5,2.5,4,6,10,16,25,35,50].find(a=>I_*0.0175*L_/a <= 0.36) : null;
    // LED resistor
    const Vs = num("ledV"), Vf = num("ledF"), Im = num("ledI");
    const R = Vs>Vf&&Im>0 ? (Vs-Vf)/(Im/1000) : null; const Pw = R ? (Vs-Vf)*(Im/1000) : null;
    let Rstd = null; if(R){ const dec = Math.pow(10, Math.floor(Math.log10(R))); Rstd = (E12.map(v=>v*dec).concat([10*dec])).find(v=>v>=R*0.999); }
    // parasitic draw
    const dI = num("drI"), dAh = num("drAh"); const days = dI>0&&dAh>0 ? (dAh*0.5)/(dI/1000)/24 : null;
    // power / fuse
    const W = num("pwW"), V = num("pwV"); const amps = W>0&&V>0 ? W/V : null; const fuse = amps ? FUSE_STEPS.find(f=>f>=amps*1.25) : null;
    const fmtR = r => r>=1000 ? (r/1000).toFixed(r>=10000?1:2).replace(/\.?0+$/,"")+" kΩ" : Math.round(r)+" Ω";
    return <>
      <Card title={"📉 "+T("מפל מתח בחוט")}>
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>{inp("vdL",T("אורך הלוך-חזור"),"m")}{inp("vdA",T("חתך"),"mm²")}{inp("vdI",T("זרם"),"A")}</div>
        {vd!==null && out(<>{T("מפל מתח")}: {nu(`${vd.toFixed(2)} V (${vdp.toFixed(1)}%)`)}<br/><span style={{ color:vdp>3?S.red:S.green, fontSize:"13px" }}>{vdp>3?"⚠️ "+T("יותר מ-3% — כדאי חוט עבה יותר"):"✅ "+T("תקין (עד 3%)")}</span>{minA && <><br/><span style={{ color:S.sub, fontSize:"13px" }}>{T("חתך מינימלי ל-3%")}: {nu(`${minA} mm²`)}</span></>}</>)}
        <p style={{ color:S.muted, fontSize:"11px", margin:"6px 0 0" }}>{T("חוט נחושת ב-20°C. אם האדמה דרך השלדה — הכנס רק את אורך חוט הפלוס.")}</p>
      </Card>
      <Card title={"💡 "+T("נגד ל-LED")}>
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>{inp("ledV",T("מתח הזנה"),"V")}{inp("ledF",T("מתח LED"),"V")}{inp("ledI",T("זרם LED"),"mA")}</div>
        {R && out(<>{T("נגד")}: {nu(fmtR(R))} · {T("ערך תקני")}: {nu(fmtR(Rstd))}<br/><span style={{ color:S.sub, fontSize:"13px" }}>{T("הספק")}: {nu(`${Pw.toFixed(2)} W`)} · {T("נגד של")} {nu(`${Pw*2<=0.25?"¼":Pw*2<=0.5?"½":Pw*2<=1?"1":"2"} W`)}</span></>)}
        <p style={{ color:S.muted, fontSize:"11px", margin:"6px 0 0" }}>{T("ברכב עם מנוע עובד המתח מגיע ל-14.4V — חשב לפיו. LED אדום ~2V, לבן/כחול ~3.2V.")}</p>
      </Card>
      <Card title={"🔋 "+T("זרם זליגה — כמה ימים עד שהמצבר לא יתניע")}>
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>{inp("drI",T("זרם זליגה"),"mA")}{inp("drAh",T("קיבולת מצבר"),"Ah")}</div>
        {days!==null && out(<>{T("בערך {d} ימים עד חצי מצבר",{ d: days>=10?Math.round(days):days.toFixed(1) })}<br/><span style={{ color:dI>50?S.red:S.green, fontSize:"13px" }}>{dI>50?"⚠️ "+T("מעל 50mA — חפש מה לא נרדם"):"✅ "+T("זליגה סבירה (עד 50mA)")}</span></>)}
      </Card>
      <Card title={"⚡ "+T("הספק, זרם ונתיך")}>
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>{inp("pwW",T("הספק"),"W")}{inp("pwV",T("מתח"),"V")}</div>
        {amps && out(<>{T("זרם")}: {nu(`${amps.toFixed(1)} A`)}<br/><span style={{ color:S.sub, fontSize:"13px" }}>{T("נתיך מומלץ")}: {nu(`${fuse||"—"} A`)} · {T("חוט מינימלי")}: {nu(`${(WIRES.find(w=>parseFloat(w[2])>=(fuse||amps))||WIRES[WIRES.length-1])[0]} mm²`)}</span></>)}
      </Card>
      <Btn kind="ghost" onClick={()=>openSub("convert")} style={{ width:"100%" }}>🔄 {T("ממיר יחידות וחוק אוהם")}</Btn>
    </>;
  }
  function ConvertScreen(){
    const v=parseFloat(ohmV), i=parseFloat(ohmI), r=parseFloat(ohmR); let res=null;
    if(v&&i&&!ohmR) res={ label:"R = V / I", value:(v/i).toFixed(3), unit:"Ω", color:S.blue };
    else if(v&&r&&!ohmI) res={ label:"I = V / R", value:(v/r).toFixed(3), unit:"A", color:S.green };
    else if(i&&r&&!ohmV) res={ label:"V = I × R", value:(i*r).toFixed(3), unit:"V", color:S.acc };
    const pw = res ? (v&&i?(v*i):(v&&r?(v*v/r):(i*i*r))).toFixed(2) : null;
    const box = (val,set,lab,col,ph) => <div><p style={{ color:col, fontSize:"11px", fontWeight:700, margin:"0 0 3px", textAlign:"center" }}>{lab}</p><Field type="number" inputMode="decimal" value={val} onChange={e=>set(e.target.value)} placeholder={ph} style={{ color:col, fontSize:"17px", fontWeight:700, textAlign:"center", fontFamily:"monospace", direction:"ltr", border:`2px solid ${val?col:S.bdr}` }}/></div>;
    return <>
      <Card title={"🔄 "+T("ממיר יחידות")}>
        <Select label={T("המרה")} value={convSel} onChange={e=>setConvSel(Number(e.target.value))} style={{ marginBottom:"10px" }}>{CONVERSIONS.map((x,k)=> <option key={k} value={k}>[{convCat(x.cat)}] {unitL(x.from)} → {unitL(x.to)}</option>)}</Select>
        <div style={{ display:"flex", gap:"8px", alignItems:"center", direction:"ltr" }}>
          <div style={{ flex:1 }}><Field type="number" inputMode="decimal" value={convVal} onChange={e=>setConvVal(e.target.value)} placeholder="0" style={{ color:S.acc, fontSize:"19px", fontWeight:700, textAlign:"center", fontFamily:"monospace" }}/><p style={{ textAlign:"center", color:S.muted, fontSize:"11px", margin:"3px 0 0" }}>{unitL(convC.from)}</p></div>
          <span style={{ color:S.acc, fontSize:"20px", fontWeight:700 }}>→</span>
          <div style={{ flex:1 }}><div style={{ padding:"10px", borderRadius:"10px", background:`${S.green}14`, border:`2px solid ${S.green}`, textAlign:"center" }}><span style={{ color:S.green, fontSize:"19px", fontWeight:700, fontFamily:"monospace" }}>{convResult!==null&&!isNaN(convResult)?convResult.toFixed(3):"—"}</span></div><p style={{ textAlign:"center", color:S.muted, fontSize:"11px", margin:"3px 0 0" }}>{unitL(convC.to)}</p></div>
        </div>
      </Card>
      <Card title={"⚡ "+T("מחשבון חוק אוהם")} actions={(ohmV||ohmI||ohmR)&&<IconBtn label={T("נקה")} onClick={()=>{ setOhmV(""); setOhmI(""); setOhmR(""); }}>🧹</IconBtn>}>
        <p style={{ color:S.muted, fontSize:"12px", margin:"0 0 8px" }}>{T("הכנס 2 ערכים — והשלישי יחושב (V = I × R)")}</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"6px" }}>
          {box(ohmV,x=>{ setOhmV(x); if(x&&ohmI) setOhmR(""); else if(x&&ohmR) setOhmI(""); },T("V מתח"),S.acc,"V")}
          {box(ohmI,x=>{ setOhmI(x); if(x&&ohmV) setOhmR(""); else if(x&&ohmR) setOhmV(""); },T("I זרם"),S.green,"A")}
          {box(ohmR,x=>{ setOhmR(x); if(x&&ohmV) setOhmI(""); else if(x&&ohmI) setOhmV(""); },T("R התנגדות"),S.blue,"Ω")}
        </div>
        {res && <div style={{ marginTop:"10px", padding:"10px", background:S.inner, borderRadius:"10px", textAlign:"center", direction:"ltr" }}><p style={{ color:S.muted, fontSize:"12px", margin:"0 0 2px" }}>{res.label}</p><span style={{ color:res.color, fontSize:"22px", fontWeight:800, fontFamily:"monospace" }}>{res.value} {res.unit}</span>{pw&&<p style={{ color:S.muted, fontSize:"12px", margin:"4px 0 0" }}>P = {pw} W</p>}</div>}
      </Card>
    </>;
  }

  function AllScreen(){
    const q = allSearch.trim(); const ql = q.toLowerCase();
    const list = Object.keys(CODES_DB).filter(c=>!q||c.toLowerCase().includes(ql)||CODES_DB[c].he.includes(q)||CODES_DB[c].en.toLowerCase().includes(ql));
    return <Card title={"📚 "+T("מאגר קודים ({n})",{ n:totalCodes })}>
      <Field value={allSearch} onChange={e=>setAllSearch(e.target.value)} placeholder={T("חפש קוד או תיאור...")} aria-label={T("חיפוש")} style={{ marginBottom:"8px" }}/>
      {list.map(c=> <button key={c} onClick={()=>searchCode(c)} style={rowBtn()}><span style={{ color:S.acc, fontWeight:700, fontFamily:"monospace", fontSize:"13px", minWidth:"58px" }}>{c}</span><span style={{ color:S.sub, fontSize:"12px", flex:1 }}>{codeTitle(c)}</span><SevBadge level={CODES_DB[c].severity}/></button>)}
      {list.length===0 && <p style={{ color:S.muted, fontSize:"12px", textAlign:"center", padding:"12px" }}>{T("לא נמצאו תוצאות")}</p>}
    </Card>;
  }

  function SettingsScreen(){
    const seg = (opts,val,set) => <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>{opts.map(([v,l])=> <Chip key={String(v)} active={val===v} onClick={()=>set(v)}>{l}</Chip>)}</div>;
    const row = (label, child, hint) => <div style={{ marginBottom:"14px" }}><div style={{ color:S.text, fontSize:"13px", fontWeight:700, marginBottom:"6px" }}>{label}</div>{child}{hint&&<p style={{ color:S.muted, fontSize:"11px", margin:"5px 0 0" }}>{hint}</p>}</div>;
    return <>
      <Card title={"👤 "+T("פרטים לדוחות ושיתוף")}>
        {row(T("שם / שם העסק"), <Field value={settings.name} onChange={e=>setS({ name:e.target.value })} placeholder={T("למשל: ברק — חשמלאות רכב")}/>, T("מופיע בכל הדפסה, דוח ושיתוף"))}
        {row(T("טלפון (לא חובה)"), <Field type="tel" value={settings.phone} onChange={e=>setS({ phone:e.target.value })} placeholder="050-0000000" style={{ direction:"ltr", textAlign:"start" }}/>)}
        {row(T("כתובת (לא חובה)"), <Field value={settings.address||""} onChange={e=>setS({ address:e.target.value })} placeholder={T("למשל: המלאכה 5, אשדוד")}/>)}
        {row(T("ע.מ / ח.פ (לא חובה)"), <Field value={settings.bizId||""} onChange={e=>setS({ bizId:e.target.value })} inputMode="numeric" style={{ direction:"ltr", textAlign:"start" }}/>)}
        {row(T("לוגו לדוחות (לא חובה)"), <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          {settings.logo ? <img src={settings.logo} alt="" style={{ maxHeight:"56px", maxWidth:"130px", objectFit:"contain", background:"#fff", borderRadius:"8px", padding:"4px" }}/> : <span style={{ color:S.muted, fontSize:"12px" }}>{T("אין לוגו")}</span>}
          <label style={{ cursor:"pointer" }}><input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ const f = e.target.files?.[0]; e.target.value=""; if(f) logoFrom(f).then(d=>{ if(d) setS({ logo:d }); else toast(T("לא הצלחתי לקרוא את התמונה")); }); }}/><span style={{ display:"inline-block", border:`1px solid ${S.bdr}`, color:S.sub, borderRadius:"10px", padding:"9px 12px", fontSize:"13px", fontWeight:700 }}>🖼️ {settings.logo?T("החלף"):T("בחר תמונה")}</span></label>
          {settings.logo && <Btn kind="danger" onClick={()=>askConfirm({ text:T("להסיר את הלוגו?"), ok:T("הסר"), danger:true, onOk:()=>setS({ logo:"" }) })}>✕</Btn>}
        </div>, T("מופיע בראש דוח הלקוח וכל הדפסה, יחד עם השם, הטלפון והכתובת."))}
        <Btn kind="ghost" onClick={()=>doPrint(T("דוגמה לדוח"), `<p>${esc(T("כך ייראה ראש הדוח שלך."))}</p>`, [])} style={{ width:"100%" }}>👁️ {T("תצוגה מקדימה של הדוח")}</Btn>
      </Card>
      <Card title={"🌐 "+T("שפה ותצוגה")}>
        {row(T("שפה"), seg([["he","עברית"],["en","English"]], settings.lang, v=>setS({ lang:v })))}
        {row(T("עיצוב"), seg(THEME_ORDER.map(k=>[k,L(THEMES[k])]), settings.theme, v=>setS({ theme:v })))}
        {row(T("גודל טקסט"), seg([[1,"A"],[1.15,"A+"],[1.3,"A++"]], settings.zoom, v=>setS({ zoom:v })))}
      </Card>
      <Card title={"💾 "+T("גיבוי ושחזור")}>
        <p style={{ color:S.muted, fontSize:"12px", margin:"0 0 8px" }}>{T("כל הנתונים נשמרים רק במכשיר הזה. כדאי לגבות לקובץ מדי פעם — וגם כדי להעביר לטלפון אחר.")}</p>
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}><Btn onClick={doExport} style={{ flex:1 }}>💾 {T("גיבוי לקובץ")}</Btn><Btn kind="ghost" onClick={()=>importRef.current?.click()} style={{ flex:1 }}>📂 {T("שחזור מגיבוי")}</Btn></div>
        {workLog.length>0 && <Btn kind="ghost" onClick={logCsv} style={{ width:"100%", marginTop:"8px" }}>📊 {T("ייצוא יומן לאקסל (CSV)")}</Btn>}
      </Card>
      <Card title={"🧭 "+T("עזרה")}><Btn kind="ghost" onClick={()=>setGuideStep(0)} style={{ width:"100%" }}>📖 {T("הצג שוב את מדריך הפתיחה")}</Btn></Card>
      <Card title={"⚠️ "+T("אזור מסוכן")} style={{ borderColor:S.red }}>
        <Btn kind="danger" onClick={deleteAll} style={{ width:"100%" }}>🗑️ {T("מחק את כל הנתונים")}</Btn>
      </Card>
    </>;
  }

  function AboutScreen(){
    const rowI = (k,v) => <div style={{ display:"flex", justifyContent:"space-between", gap:"10px", padding:"7px 0", borderBottom:`1px solid ${S.bdr}`, fontSize:"13px" }}><span style={{ color:S.muted }}>{k}</span><span style={{ color:S.text, fontWeight:600, textAlign:"end" }}>{v}</span></div>;
    return <>
      <Card style={{ textAlign:"center" }}>
        <img src="./icon-192.png" alt="" width="84" height="84" style={{ borderRadius:"20px" }}/>
        <h2 style={{ color:S.acc, fontSize:"21px", fontWeight:800, margin:"8px 0 2px" }}>AutoDiag Pro</h2>
        <p style={{ color:S.muted, fontSize:"12px", margin:0 }}>{T("גרסה")} {APP_VERSION}</p>
        <p style={{ color:S.sub, fontSize:"13px", lineHeight:1.6, margin:"10px 0 4px" }}>{L(ABOUT.creator)}</p>
        <p style={{ color:S.muted, fontSize:"12px", margin:0 }}>{L(ABOUT.copy)}</p>
      </Card>
      <Card title={"📋 "+T("פרטים")}>
        {rowI(T("גרסה"), APP_VERSION)}{rowI(T("פיתוח"), T("ברק אפללו"))}{rowI(T("פלטפורמה"), "PWA · HTML5")}{rowI(T("אחסון"), T("על המכשיר בלבד"))}{rowI(T("רישיון"), "© AppNest 2026")}
        {rowI(T("תוכן"), T("{c} קודים · {s} סימפטומים · {m} יצרנים",{ c:totalCodes, s:SYMPTOMS.length, m:CAR_MAKES.length }))}
      </Card>
      <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginBottom:"10px" }}>
        <Btn onClick={()=>openExt(ABOUT.link)}>🪺 {T("חנות AppNest — עוד אפליקציות")}</Btn>
        <Btn kind="ghost" onClick={shareApp}>📤 {T("שתף את האפליקציה")}</Btn>
        <Btn kind="ghost" onClick={()=>openExt(`mailto:${ABOUT.mail}?subject=${encodeURIComponent("AutoDiag Pro "+APP_VERSION)}`)}>✉️ {T("שלח משוב")}</Btn>
        <Btn kind="ghost" onClick={()=>setGuideStep(0)}>📖 {T("מדריך")}</Btn>
        <Btn kind="ghost" onClick={()=>openExt("./privacy_policy.html")}>🔒 {T("מדיניות פרטיות")}</Btn>
      </div>
      <Card title={"⚠️ "+T("הצהרת אחריות")}><p style={{ color:S.sub, fontSize:"12px", lineHeight:1.7, margin:0 }}>{T("כל המידע באפליקציה הוא מידע כללי שנאסף ממקורות שונים ונועד לשמש ככלי עזר בלבד. הוא אינו תחליף לנתוני היצרן, לספרות שירות רשמית או לבדיקה של בעל מקצוע מוסמך. ערכי מתח, התנגדות ומיקומי רכיבים משתנים בין דגמים — יש לאמת כל פעולה מול נתוני היצרן. עבודה על מערכות כריות אוויר, דלק ומתח גבוה (היברידי/חשמלי) מסוכנת ומחייבת הכשרה. המפתח והמפרסם אינם נושאים באחריות לכל נזק, טעות או תוצאה הנובעים מהשימוש באפליקציה או במידע שבה. השימוש באחריות המשתמש בלבד.")}</p></Card>
    </>;
  }

  // ─── overlays ───
  const guideSteps = [
    ["🔧","ברוך הבא ל-AutoDiag Pro","כלי עבודה לחשמלאי רכב: קודי תקלה, סורק OBD, יומן עבודה וכלי מדידה — הכל במכשיר, גם בלי אינטרנט."],
    ["⚠️","קוד תקלה","מקלידים קוד ומקבלים הסבר, גורמים, שלבי בדיקה ומיקום. מתחת לכל קוד אפשר לרשום מה עשית ולצרף תמונות — לפעם הבאה."],
    ["🔗","סורק OBD","מחברים מתאם ELM327 BLE לשקע ה-OBD וקוראים ומוחקים קודים ישירות מהרכב (Chrome באנדרואיד)."],
    ["📋","יומן עבודה","מתעדים כל רכב: תיאור, קודים, עלות, זמן עבודה ותמונות. אפשר להדפיס, לשתף בוואטסאפ ולייצא לאקסל."],
    ["💾","הנתונים שלך","הכל נשמר רק במכשיר שלך. כדאי לגבות לקובץ מדי פעם (עוד ← הגדרות). את השם שלך לדוחות מגדירים שם."],
  ];
  const tabs = [["home","🏠","בית"],["code","⚠️","קוד"],["scan","🔗","סורק"],["log","📋","יומן"],["more","☰","עוד"]];
  const activeTab = sub ? sub.from : tab;
  const fmtT = ms => `${Math.floor(ms/3600000)}:${String(Math.floor((ms%3600000)/60000)).padStart(2,"0")}:${String(Math.floor((ms%60000)/1000)).padStart(2,"0")}`;
  const overlay = { position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,.6)", display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" };

  return (
    <div dir={dir} lang={settings.lang} style={{ fontFamily:"'Segoe UI',Tahoma,Arial,sans-serif", background:S.bg, color:S.text, minHeight:"100vh", zoom:settings.zoom }}>
      <div ref={topRef}/>
      {Header()}
      <main style={{ padding:"10px", paddingBottom:"calc(88px + env(safe-area-inset-bottom))", maxWidth:"720px", margin:"0 auto" }}>
        {sub ? <>
          {sub.id==="obd" && ObdScreen()}{sub.id==="diag" && DiagScreen()}{sub.id==="sensors" && SensorsScreen()}{sub.id==="wires" && WiresScreen()}
          {sub.id==="convert" && ConvertScreen()}{sub.id==="all" && AllScreen()}{sub.id==="settings" && SettingsScreen()}{sub.id==="about" && AboutScreen()}{sub.id==="lib" && LibScreen()}{sub.id==="circuits" && CircuitsScreen()}{sub.id==="trees" && TreesScreen()}{sub.id==="ref" && RefScreen()}{sub.id==="calc" && CalcScreen()}
        </> : <>
          {tab==="home" && Home()}{tab==="code" && CodeTab()}{tab==="scan" && ScanTab()}{tab==="log" && LogTab()}{tab==="more" && MoreTab()}
        </>}
        <footer style={{ marginTop:"16px", textAlign:"center", color:S.muted, fontSize:"11px", lineHeight:1.6 }}>
          <div>🔧 AutoDiag Pro · v{APP_VERSION} · <a href={ABOUT.link} target="_blank" rel="noopener noreferrer" style={{ color:S.acc }}>AppNest</a></div>
          <div>{L(ABOUT.creator)}</div><div>{L(ABOUT.copy)}</div>
          <div style={{ marginTop:"4px" }}>⚠️ {T("מידע כללי בלבד — יש לאמת מול נתוני היצרן. השימוש באחריות המשתמש.")}</div>
        </footer>
      </main>
      <input ref={importRef} type="file" accept=".json,application/json" onChange={doImport} style={{ display:"none" }}/>

      {/* bottom navigation */}
      <nav aria-label={T("ניווט ראשי")} style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:60, background:S.card, borderTop:`1px solid ${S.bdr}`, display:"grid", gridTemplateColumns:"repeat(5,1fr)", paddingBottom:"env(safe-area-inset-bottom)", boxShadow:`0 -4px 14px ${S.shadow}` }}>
        {tabs.map(([id,ic,lb])=>{ const on = activeTab===id; return <button key={id} onClick={()=>goTab(id)} aria-current={on?"page":undefined} style={{ background:"transparent", border:"none", padding:"8px 2px 7px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:"2px", color:on?S.acc:S.muted, fontFamily:"inherit", minHeight:"56px", borderTop:`3px solid ${on?S.acc:"transparent"}` }}><span style={{ fontSize:"20px", lineHeight:1 }}>{ic}</span><span style={{ fontSize:"11px", fontWeight:on?800:600 }}>{T(lb)}</span></button>; })}
      </nav>

      {/* history */}
      {showHist && <div style={overlay} onClick={()=>setShowHist(false)}><div onClick={e=>e.stopPropagation()} style={{ background:S.card, borderRadius:"16px", border:`1px solid ${S.bdr}`, width:"100%", maxWidth:"420px", maxHeight:"70vh", overflow:"auto", padding:"14px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}><strong style={{ color:S.acc }}>🕐 {T("היסטוריית חיפושים")}</strong><div>{history.length>0&&<IconBtn label={T("נקה היסטוריה")} onClick={()=>askConfirm({ text:T("לנקות את היסטוריית החיפושים?"), ok:T("נקה"), danger:true, onOk:()=>setHistory([]) })}>🗑️</IconBtn>}<IconBtn label={T("סגור")} onClick={()=>setShowHist(false)}>✕</IconBtn></div></div>
        {history.length===0 ? <p style={{ color:S.muted, fontSize:"13px", textAlign:"center", padding:"10px" }}>{T("עדיין אין")}</p> : history.slice().reverse().map((h,i)=> <button key={i} onClick={()=>searchCode(h.code)} style={rowBtn()}><span style={{ color:S.acc, fontWeight:700, fontFamily:"monospace" }}>{h.code}</span><span style={{ color:S.muted, fontSize:"11px", flex:1, textAlign:"end" }}>{fmtDate(h.at,h.ts)}</span></button>)}
      </div></div>}

      {/* work-log edit sheet (delete lives only here) */}
      {wlSheet && <div style={{ ...overlay, alignItems:"stretch", padding:0 }}><div style={{ background:S.bg, width:"100%", maxWidth:"720px", margin:"0 auto", overflow:"auto", display:"flex", flexDirection:"column" }}>
        <div style={{ position:"sticky", top:0, background:S.card, borderBottom:`2px solid ${S.acc}`, padding:"8px 10px", display:"flex", alignItems:"center", gap:"8px", zIndex:2 }}>
          <button onClick={closeSheet} style={{ background:"transparent", border:`1px solid ${S.bdr}`, color:S.acc, borderRadius:"10px", padding:"8px 12px", fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", minHeight:"40px" }}>{backArrow} {T("יומן")}</button>
          <h2 style={{ fontSize:"16px", margin:0, color:S.text }}>{wlSheet.id?T("עריכת רשומה"):T("רכב חדש ביומן")}</h2>
        </div>
        <div style={{ padding:"12px", display:"flex", flexDirection:"column", gap:"10px", flex:1 }}>
          <label style={{ color:S.sub, fontSize:"12px", fontWeight:700 }}>{T("מספר רכב / זיהוי")}<div style={{ display:"flex", gap:"6px", marginTop:"4px" }}><Field value={wlPlate} onChange={e=>setWlPlate(e.target.value)} placeholder="12-345-67" style={{ fontSize:"16px", fontWeight:700 }}/><Btn kind="ghost" label={T("חפש במשרד התחבורה")} disabled={plateBusy} onClick={()=>lookupPlate(wlPlate, v=>{ setWlVeh(v); setWlPlate(fmtPlate(v.plate)); })}>{plateBusy?"⏳":"🔎"}</Btn></div></label>
          {plateMsg && !wlVeh && <p style={{ color:S.warn, fontSize:"12px", margin:0 }}>{plateMsg}</p>}
          {wlVeh && <div style={{ display:"flex", alignItems:"center", gap:"6px", background:S.inner, borderRadius:"10px", padding:"7px 10px" }}><span style={{ flex:1, color:S.text, fontSize:"13px", fontWeight:600 }} dir="auto">🚗 {vehLabel(wlVeh)}{wlVeh.engineCode?` · ${wlVeh.engineCode}`:""}</span><IconBtn label={T("הסר רכב מהרשומה")} onClick={()=>setWlVeh(null)}>✕</IconBtn></div>}
          <label style={{ color:S.sub, fontSize:"12px", fontWeight:700 }}>{T("תיאור העבודה")}<Field area rows={5} value={wlDesc} onChange={e=>setWlDesc(e.target.value)} placeholder={T("תקלות שנמצאו, מה נבדק, מה הוחלף...")} style={{ marginTop:"4px" }}/></label>
          {wlCodes.length>0 && <div><div style={{ color:S.sub, fontSize:"12px", fontWeight:700, marginBottom:"4px" }}>{T("קודים")}</div><div style={{ display:"flex", gap:"5px", flexWrap:"wrap" }}>{wlCodes.map(c=> <Chip key={c} mono active onClick={()=>setWlCodes(p=>p.filter(x=>x!==c))}>{c} ✕</Chip>)}</div></div>}
          <div style={{ display:"flex", gap:"8px" }}>
            <label style={{ flex:1, color:S.sub, fontSize:"12px", fontWeight:700 }}>💰 {T("עלות (₪)")}<Field type="number" inputMode="decimal" value={wlCost} onChange={e=>setWlCost(e.target.value)} style={{ marginTop:"4px", direction:"ltr", textAlign:"center" }}/></label>
            <label style={{ flex:1, color:S.sub, fontSize:"12px", fontWeight:700 }}>⏱️ {T("שעות")}<Field type="number" inputMode="decimal" step="0.1" value={wlHours} onChange={e=>setWlHours(e.target.value)} style={{ marginTop:"4px", direction:"ltr", textAlign:"center" }}/></label>
          </div>
          <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
            <Btn kind={timerOn?"danger":"ghost"} onClick={()=>{ if(timerOn) setTimerOn(false); else { setTimerStart(Date.now()-timerElapsed); setTimerOn(true); } }} style={{ flex:1 }}>{timerOn?"⏸️ "+T("עצור סטופר"):"⏱️ "+T("סטופר עבודה")}</Btn>
            {timerElapsed>0 && <span style={{ color:S.blue, fontSize:"17px", fontWeight:700, fontFamily:"monospace", direction:"ltr" }}>{fmtT(timerElapsed)}</span>}
            {timerElapsed>0 && !timerOn && <IconBtn label={T("אפס")} onClick={()=>setTimerElapsed(0)}>🔄</IconBtn>}
          </div>
          {wlImgs.length>0 && <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>{wlImgs.map((im,j)=> <div key={j} style={{ position:"relative" }}><img src={im} alt="" onClick={()=>setImgView(im)} style={{ width:"70px", height:"70px", objectFit:"cover", borderRadius:"8px" }}/><button aria-label={T("הסר תמונה")} onClick={()=>setWlImgs(p=>p.filter((_,k)=>k!==j))} style={{ position:"absolute", top:"-6px", insetInlineEnd:"-6px", background:S.red, border:"none", color:"#fff", borderRadius:"50%", width:"22px", height:"22px", fontSize:"12px", cursor:"pointer" }}>✕</button></div>)}</div>}
          <input ref={wlFRef} type="file" accept="image/*" multiple onChange={onWlFiles} style={{ display:"none" }}/>
          <Btn kind="ghost" onClick={()=>wlFRef.current?.click()}>📷 {T("הוסף תמונה")}</Btn>
          <div style={{ flex:1 }}/>
          <div style={{ display:"flex", gap:"8px" }}>
            <Btn kind="green" onClick={saveSheet} style={{ flex:2, fontSize:"15px" }}>💾 {T("שמור")}</Btn>
            {wlSheet.id && <Btn kind="danger" onClick={deleteSheet} style={{ flex:1 }}>🗑️ {T("מחק")}</Btn>}
          </div>
        </div>
      </div></div>}

      {/* image viewer */}
      {imgView && <div style={{ ...overlay, zIndex:300, background:"rgba(0,0,0,.92)" }} onClick={()=>setImgView(null)}><img src={imgView} alt="" style={{ maxWidth:"100%", maxHeight:"90vh", borderRadius:"8px" }}/></div>}

      {dgSheet && <DiagramSheet key={dgSheet.meta?dgSheet.meta.id:"new"} init={dgSheet.meta} preset={dgVeh()} busy={dgBusy} onSave={saveDiagram} onDelete={deleteDiagram} onClose={()=>setDgSheet(null)} askConfirm={askConfirm} backArrow={backArrow}/>}
      {dgView && <DiagramViewer meta={dgView} onClose={()=>setDgView(null)} onMarks={mk=>setMarks(dgView.id, mk)} onEdit={()=>setDgSheet({ meta:dgView })} askConfirm={askConfirm} backArrow={backArrow}/>}
      {!assistOpen && !dgView && !dgSheet && !wlSheet && guideStep<0 && <button onClick={openAssist} aria-label={T("העוזר")} style={{ position:"fixed", zIndex:60, bottom:"calc(78px + env(safe-area-inset-bottom))", insetInlineEnd:"14px", width:"54px", height:"54px", borderRadius:"50%", border:`2px solid ${S.acc}`, background:S.card, color:S.acc, fontSize:"26px", boxShadow:"0 4px 14px rgba(0,0,0,.45)", cursor:"pointer" }}>🤖</button>}
      {assistOpen && <AssistantPanel onClose={()=>setAssistOpen(false)} getCtx={assistCtx} messages={chat} setMessages={setChat} aiCfg={aiCfg} setAiCfg={setAiCfg} onAction={assistAct} actLabel={assistActLabel} askConfirm={askConfirm} backArrow={backArrow} view={assistView} setView={setAssistView}/>}
      {/* onboarding guide */}
      {guideStep>=0 && <div style={{ ...overlay, zIndex:400 }}><div role="dialog" aria-modal="true" style={{ background:S.card, borderRadius:"18px", border:`2px solid ${S.acc}`, width:"100%", maxWidth:"380px", padding:"22px 18px", textAlign:"center" }}>
        <div style={{ fontSize:"46px" }}>{guideSteps[guideStep][0]}</div>
        <h2 style={{ color:S.acc, fontSize:"19px", margin:"6px 0 8px" }}>{T(guideSteps[guideStep][1])}</h2>
        <p style={{ color:S.sub, fontSize:"14px", lineHeight:1.65, margin:"0 0 16px" }}>{T(guideSteps[guideStep][2])}</p>
        <div style={{ display:"flex", justifyContent:"center", gap:"6px", marginBottom:"16px" }}>{guideSteps.map((_,i)=> <span key={i} style={{ width:i===guideStep?"20px":"8px", height:"8px", borderRadius:"4px", background:i===guideStep?S.acc:S.bdr }}/>)}</div>
        <div style={{ display:"flex", gap:"8px" }}>
          <Btn kind="ghost" onClick={finishGuide} style={{ flex:1 }}>{T("דלג")}</Btn>
          {guideStep>0 && <Btn kind="ghost" onClick={()=>setGuideStep(guideStep-1)} style={{ flex:1 }}>{T("הקודם")}</Btn>}
          <Btn onClick={()=>guideStep<guideSteps.length-1?setGuideStep(guideStep+1):finishGuide()} style={{ flex:1 }}>{guideStep<guideSteps.length-1?T("הבא"):T("בואו נתחיל")}</Btn>
        </div>
        {guideStep===0 && <div style={{ display:"flex", justifyContent:"center", gap:"6px", marginTop:"14px" }}><Chip active={settings.lang==="he"} onClick={()=>setS({ lang:"he" })}>עברית</Chip><Chip active={settings.lang==="en"} onClick={()=>setS({ lang:"en" })}>English</Chip></div>}
      </div></div>}

      {/* confirm dialog */}
      {confirmBox && <div style={{ ...overlay, zIndex:500 }} onClick={()=>setConfirmBox(null)}><div role="alertdialog" aria-modal="true" onClick={e=>e.stopPropagation()} style={{ background:S.card, borderRadius:"16px", border:`1px solid ${confirmBox.danger?S.red:S.bdr}`, width:"100%", maxWidth:"360px", padding:"18px" }}>
        <p style={{ color:S.text, fontSize:"15px", lineHeight:1.6, margin:"0 0 16px" }}>{confirmBox.text}</p>
        <div style={{ display:"flex", gap:"8px" }}>
          <Btn kind="ghost" onClick={()=>setConfirmBox(null)} style={{ flex:1 }}>{T("ביטול")}</Btn>
          <Btn kind={confirmBox.danger?"danger":"primary"} onClick={()=>{ const f = confirmBox.onOk; setConfirmBox(null); f&&f(); }} style={{ flex:1, ...(confirmBox.danger?{ background:S.red, color:"#fff" }:{}) }}>{confirmBox.ok||T("אישור")}</Btn>
        </div>
      </div></div>}

      {toastMsg && <div role="status" aria-live="polite" onClick={()=>setToastMsg("")} style={{ position:"fixed", bottom:"calc(76px + env(safe-area-inset-bottom))", left:"12px", right:"12px", zIndex:600, background:S.text, color:S.bg, borderRadius:"12px", padding:"11px 14px", fontSize:"13px", lineHeight:1.5, textAlign:"center", boxShadow:`0 6px 20px ${S.shadow}`, maxWidth:"520px", margin:"0 auto" }}>{toastMsg}</div>}
    </div>
  );
}
