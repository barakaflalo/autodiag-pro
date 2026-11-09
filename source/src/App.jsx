import { useState, useRef, useEffect } from "react";
import { CODES_DB, CAR_MODELS, CAR_MAKES, SYMPTOMS, SENSOR_REF, WIRE_TYPES, WIRE_COLORS, CONVERSIONS, BATTERY_TABLE, DICT } from "./data.js";
import { CODES_EN, SAFE_EN, SYMPTOMS_EN, SENSORS_EN, WIRE_TYPES_EN, WIRE_COLORS_EN, CONV_CAT_EN, BATTERY_EN } from "./data_en.js";
import { APP_VERSION, ABOUT, ctx, L, uid, esc, loadData, saveData, deleteData, resizeImage, openExt, toast, doPrint, shareText, shareWhatsApp, elmLines, protoName, isCanProto, parsePID, parseDTCs } from "./lib.js";
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
  const [scanDTCs,setScanDTCs] = useState([]); const [scanLive,setScanLive] = useState({}); const [scanLog,setScanLog] = useState([]);
  const scanBuf = useRef(""); const scanCh = useRef(null); const scanWaiter = useRef(null); const scanQueue = useRef(Promise.resolve()); const scanProto = useRef("");
  // refs
  const rRef = useRef(null); const wlFRef = useRef(null); const importRef = useRef(null); const topRef = useRef(null);
  const hist = useRef({ guard:false }); const exitArm = useRef(false); const backRef = useRef(()=>{}); const pressT = useRef(null);

  // apply language + theme before painting children
  ctx.lang = settings.lang; ctx.user = { name:settings.name, phone:settings.phone };
  applyTheme(settings.theme);
  const dir = settings.lang==="en" ? "ltr" : "rtl";

  // ─── load ───
  useEffect(()=>{ (async()=>{
    const [n,f,h,w,st] = await Promise.all([loadData("adp_notes",{}),loadData("adp_favs",[]),loadData("adp_history",[]),loadData("adp_worklog",[]),loadData("adp_settings",DEFAULT_SETTINGS)]);
    const s2 = { ...DEFAULT_SETTINGS, ...st };
    setNotes(n); setFavs(f); setHistory(h); setWorkLog(w); setSettings(s2); setLoaded(true);
    if(!s2.guideDone) setGuideStep(0);
  })(); },[]);
  useEffect(()=>{ if(loaded) saveData("adp_notes",notes); },[notes,loaded]);
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
    if(wlSheet){ closeSheet(); return; }
    if(showHist){ setShowHist(false); return; }
    if(sub){ setTab(sub.from); setSub(null); return; }
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
  function openSub(id){ setSub({ id, from: sub ? sub.from : tab }); }
  const SUB_TITLES = { obd:"מיקום שקע OBD", diag:"מחשבון אבחון", sensors:"חיישנים ומצבר", wires:"חיווט", convert:"ממיר ומחשבון אוהם", all:"מאגר קודים", settings:"הגדרות", about:"אודות" };
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
  function openSheet(entry, presetCodes){
    if(entry){ setWlPlate(entry.plate||""); setWlDesc(entry.desc||""); setWlImgs(entry.images||[]); setWlCost(entry.cost||""); setWlHours(entry.hours||""); setWlCodes(entry.codes||[]); setWlSheet({ id:entry.id }); }
    else { setWlPlate(""); setWlDesc(""); setWlImgs([]); setWlCost(""); setWlHours(""); setWlCodes(presetCodes||[]); setWlSheet({ id:null }); }
  }
  function closeSheet(){ setWlSheet(null); setTimerOn(false); }
  function saveSheet(){
    if(!wlPlate.trim()){ toast(T("נא למלא מספר רכב / זיהוי")); return; }
    const hrs = wlHours || (timerElapsed>0 ? (timerElapsed/3600000).toFixed(2) : "");
    if(wlSheet.id){ setWorkLog(p=>p.map(w=>w.id===wlSheet.id?{ ...w, plate:wlPlate.trim(), desc:wlDesc.trim(), images:[...wlImgs], cost:wlCost, hours:hrs, codes:wlCodes }:w)); }
    else { setWorkLog(p=>[{ id:uid(), plate:wlPlate.trim(), desc:wlDesc.trim(), images:[...wlImgs], at:new Date().toISOString(), ts:new Date().toLocaleString("he-IL"), codes:wlCodes, cost:wlCost, hours:hrs }, ...p]); }
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
    const data = { app:"AutoDiag Pro", version:APP_VERSION, exported:new Date().toISOString(), user:settings.name||"", summary:{ worklog:workLog.length, notes:Object.values(notes).reduce((a,b)=>a+b.length,0), favorites:favs.length }, notes, favs, history, workLog, settings };
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
        setNotes(d.notes||{}); setFavs(d.favs||[]); setHistory(d.history||[]); setWorkLog(d.workLog||[]);
        if(d.settings) setSettings(p=>({ ...p, ...d.settings, guideDone:true }));
        toast(T("✅ הגיבוי שוחזר"));
      } });
    };
    r.readAsText(file);
  }
  function deleteAll(){
    askConfirm({ text:T("למחוק את כל הנתונים? (יומן, הערות, תמונות, מועדפים, היסטוריה)"), ok:T("המשך"), danger:true, onOk:()=>setTimeout(()=>askConfirm({ text:T("בטוח? הפעולה לא ניתנת לביטול. מומלץ לגבות קודם."), ok:T("מחק הכל"), danger:true, onOk:async()=>{
      await Promise.all(["adp_notes","adp_favs","adp_history","adp_worklog"].map(deleteData));
      setNotes({}); setFavs([]); setHistory([]); setWorkLog([]); toast(T("כל הנתונים נמחקו"));
    } }),50) });
  }
  function shareApp(){
    const url = ABOUT.link.includes("appnest") ? location.origin + location.pathname : location.href;
    if(navigator.share){ navigator.share({ title:"AutoDiag Pro", text:T("אפליקציית אבחון רכב לחשמלאי רכב"), url }).catch(()=>{}); }
    else { try{ navigator.clipboard.writeText(url); toast(T("הקישור הועתק")); }catch(e){ openExt(url); } }
  }

  // ─── ELM327 scanner ───
  const BLE_PROFILES = [
    { name:"Vgate iCar Pro", svc:"e7810a71-73ae-499d-8c15-faa9aef0c3f2", tx:"bef8d6c9-9c21-4c9e-b632-bd58c1009f9f", rx:"bef8d6c9-9c21-4c9e-b632-bd58c1009f9f" },
    { name:"Vgate (FFF0)", svc:"0000fff0-0000-1000-8000-00805f9b34fb", tx:"0000fff2-0000-1000-8000-00805f9b34fb", rx:"0000fff1-0000-1000-8000-00805f9b34fb" },
    { name:"Generic ELM327", svc:"0000ffe0-0000-1000-8000-00805f9b34fb", tx:"0000ffe1-0000-1000-8000-00805f9b34fb", rx:"0000ffe1-0000-1000-8000-00805f9b34fb" },
    { name:"KONNWEI/Generic2", svc:"0000ffe5-0000-1000-8000-00805f9b34fb", tx:"0000ffe9-0000-1000-8000-00805f9b34fb", rx:"0000ffe9-0000-1000-8000-00805f9b34fb" },
    { name:"OBDLink", svc:"0000fef1-0000-1000-8000-00805f9b34fb", tx:"0000fef2-0000-1000-8000-00805f9b34fb", rx:"0000fef2-0000-1000-8000-00805f9b34fb" },
  ];
  const slog = m => setScanLog(p=>[...p.slice(-199), m]);
  async function scanConnect(){
    if(!navigator.bluetooth){ setScanStatus("unsupported"); return; }
    try{
      setScanStatus("searching"); slog("🔍 "+T("מחפש מתאמים..."));
      const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices:true, optionalServices:BLE_PROFILES.map(p=>p.svc) });
      setScanStatus("connecting"); setScanDev(dev); slog("📡 "+T("מתחבר ל-{n}...",{ n:dev.name||"Unknown" }));
      dev.addEventListener("gattserverdisconnected",()=>{ scanCh.current=null; setScanStatus("disconnected"); if(scanWaiter.current){ const w=scanWaiter.current; scanWaiter.current=null; w(scanBuf.current); } slog("🔌 "+T("המתאם התנתק")); });
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
      scanCh.current = writeCh; slog("⚙️ "+T("אתחול ELM327..."));
      const id = await scanSendCmd("ATZ",4000);
      const ver = (elmLines(id).find(l=>/ELM|v\d/i.test(l))||"").trim();
      slog(ver ? "🔧 "+ver : "⚠️ "+T("המתאם לא ענה ל-ATZ (ממשיך בכל זאת)"));
      for(const cmd of ["ATE0","ATL0","ATS0","ATH0","ATAT1","ATSP0"]) await scanSendCmd(cmd,2500);
      const volt = elmLines(await scanSendCmd("ATRV",2500)).find(l=>/\d/.test(l));
      if(volt) setScanLive(p=>({ ...p, voltage:volt.replace(/[^\d.]/g,"") }));
      slog("🚗 "+T("מתחבר למחשב הרכב (זה יכול לקחת עד 10 שניות)..."));
      const probeLines = elmLines(await scanSendCmd("0100",12000));
      if(probeLines.some(l=>/UNABLE TO CONNECT|NO DATA|ERROR/i.test(l)) || !probeLines.some(l=>/^41/.test(l.replace(/\s/g,""))))
        slog("⚠️ "+T("המתאם מחובר, אבל מחשב הרכב לא ענה ({r}). ודא שההצתה דלוקה (ON) ונסה שוב.",{ r:probeLines.join(" | ")||T("אין תשובה") }));
      scanProto.current = elmLines(await scanSendCmd("ATDPN",2500)).join("").replace(/^A/i,"").trim();
      slog("📶 "+T("פרוטוקול: {p}",{ p:protoName(scanProto.current) }));
      setScanStatus("connected"); slog("✅ "+T("מחובר ומוכן! ({n})",{ n:profile.name }));
    }catch(err){
      const m = String(err&&err.message||err);
      setScanStatus(/cancel/i.test(m)?"disconnected":"error");
      slog(/cancel/i.test(m) ? "ℹ️ "+T("החיפוש בוטל") : "❌ "+m);
    }
  }
  function scanDisconnect(){ try{ if(scanDev?.gatt?.connected) scanDev.gatt.disconnect(); }catch(e){} scanCh.current=null; setScanDev(null); setScanStatus("disconnected"); setScanDTCs([]); setScanLive({}); slog("🔌 "+T("מנותק")); }
  // one command at a time; resolves at the ">" prompt or on timeout
  function scanSendCmd(cmd, timeout=5000){
    const run = () => new Promise(resolve=>{
      const ch = scanCh.current; if(!ch){ resolve(""); return; }
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
    if(!scanCh.current) return; slog("📡 "+T("קורא קודים..."));
    const raw = await scanSendCmd("03",8000); const lines = elmLines(raw);
    if(lines.some(l=>/UNABLE TO CONNECT|ERROR/i.test(l))){ slog("⚠️ "+T("תשובת המתאם: {r}",{ r:lines.join(" | ") })); return; }
    const codes = parseDTCs(raw,"43",isCanProto(scanProto.current));
    setScanDTCs(codes); slog(codes.length ? "🔍 "+T("נמצאו {n} קודים: {c}",{ n:codes.length, c:codes.join(", ") }) : "✅ "+T("אין קודי תקלה!"));
  }
  function scanClearDTCs(){
    if(!scanCh.current) return;
    askConfirm({ text:T("למחוק את קודי התקלה מהרכב? גם נתוני Freeze Frame ומצב המוכנות יימחקו. מומלץ עם הצתה דלוקה ומנוע כבוי."), ok:T("מחק קודים"), danger:true, onOk:async()=>{
      const lines = elmLines(await scanSendCmd("04",8000));
      if(lines.some(l=>/^44/.test(l.replace(/\s/g,"")))){ setScanDTCs([]); slog("🗑️ "+T("קודים נמחקו!")); }
      else slog("⚠️ "+T("לא התקבל אישור מחיקה ({r}). נסה שוב עם מנוע כבוי והצתה דלוקה.",{ r:lines.join(" | ")||T("אין תשובה") }));
    } });
  }
  async function scanReadPID(pid,name,parse){ const data = parsePID(await scanSendCmd("01"+pid,4000),pid); setScanLive(p=>({ ...p, [name]: data ? parse(data) : "N/A" })); }
  async function scanReadAllLive(){
    if(!scanCh.current) return; slog("📊 "+T("קורא נתונים..."));
    await scanReadPID("0C","rpm",b=>(parseInt(b.slice(0,4),16)/4).toFixed(0));
    await scanReadPID("0D","speed",b=>parseInt(b.slice(0,2),16).toString());
    await scanReadPID("05","coolant",b=>(parseInt(b.slice(0,2),16)-40).toString());
    await scanReadPID("42","voltage",b=>(parseInt(b.slice(0,4),16)/1000).toFixed(1));
    await scanReadPID("04","load",b=>(parseInt(b.slice(0,2),16)*100/255).toFixed(0));
    await scanReadPID("06","stft1",b=>((parseInt(b.slice(0,2),16)-128)*100/128).toFixed(1));
    slog("✅ "+T("נתונים התקבלו"));
  }

  // ─── derived ───
  const actualMake = make==="__custom__" ? makeCustom : make;
  const modelsList = make && make!=="__custom__" ? (CAR_MODELS[make]||[]) : [];
  const actualModel = make==="__custom__" ? modelCustom : (model==="__custom__" ? modelCustom : model);
  const vehicle = actualMake && actualModel ? `${actualMake} ${actualModel} ${year}`.trim() : "";
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
      const fromName = T(TAB_NAMES[sub.from]||"בית");
      return <div style={{ position:"sticky", top:0, zIndex:50, background:S.card, borderBottom:`2px solid ${S.acc}`, padding:"8px 10px", display:"flex", alignItems:"center", gap:"8px" }}>
        <button onClick={()=>{ setTab(sub.from); setSub(null); }} style={{ background:"transparent", border:`1px solid ${S.bdr}`, color:S.acc, borderRadius:"10px", padding:"8px 12px", fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", minHeight:"40px", whiteSpace:"nowrap" }}>{backArrow} {fromName}</button>
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
      ["🔌","מיקום שקע OBD",()=>openSub("obd")],["🩺","מחשבון אבחון",()=>openSub("diag")],["📊","חיישנים ומצבר",()=>openSub("sensors")],
      ["🧵","חיווט",()=>openSub("wires")],["🔄","ממיר ואוהם",()=>openSub("convert")],["📚","מאגר קודים",()=>openSub("all")],
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
          {res.nts.map(({ k,n })=> <button key={n.id} onClick={()=>{ setHomeQuery(""); if(k.startsWith("c_")) searchCode(k.slice(2)); }} style={rowBtn()}><span>📝</span><span style={{ color:S.acc, fontFamily:"monospace" }}>{k.replace(/^c_|^obd_/,"")}</span><span style={{ color:S.sub, fontSize:"12px", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{n.text}</span></button>)}
          {!res.codes.length&&!res.logs.length&&!res.nts.length && <p style={{ color:S.muted, fontSize:"12px", textAlign:"center", padding:"8px" }}>{T("לא נמצאו תוצאות")}</p>}
        </div>}
      </Card>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px", marginBottom:"10px" }}>
        {tiles.map(([ic,lb,fn])=> <button key={lb} onClick={fn} style={{ background:S.card, border:`1px solid ${S.bdr}`, borderRadius:"14px", padding:"14px 6px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:"6px", fontFamily:"inherit", minHeight:"88px" }}>
          <span style={{ fontSize:"26px" }}>{ic}</span><span style={{ color:S.text, fontSize:"12px", fontWeight:700, lineHeight:1.25, textAlign:"center" }}>{T(lb)}</span>
        </button>)}
      </div>
      {favs.length>0 && <Card title={"⭐ "+T("מועדפים")}><div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>{favs.map(f=> <Chip key={f} mono active onClick={()=>searchCode(f)}>{f}</Chip>)}</div></Card>}
      {recent.length>0 && <Card title={"🕐 "+T("חיפושים אחרונים")}><div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>{recent.map(f=> <Chip key={f} mono onClick={()=>searchCode(f)}>{f}</Chip>)}</div></Card>}
      <Card title={"🎨 "+T("עיצוב")}>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>{THEME_ORDER.map(k=> <button key={k} onClick={()=>setS({ theme:k })} aria-label={L(THEMES[k])} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"6px 10px", borderRadius:"10px", border:`2px solid ${settings.theme===k?S.acc:S.bdr}`, background:"transparent", cursor:"pointer", color:S.sub, fontSize:"12px", fontFamily:"inherit", minHeight:"38px" }}><span style={{ width:"18px", height:"18px", borderRadius:"50%", background:THEMES[k].bg, border:`3px solid ${THEMES[k].acc}` }}/>{L(THEMES[k])}</button>)}</div>
      </Card>
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
          <div style={{ marginTop:"10px" }}><Btn kind="ghost" onClick={()=>{ setTab("log"); openSheet(null,[ci.code]); }} style={{ width:"100%" }}>📋 {T("פתח רשומת יומן עם הקוד הזה")}</Btn></div>
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
    return <>
      <Card title={"🔗 "+T("חיבור לסורק ELM327")}>
        <p style={{ color:S.muted, fontSize:"12px", margin:"0 0 10px" }}>{T("חבר מתאם ELM327 BLE לשקע OBD, הדלק הצתה ולחץ התחבר. עובד ב-Chrome באנדרואיד ובמחשב.")}</p>
        {scanStatus==="unsupported" && <div style={{ background:`${S.red}18`, border:`1px solid ${S.red}`, borderRadius:"10px", padding:"9px", marginBottom:"10px" }}><p style={{ color:S.red, fontSize:"12px", margin:0 }}>⚠️ {T("הדפדפן לא תומך ב-Web Bluetooth. השתמש ב-Chrome באנדרואיד או במחשב.")}</p></div>}
        {scanStatus!=="connected"
          ? <Btn kind="green" disabled={busy} onClick={scanConnect} style={{ width:"100%" }}>{scanStatus==="searching"?"🔍 "+T("מחפש..."):scanStatus==="connecting"?"🔄 "+T("מתחבר..."):"🔗 "+T("התחבר לסורק")}</Btn>
          : <div style={{ display:"flex", gap:"8px" }}><Btn kind="danger" onClick={scanDisconnect} style={{ flex:1 }}>🔌 {T("נתק")}</Btn><span style={{ display:"flex", alignItems:"center", color:S.green, fontWeight:700, fontSize:"13px", padding:"0 10px", border:`1px solid ${S.green}`, borderRadius:"10px" }}>● {T("מחובר")}</span></div>}
      </Card>
      {scanStatus==="connected" && <>
        <Card title={"📡 "+T("קריאת ומחיקת קודים")}>
          <div style={{ display:"flex", gap:"8px" }}><Btn onClick={scanReadDTCs} style={{ flex:1 }}>🔍 {T("קרא קודים")}</Btn><Btn kind="danger" onClick={scanClearDTCs} style={{ flex:1 }}>🗑️ {T("מחק קודים")}</Btn></div>
          {scanDTCs.length>0 && <div style={{ marginTop:"10px" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>{scanDTCs.map(c=> <button key={c} onClick={()=>searchCode(c)} style={{ ...rowBtn(), border:`1px solid ${S.acc}`, borderRadius:"10px" }}><span style={{ color:S.acc, fontWeight:700, fontFamily:"monospace" }}>{c}</span><span style={{ color:S.sub, fontSize:"12px" }}>{codeTitle(c)||T("לא במאגר")}</span></button>)}</div>
            <Btn kind="ghost" onClick={()=>{ setTab("log"); openSheet(null,scanDTCs); }} style={{ width:"100%", marginTop:"8px" }}>📋 {T("שמור את הקודים ביומן")}</Btn>
          </div>}
        </Card>
        <Card title={"📊 "+T("נתונים בזמן אמת")}>
          <Btn kind="blue" onClick={scanReadAllLive} style={{ width:"100%", marginBottom:"10px" }}>🔄 {T("קרא נתונים")}</Btn>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"6px" }}>
            {[{ k:"rpm", l:"סל\"ד", u:"RPM" },{ k:"speed", l:"מהירות", u:"km/h" },{ k:"coolant", l:"טמפ׳ מים", u:"°C" },{ k:"voltage", l:"מתח", u:"V" },{ k:"load", l:"עומס", u:"%" },{ k:"stft1", l:"STFT B1", u:"%" }].map(p=> <div key={p.k} style={{ background:S.inner, borderRadius:"10px", padding:"8px", textAlign:"center" }}><p style={{ color:S.muted, fontSize:"11px", margin:"0 0 2px" }}>{T(p.l)}</p><span style={{ color:S.acc, fontSize:"18px", fontWeight:800, fontFamily:"monospace" }}>{scanLive[p.k]||"—"}</span><p style={{ color:S.muted, fontSize:"10px", margin:"2px 0 0" }}>{p.u}</p></div>)}
          </div>
        </Card>
      </>}
      <Card title={"📋 "+T("יומן סורק")} actions={scanLog.length>0&&<IconBtn label={T("נקה")} onClick={()=>setScanLog([])}>🧹</IconBtn>}>{scanLog.length===0 ? <p style={{ color:S.muted, fontSize:"12px", textAlign:"center" }}>{T("עדיין לא התחברת")}</p> : <div style={{ maxHeight:"220px", overflowY:"auto", direction:"ltr", textAlign:dir==="rtl"?"right":"left" }}>{scanLog.map((l,i)=> <p key={i} dir="auto" style={{ color:S.sub, fontSize:"12px", margin:"3px 0", borderBottom:`1px solid ${S.bdr}`, paddingBottom:"3px", fontFamily:"monospace" }}>{l}</p>)}</div>}</Card>
      <Card title={"💡 "+T("מדריך")}><div style={{ fontSize:"13px", color:S.sub, lineHeight:1.7 }}>
        <p>1. {T("קנה מתאם ELM327 BLE (למשל Vgate iCar Pro BT 4.0)")}</p><p>2. {T("חבר לשקע OBD-II ברכב והדלק הצתה")}</p><p>3. {T("הפעל Bluetooth ומיקום בטלפון")}</p><p>4. {T("לחץ \"התחבר\" ובחר את המתאם (למשל IOS-Vlink)")}</p>
        <p style={{ color:S.warn }}>⚠️ {T("דרוש מתאם BLE — מתאם Bluetooth קלאסי (BT 2.0/3.0) או WiFi לא יתחבר מהדפדפן.")}</p>
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
          <div style={{ minWidth:0 }}><div style={{ color:S.acc, fontWeight:800, fontSize:"16px" }} dir="auto">{w.plate}</div><div style={{ color:S.muted, fontSize:"11px" }}>{fmtDate(w.at,w.ts)}</div></div>
          <div style={{ display:"flex", flexShrink:0 }}>
            <IconBtn label={T("שתף")} onClick={()=>shareWhatsApp(`${T("יומן")}: ${w.plate}`,`${T("רכב")}: ${w.plate}\n${w.desc||""}${w.codes&&w.codes.length?`\n${T("קודים")}: ${w.codes.join(", ")}`:""}${w.cost?`\n${T("עלות")}: ${w.cost} ₪`:""}${w.hours?`\n${T("שעות")}: ${w.hours}`:""}`)}>📤</IconBtn>
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
      ["🧵","חיווט",()=>openSub("wires")],["🔄","ממיר ומחשבון אוהם",()=>openSub("convert")],["📚","מאגר קודים",()=>openSub("all")],
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
      {vehicle && <>
        <Card title={<span dir="auto">🔍 {vehicle}</span>}>
          <p style={{ color:S.sub, fontSize:"13px", lineHeight:1.6, marginBottom:"10px" }}>📍 {T("ברוב הרכבים שקע ה-OBD מתחת ללוח המחוונים בצד הנהג, בגובה הברכיים. לפעמים הוא מוסתר מאחורי כיסוי.")}</p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}><GG q={`${vehicle} OBD2 port location`} l={T("תמונות")} img/><YT q={`${vehicle} OBD2 port location`} l={T("סרטון")}/><YT q={`${vehicle} diagnostic port`} l={T("חיפוש נוסף")}/></div>
        </Card>
        <NotesPanel sKey={`obd_${vehicle}`} notes={notes} setNotes={setNotes} askConfirm={askConfirm} onOpenImg={setImgView}/>
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
          {sub.id==="convert" && ConvertScreen()}{sub.id==="all" && AllScreen()}{sub.id==="settings" && SettingsScreen()}{sub.id==="about" && AboutScreen()}
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
          <label style={{ color:S.sub, fontSize:"12px", fontWeight:700 }}>{T("מספר רכב / זיהוי")}<Field value={wlPlate} onChange={e=>setWlPlate(e.target.value)} placeholder="12-345-67" style={{ marginTop:"4px", fontSize:"16px", fontWeight:700 }}/></label>
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
