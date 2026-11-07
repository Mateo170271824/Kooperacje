/* Logika Kooperacji bez przeglądarki i bez bazy – testowana w tests/*.test.mjs (node --test). */

// Login → konto Firebase dokładnie tak jak w Truck App
export const normLogin = t => String(t||"").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/ł/g,"l").replace(/[^a-z0-9._-]+/g,".").replace(/^\.+|\.+$/g,"");

/* ---------- daty (tekst RRRR-MM-DD, czas lokalny) ---------- */
export function iso(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
export const today = () => iso(new Date());
export const pd = s => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
export const addD = (s,n) => { const d=pd(s); d.setDate(d.getDate()+n); return iso(d); };
export const monday = s => { const d=pd(s); d.setDate(d.getDate()-((d.getDay()+6)%7)); return iso(d); };
export function isoWeek(s){ const d=pd(s); d.setDate(d.getDate()+3-((d.getDay()+6)%7)); const w1=new Date(d.getFullYear(),0,4); return 1+Math.round(((d-w1)/864e5-3+((w1.getDay()+6)%7))/7); }
export const fD = s => s ? s.slice(8,10)+"."+s.slice(5,7)+"."+s.slice(0,4) : "";
export const fDs = s => s ? s.slice(8,10)+"."+s.slice(5,7) : "";
export const dniMiedzy = (a,b) => a&&b ? Math.round((pd(b)-pd(a))/864e5) : null;
export const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
export const plural = (n,a,b,c) => n===1?a:(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20))?b:c;

/* ---------- zlecenia ---------- */
export const STATUSY = ["Zlecone","W realizacji","Gotowe do odbioru","Odebrane","Anulowane"];
export const POLA = ["data","podw","nr","projekt","opis","rodzaj","ilosc","status","odebrano","uwagi","doLog"];
export const POLA_NAZWY = {data:"data odbioru",podw:"podwykonawca",nr:"nr zlecenia / projekt",projekt:"projekt",opis:"opis",rodzaj:"rodzaj",ilosc:"ilość",status:"status",odebrano:"odebrano dnia",uwagi:"uwagi",doLog:"do logistyki"};
export const closed = z => z.status==="Odebrane" || z.status==="Anulowane";
export const projOf = z => String(z.projekt||z.nr||"").trim();
// kod projektu do wspólnego słownika (Truck App, Kooperacje, Zapytania, Kombajn): wielkie litery, pojedyncze spacje
export const kodProjektu = s => String(s||"").trim().toUpperCase().replace(/\s+/g," ");
// alert terminu odbioru; t – dzisiejsza data
export function alertOf(z, t=today()){
  if (closed(z) || !z.data) return null;
  if (z.data < t) return ["⚠ Po terminie","alert-late"];
  if (z.data === t) return ["Dziś","alert-today"];
  if (z.data <= addD(t,7)) return ["W ciągu 7 dni","alert-soon"];
  return null;
}
// zmienione pola zlecenia: {pole: [stare, nowe]} (do historii i do kursu)
export function diff(cur, next){
  const out={};
  for(const k of POLA){ const a=k==="doLog"? !!cur?.[k] : cur?.[k]??"", b=k==="doLog"? !!next[k] : next[k]??""; if(String(a)!==String(b)) out[k]=[a,b]; }
  return out;
}

/* ---------- weryfikacja kosztów (eksport przyjęć PZ) ---------- */
export const normTxt = s => String(s||"").toUpperCase().replace(/Ł/g,"L").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Z0-9]+/g," ").trim();
export function cellDate(v){
  if(v instanceof Date && !isNaN(v)) return iso(v);
  if(typeof v==="number" && v>20000 && v<80000){ const d=new Date(Math.round((v-25569)*864e5)); return iso(new Date(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())); }
  const s=String(v||"").trim(); let m=s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/); if(m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m? m[0] : "";
}
export function cellNum(v){ if(typeof v==="number") return v; const s=String(v||"").replace(/\s|zł/g,"").replace(",","."); if(!s) return null; const n=Number(s); return Number.isFinite(n)?n:null; }
export function nrInText(nr, txt){ const N=normTxt(nr); if(N.length<3) return false; return (" "+normTxt(txt)+" ").includes(" "+N+" "); }
// dostawca z pliku → id podwykonawcy z listy P
export function matchSup(dost, P){
  const n=normTxt(dost); if(!n) return "";
  for(const p of P){ const pn=normTxt(p.nazwa); const al=normTxt(p.symbolMag||""); if(!pn) continue;
    if(n===pn || n.startsWith(pn+" ") || (" "+n+" ").includes(" "+pn+" ") || (al && (" "+n+" ").includes(" "+al+" "))) return p.id;
    const p1=pn.split(" ")[0], n1=n.split(" ")[0]; if(p1.length>=4 && p1===n1) return p.id; }
  return "";
}

