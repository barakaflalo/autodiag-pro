// AutoDiag Pro — 5 colour themes (AppNest: black & gold is the default)
export const THEMES = {
  gold:  { he:"שחור-זהב", en:"Black & Gold", bg:"#0B0B0D", card:"#17171B", inner:"#0F0F12", bdr:"#2C2C33", acc:"#D4A537", onAcc:"#0B0B0D", text:"#EDEDED", sub:"#C9C9CF", muted:"#8E8E96", green:"#22C55E", red:"#DC2626", blue:"#2563EB", warn:"#F59E0B", shadow:"rgba(0,0,0,.5)" },
  navy:  { he:"כחול לילה", en:"Night Blue", bg:"#0F172A", card:"#1E293B", inner:"#0F172A", bdr:"#334155", acc:"#F59E0B", onAcc:"#0F172A", text:"#E2E8F0", sub:"#CBD5E1", muted:"#94A3B8", green:"#22C55E", red:"#DC2626", blue:"#2563EB", warn:"#F59E0B", shadow:"rgba(0,0,0,.45)" },
  garage:{ he:"גרפיט-כתום", en:"Graphite & Orange", bg:"#121212", card:"#1E1E1E", inner:"#141414", bdr:"#353535", acc:"#FF7A1A", onAcc:"#121212", text:"#EEEEEE", sub:"#CFCFCF", muted:"#9A9A9A", green:"#22C55E", red:"#E53935", blue:"#2563EB", warn:"#FFB020", shadow:"rgba(0,0,0,.5)" },
  green: { he:"ירוק מוסך", en:"Workshop Green", bg:"#0A1410", card:"#13221B", inner:"#0C1813", bdr:"#25392F", acc:"#34D399", onAcc:"#0A1410", text:"#E6F2EC", sub:"#C3D8CD", muted:"#8AA597", green:"#4ADE80", red:"#EF4444", blue:"#3B82F6", warn:"#FBBF24", shadow:"rgba(0,0,0,.45)" },
  light: { he:"בהיר", en:"Light", bg:"#F3F4F6", card:"#FFFFFF", inner:"#F1F2F4", bdr:"#D5D8DE", acc:"#A16207", onAcc:"#FFFFFF", text:"#111827", sub:"#374151", muted:"#6B7280", green:"#15803D", red:"#B91C1C", blue:"#1D4ED8", warn:"#B45309", shadow:"rgba(0,0,0,.12)" },
};
export const THEME_ORDER = ["gold","navy","garage","green","light"];
// Live token object read by every component; mutated in place when the theme changes.
export const S = { ...THEMES.gold };
export function applyTheme(key){
  const t = THEMES[key] || THEMES.gold;
  Object.assign(S, t);
  try{
    document.documentElement.style.background = t.bg;
    document.body.style.background = t.bg;
    const m = document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute("content", t.bg);
  }catch(e){}
}
