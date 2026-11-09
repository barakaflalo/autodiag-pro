// AutoDiag Pro — Cloudflare Pages Function: /api/*
// data.gov.il sends no CORS headers, so the app asks this function instead.
//   GET /api/health          → is data.gov.il reachable
//   GET /api/plate?n=1234567 → vehicle registry record + engine data (WLTP)
const DG = "https://data.gov.il/api/3/action/datastore_search";
const RES_MAIN = "053cea08-09bc-40ec-8f7a-156f0677aff3"; // private & commercial vehicles (active)
const RES_WLTP = "142afde2-6228-49f9-8a29-9b6c3a0cbe40"; // model specs: engine cc, hp, gearbox
const UA = { "User-Agent": "AutoDiagPro/1.4 (+https://autodiag-pro.pages.dev)", "Accept": "application/json" };

function json(body, status = 200, extra = {}){
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra } });
}
async function dgQuery(resource, filters, fields, ctx){
  let url = `${DG}?resource_id=${resource}&limit=5&filters=${encodeURIComponent(JSON.stringify(filters))}`;
  if (fields) url += `&fields=${fields}`;
  const cache = (typeof caches !== "undefined" && caches.default) ? caches.default : null;
  const key = new Request(url);
  if (cache){ const hit = await cache.match(key); if (hit) return hit.json(); }
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error("data.gov.il HTTP " + r.status);
  const j = await r.json();
  if (!j.success) throw new Error("data.gov.il error");
  const out = j.result.records || [];
  if (cache && ctx && ctx.waitUntil){
    ctx.waitUntil(cache.put(key, new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json", "Cache-Control": "max-age=3600" } })));
  }
  return out;
}

export async function plateLookup(nRaw, ctx){
  const digits = String(nRaw || "").replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 8) return { status: 400, body: { ok: false, error: "bad_plate" } };
  const recs = await dgQuery(RES_MAIN, { mispar_rechev: Number(digits) }, null, ctx);
  if (!recs.length) return { status: 200, body: { ok: true, found: false, plate: digits } };
  const v = recs[0];
  let spec = null;
  try{
    const w = await dgQuery(RES_WLTP, { tozeret_cd: v.tozeret_cd, degem_cd: v.degem_cd, shnat_yitzur: v.shnat_yitzur }, "nefah_manoa,koah_sus,automatic_ind,tozar,tozeret_eretz_nm,merkav,delek_nm,technologiat_hanaa_nm,hanaa_nm", ctx);
    if (w.length) spec = w[0];
  }catch(e){ /* specs are optional */ }
  return { status: 200, body: { ok: true, found: true, plate: digits, vehicle: {
    plate: String(v.mispar_rechev),
    makeHe: v.tozeret_nm || "", maker: spec && spec.tozar ? spec.tozar : "", country: spec && spec.tozeret_eretz_nm ? spec.tozeret_eretz_nm : "",
    model: v.kinuy_mishari || "", modelCode: v.degem_nm || "", trim: v.ramat_gimur || "",
    year: v.shnat_yitzur || "", engineCode: v.degem_manoa || "", fuel: v.sug_delek_nm || "",
    vin: v.misgeret || "", color: v.tzeva_rechev || "", ownership: v.baalut || "",
    lastTest: v.mivchan_acharon_dt || "", testValid: v.tokef_dt || "", onRoad: v.moed_aliya_lakvish || "",
    tyresFront: v.zmig_kidmi || "", tyresRear: v.zmig_ahori || "", type: v.sug_degem || "",
    cc: spec && spec.nefah_manoa ? spec.nefah_manoa : "", hp: spec && spec.koah_sus ? spec.koah_sus : "",
    auto: spec ? spec.automatic_ind === 1 : null, body: spec && spec.merkav ? spec.merkav : "",
    drive: spec && spec.technologiat_hanaa_nm ? spec.technologiat_hanaa_nm : "",
  } } };
}

export async function onRequest(context){
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^.*\/api\//, "");
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });
  try{
    if (path === "health"){
      const r = await fetch(`${DG}?resource_id=${RES_MAIN}&limit=1`, { headers: UA });
      return json({ ok: r.ok, dataGov: r.status, time: new Date().toISOString() });
    }
    if (path === "plate"){
      const res = await plateLookup(url.searchParams.get("n"), context);
      return json(res.body, res.status);
    }
    return json({ ok: false, error: "not_found" }, 404);
  }catch(e){
    return json({ ok: false, error: "upstream", detail: String(e && e.message || e) }, 502);
  }
}