/* ---------- kurs w Truck App (logistyka) ----------
   Zlecenie z zaznaczonym „wyślij do logistyki” = kurs w kolekcji kursy (+ koszty), jak dostawa dodana przez zakupy w Truck App:
   transport nasz, bez kierowcy, doUzup → biuro logistyki dostaje okienko „do uzupełnienia” i przypisuje kierowcę i auto.
   Kooperacje zmieniają w kursie tylko to, co zmieniło się w zleceniu – kierowcy, auta ani dat ustawionych przez logistykę nie ruszają. */
export const POLA_KURSU = ["typ","rodzaj","nr","proj","kontr","transport","spedytor","kier","nasz","kierUid","auto","zal","dst","waga","dlugosc","oddzial","miejsce","kraj","kontakt","status","uwagi","uwagiMag","ladunek","awizo","zrodlo","hlId","hlIndeks","hlWeek","hlTydzien","godz","dojazd","przew","oddzial2","waga2","planId","punkty","doUzup","odZakupow","zalMiejsce","opoznienie","protokol","pozycje","kierStatus","kierStatusCzas","raport","zdjecia"];
const KURS_TABLICE=["zdjecia","punkty","pozycje"], KURS_NULL=["waga","raport","ladunek","awizo","kierStatusCzas","dlugosc","dojazd","przew","waga2","odZakupow","protokol"];
export const kursZamkniety = k => !k || k.status==="Dostarczone" || k.status==="Anulowane";
export const opisLadunku = d => [d.rodzaj, d.opis].filter(Boolean).join(" – ") || "elementy z kooperacji";
export const uwagiKursu = d => ["Odbiór od podwykonawcy (Kooperacje).", d.uwagi].filter(Boolean).join(" ");
const iloscTxt = d => d.ilosc!=null&&d.ilosc!==""? d.ilosc+" szt.":"";
// nowy kurs; p – podwykonawca, ja – {login, nazwa}, ts – znacznik czasu serwera
export function nowyKurs(zid, d, p, ja, ts, czas=Date.now()){
  p=p||{};
  const k={ typ:"D", rodzaj:"Odbiór – kooperacja", nr:d.nr||d.projekt||"KOOP", proj:projOf(d), kontr:p.nazwa||"", transport:"Skavska",
    zal:d.data, dst:"", miejsce:p.adres||"", kontakt:p.tel||"", status:"Oczekuje na kierowcę", uwagi:uwagiKursu(d),
    ladunek:{ opis:opisLadunku(d), ilosc:iloscTxt(d), opak:"", wagaKg:null, obj:null, cechy:"" },
    zrodlo:"KOOP", doUzup:true, odZakupow:{ kto:ja.login||"", nazwa:ja.nazwa||ja.login||"", czas } };
  const kurs={}; for(const f of POLA_KURSU) kurs[f]=k[f] ?? (KURS_TABLICE.includes(f)? [] : f==="hlTydzien"||f==="doUzup"? false : KURS_NULL.includes(f)? null : "");
  return { ...kurs, kierUid:"", koopId:zid, dataS:d.data, zmieniono:ts, zmienil:ja.login||"" };
}
// zmiany w istniejącym kursie wynikające ze zmian zlecenia (null = nic do zmiany)
export function zmianyKursu(k, d, zmiany, p, ja, ts, dzis=today()){
  const u={};
  if(!d.doLog || d.status==="Anulowane"){ if(!kursZamkniety(k)) u.status="Anulowane"; }
  else if(d.status==="Odebrane"){ if(!kursZamkniety(k)){ u.status="Dostarczone"; if(!k.dst) u.dst=d.odebrano||dzis; } }
  else {
    if(k.status==="Anulowane"){ Object.assign(u,{ status:"Oczekuje na kierowcę", doUzup:true, zal:d.data, dataS:d.data }); }
    if(zmiany.data && !kursZamkniety(k)){ u.zal=d.data; u.dataS=d.data; if(k.dst && k.dst<d.data) u.dst=""; }   // dataS w Truck App = data załadunku
    if(zmiany.podw){ p=p||{}; Object.assign(u,{ kontr:p.nazwa||"", miejsce:p.adres||"", kontakt:p.tel||"" }); }
    if(zmiany.nr||zmiany.projekt){ u.nr=d.nr||d.projekt||"KOOP"; u.proj=projOf(d); }
    if(zmiany.opis||zmiany.rodzaj||zmiany.ilosc) u.ladunek={ ...(k.ladunek||{}), opis:opisLadunku(d), ilosc:iloscTxt(d) };
  }
  if(!Object.keys(u).length) return null;
  return { ...u, zmieniono:ts, zmienil:ja.login||"" };
}
// opis zmiany kursu do komunikatu
export const rodzajZmianyKursu = u => !u? "" : u.status==="Anulowane"? "anulowany" : u.status==="Dostarczone"? "dostarczony" : u.status? "przywrocony" : "zmieniony";
// stan kursu w logistyce: krótki opis do listy i do okna zlecenia (k – kurs albo undefined, gdy usunięty)
export function kursStan(z, k){
  if(!z.kursId) return null;
  if(!k) return {cls:"p-idle", txt:"kurs usunięty w Truck App", dl:"Logistyka usunęła kurs. Odznacz i zaznacz „wyślij do logistyki”, żeby wysłać ponownie."};
  const kto = k.nasz || [k.spedytor, k.kier].filter(Boolean).join(" · ");
  if(k.status==="Anulowane") return {cls:"p-idle", txt:"kurs anulowany"};
  if(k.status==="Dostarczone" || k.kierStatus==="dostarczone") return {cls:"p-ok", txt:"🚚 dowiezione"+(kto?" · "+kto:"")};
  if(!kto && k.transport==="Skavska") return {cls:"p-warn", txt:"🚚 czeka na kierowcę", dl:"Logistyka dostała powiadomienie i przypisze kierowcę."};
  return {cls:"p-ok", txt:"🚚 "+(kto||"transport: "+(k.transport||"—"))+(k.auto?" · "+k.auto:"")+(k.zal&&k.zal!==z.data?" · "+fDs(k.zal):"")};
}

