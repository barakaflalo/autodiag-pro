// AutoDiag Pro — Hebrew is written in the code; EN maps each Hebrew string to English.
import { ctx } from "./lib.js";
import { EN } from "./i18n_en.js";

export function T(he, vars){
  let s = (ctx.lang === "en" && EN[he] !== undefined) ? EN[he] : he;
  if(vars) for(const k in vars) s = s.split("{"+k+"}").join(String(vars[k]));
  return s;
}
export const isEn = () => ctx.lang === "en";
