// AutoDiag Pro — optional online AI (BYOK). The key stays on the phone and goes only to the provider the user chose.
// The offline engine's findings + the current car/scan are sent as context, so the AI builds on the app's own knowledge.
export const AI_PROVIDERS = {
  gemini: { name:"Google Gemini", model:"gemini-flash-latest", keyUrl:"https://aistudio.google.com/apikey" },
  openai: { name:"OpenAI", model:"gpt-5-mini", keyUrl:"https://platform.openai.com/api-keys" },
};
// a key field may hold several keys (comma / new line) — use the first clean one, like the other AppNest apps
export const cleanKey = raw => (String(raw||"").split(/[\s,;]+/).map(s=>s.trim()).filter(s=>s.length>10)[0] || "");

const SYSTEM_HE = `אתה העוזר של AutoDiag Pro — אפליקציית אבחון לחשמלאי רכב בישראל.
ענה בעברית, קצר ומעשי, כמו חשמלאי רכב מנוסה שמדבר עם עמית: מה הסיבה הסבירה, מה למדוד ואיפה, ואיזה ערכים לצפות.
תשתמש קודם כל ב"מידע מהאפליקציה" שמצורף — הוא נבדק. אם אתה מוסיף ידע משלך, אל תמציא מספרי פינים, צבעי חוטים או ערכים של דגם מסוים; אם זה תלוי בדגם — תגיד לבדוק בסכמה של היצרן.
אם יש סכנה (מתח גבוה ברכב היברידי/חשמלי, כריות אוויר, דלק) — תזהיר בשורה אחת.
אל תשתמש בכותרות גדולות. רשימות קצרות עם • מותרות.`;
const SYSTEM_EN = `You are the assistant inside AutoDiag Pro — a diagnostic app for auto electricians.
Answer in English, short and practical, like an experienced auto electrician talking to a colleague: the likely cause, what to measure and where, and the values to expect.
Use the attached "App knowledge" first — it is verified. If you add your own knowledge, don't invent pin numbers, wire colours or model-specific values; if it depends on the model, say to check the maker's diagram.
If there's a hazard (hybrid/EV high voltage, airbags, fuel) — warn in one line.
No big headings. Short • lists are fine.`;

function withTimeout(p, ms){ return Promise.race([p, new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")), ms))]); }

export async function askAI({ provider="gemini", key, model, question, appKnowledge, carContext, history=[], lang="he" }){
  const k = cleanKey(key); if(!k) throw new Error("no-key");
  const P = AI_PROVIDERS[provider] || AI_PROVIDERS.gemini; const m = (model||"").trim() || P.model;
  const sys = lang==="en" ? SYSTEM_EN : SYSTEM_HE;
  const ctxText = [carContext ? (lang==="en"?"Current vehicle / scan:\n":"הרכב / הסריקה הנוכחיים:\n") + carContext : "", appKnowledge ? (lang==="en"?"App knowledge:\n":"מידע מהאפליקציה:\n") + appKnowledge : ""].filter(Boolean).join("\n\n");
  const userMsg = (ctxText ? ctxText + "\n\n" : "") + (lang==="en"?"Question: ":"שאלה: ") + question;
  const hist = history.slice(-6);
  let res, j;
  if(provider === "openai"){
    const messages = [{ role:"system", content:sys }, ...hist.map(h=>({ role:h.role==="user"?"user":"assistant", content:h.text })), { role:"user", content:userMsg }];
    res = await withTimeout(fetch("https://api.openai.com/v1/chat/completions", { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+k }, body:JSON.stringify({ model:m, messages }) }), 60000);
    j = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error((j.error && j.error.message) || ("HTTP "+res.status));
    return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || "").trim();
  }
  const contents = [...hist.map(h=>({ role:h.role==="user"?"user":"model", parts:[{ text:h.text }] })), { role:"user", parts:[{ text:userMsg }] }];
  res = await withTimeout(fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, { method:"POST", headers:{ "Content-Type":"application/json", "x-goog-api-key":k },
    body:JSON.stringify({ systemInstruction:{ parts:[{ text:sys }] }, contents, generationConfig:{ temperature:0.4, maxOutputTokens:1500 } }) }), 60000);
  j = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error((j.error && j.error.message) || ("HTTP "+res.status));
  const parts = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || [];
  return parts.map(p=>p.text||"").join("").trim();
}