/* ---------- podwykonawcy ---------- */
// wiersze arkusza (pierwszy = nagłówki) → lista podwykonawców; kolumny rozpoznawane po nazwie
const KOL_PODW = { nazwa:["NAZWA","PODWYKONAWCA","FIRMA"], dzial:["OSOBA DZIAL","OSOBA","DZIAL"], tel:["TELEFON","TEL"], adres:["ADRES ODBIORU","ADRES"], email:["E MAIL","EMAIL","MAIL"],
  osoba2:["OSOBA 2"], tel2:["TELEFON 2","TEL 2"], email2:["E MAIL 2","EMAIL 2","MAIL 2"] };
export function podwykonawcyZArkusza(aoa){
  const hi=aoa.slice(0,10).findIndex(r=>r.some(c=>KOL_PODW.nazwa.includes(normTxt(c))));
  if(hi<0) throw new Error("Nie znalazłem kolumny „Nazwa” (albo „Podwykonawca”, „Firma”) w pierwszych wierszach arkusza.");
  const H=aoa[hi].map(normTxt), col={};
  for(const [k,names] of Object.entries(KOL_PODW)){ const i=H.findIndex(h=>names.includes(h)); col[k]=i; }
  // „Telefon” nie może złapać kolumny „Telefon 2” itd. – dokładne dopasowanie wyżej, tu tylko kontrola
  const out=[];
  for(const r of aoa.slice(hi+1)){
    const p={}; for(const k of Object.keys(KOL_PODW)) p[k]=col[k]>=0? String(r[col[k]]??"").trim() : "";
    if(p.nazwa) out.push(p);
  }
  return out;
}
