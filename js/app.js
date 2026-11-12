import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import * as FA from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import * as FF from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { collection, doc, onSnapshot, runTransaction, serverTimestamp, getDocs, query, where, orderBy, limit, writeBatch, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { normLogin, iso, today, pd, addD, monday, isoWeek, fD, fDs, dniMiedzy, esc, plural, STATUSY, POLA, POLA_NAZWY, closed, projOf, alertOf as alertDnia, diff, kodProjektu, kursZamkniety, nowyKurs as nowyKursL, zmianyKursu as zmianyKursuL, rodzajZmianyKursu, kursStan as kursStanL } from "./logika.js?v=2";
import { polacz, zaloguj, komunikat, dostepBiura } from "./steelflow-konto.js?v=2";
import { hStyle, kw, miesNazwa, natywna, newPdf, nowStamp, pdfFooter, pdfHeader, saveBlob, tStyle } from './czesci/pliki.js?v=3';
import { exportCsv, openS, saveRodz } from './czesci/podwykonawcy.js?v=3';
import { renderRaporty, resolveProject } from './czesci/raporty.js?v=3';
import { VER, WER, renderVer, ustawWER } from './czesci/weryfikacja.js?v=3';
import { $, MIES } from './czesci/stale.js?v=3';

/* ===== Firebase – ten sam projekt co Truck App; konfiguracja, login i tryb emulatora (?emu na localhost)
   ze wspólnego modułu SteelFlow (js/steelflow-konto.js, kopia z repo Logistyka) ===== */
export const SDK = { initializeApp, auth: FA, firestore: FF };
export const POL = polacz(SDK, { emuPort: 8085 });
export const auth = POL.auth, db = POL.db;

export const C = { z:"koop_zlecenia", p:"koop_podwykonawcy", u:"koop_ustawienia", kosz:"koop_kosz", v:"koop_wartosci", k:"koop_koszty" };
export const RODZAJE_DOMYSLNE = ["Rynny","Kątowniki","Ceowniki","Uszka mobilne","Elementy zimnogięte","Blachy i obróbki","Bramy","Inne"];
export const DNI = ["niedziela","poniedziałek","wtorek","środa","czwartek","piątek","sobota"];
export const DNI_K = ["nd","pn","wt","śr","cz","pt","sb"];
export const MIES_D = ["stycznia","lutego","marca","kwietnia","maja","czerwca","lipca","sierpnia","września","października","listopada","grudnia"];
export const MIES_K = ["sty","lut","mar","kwi","maj","cze","lip","sie","wrz","paź","lis","gru"];

export let PROJ = [];   // wspólny słownik projektów (kolekcja projekty)
export let Z = [], P = [], V = {}, KR = {}, KO = {}, rodzaje = RODZAJE_DOMYSLNE.slice();
export let KD = null;   // domyślny kierowca i auto do odbiorów z kooperacji (Truck App: ustawienia/glowne.koopOdbior)
export let rodzajeZapisane = true;
export let me = null;               // {uid, login, nazwa, admin}
export let subs = [];
export let canWrite = false, isAdmin = false, isBuyer = false;
export const canSeeAmounts = () => isAdmin || isBuyer;
export const moneyText = v => v==null || v==="" ? "—" : Number(v).toLocaleString("pl-PL",{minimumFractionDigits:2,maximumFractionDigits:2})+" zł";

/* ---------- daty ---------- */
export const tsDate = t => t && typeof t.toDate==="function" ? t.toDate() : null;
export const fTs = t => { const d=tsDate(t); return d ? String(d.getDate()).padStart(2,"0")+"."+String(d.getMonth()+1).padStart(2,"0")+" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0") : ""; };

/* ---------- pomocnicze ---------- */
export const sup = id => P.find(p=>p.id===id);
export const supName = id => sup(id)?.nazwa || "—";
export const supColor = id => `var(--c${sup(id)?.kolor ?? 7})`;
export const alertOf = z => alertDnia(z, today());
export const stClass = s => "st-"+String(s||"Zlecone").split(" ")[0];
export const pill = s => `<span class="pill ${stClass(s)}">${esc(s||"Zlecone")}</span>`;
export const byDate = (a,b) => (a.data||"9").localeCompare(b.data||"9") || supName(a.podw).localeCompare(supName(b.podw),"pl");
export const sortedP = () => P.slice().sort((a,b)=>(a.kolejnosc??99)-(b.kolejnosc??99)||String(a.nazwa).localeCompare(String(b.nazwa),"pl"));

/* ---------- widoki ---------- */
export function show(view, msg){
  $("vLogin").hidden = view!=="login"; $("vApp").hidden = view!=="app"; $("vMsg").hidden = view!=="msg";
  if (view==="msg"){ $("msgText").textContent = msg; $("msgOut").hidden = !auth.currentUser; }
}
export const TABS=["pulpit","kalendarz","tydzien","zlecenia","podwykonawcy","raporty","weryfikacja","dostep"];
export let tab="pulpit";
export function setTab(t){ tab=TABS.includes(t)?t:"pulpit"; if((tab==="raporty"||tab==="weryfikacja") && !canSeeAmounts()) tab="pulpit"; if(tab==="dostep" && !isAdmin) tab="pulpit"; for(const k of TABS) $("v-"+k).hidden = k!==tab;
  document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-selected", b.dataset.tab===tab));
  try{ history.replaceState(null,"","#"+tab); }catch{}
  if(me) renderTab(); }
document.querySelector("nav.tabs").addEventListener("click",e=>{ const b=e.target.closest("button[data-tab]"); if(b) setTab(b.dataset.tab); });
setTab((location.hash||"").slice(1));

export let calMonth = today().slice(0,7), calSup="", calDone=true, calSel="";
export const narrow = () => matchMedia("(max-width:700px)").matches;
export let wkStart = monday(today()), wkSup="", wkShow="open";
export let zSup="", zStatus="", zQ="", zClosed=false;
export function fillSupSelect(el, val){ el.innerHTML = `<option value="">Wszyscy podwykonawcy</option>`+sortedP().map(p=>`<option value="${p.id}" ${p.id===val?"selected":""}>${esc(p.nazwa)}</option>`).join(""); }

export function render(){
  if (!me) return;
  const t=today();
  $("stan").textContent = `Stan na ${fD(t)} · tydzień ${isoWeek(t)}`;
  $("who").innerHTML = `<span>Zalogowany: <b>${esc(me.nazwa||me.login)}</b>${isAdmin?" · administrator":isBuyer?" · zakupowiec":""}</span>`;
  $("btnNew").hidden=!canWrite; $("btnNewSup").hidden=!isAdmin; $("fRodz").hidden=!isAdmin; $("sHint").hidden=isAdmin;
  $("btnSeed").hidden = !isAdmin;
  $("tabDostep").hidden = !isAdmin;
  $("tabRaporty").hidden = !canSeeAmounts(); $("tabWer").hidden = !canSeeAmounts();
  if (!isAdmin && tab==="dostep") setTab("pulpit");
  if (!canSeeAmounts() && (tab==="raporty"||tab==="weryfikacja")) setTab("pulpit");
  renderAlerts(); renderTab();
}
// Rysujemy tylko widoczną zakładkę – pozostałe przy przełączeniu (przy tysiącach zleceń to duża oszczędność).
export function renderTab(){
  if (!me) return;
  ({ pulpit:renderPulpit, kalendarz:renderCal, tydzien:renderWeek, zlecenia:renderZ, podwykonawcy:renderSup, dostep:renderDostep,
     raporty:renderRaporty, weryfikacja:()=>{ if(canSeeAmounts()) renderVer(false); } })[tab]?.();
}

/* ---------- dostęp (administrator): pole uzytkownicy/{uid}.kooperacje ---------- */
export let K = [];   // konta biura z Truck App
export function renderDostep(){
  if (!isAdmin) return;
  const list=K.slice().sort((a,b)=>String(a.nazwa||a.login).localeCompare(String(b.nazwa||b.login),"pl"));
  $("dRows").innerHTML=list.map(k=>{
    const adm = k.uid===adminUid, ma = adm || k.kooperacje!==false;
    const ctl = adm? `<span class="pill st-Odebrane">Tak · administrator</span>`
      : `<label style="display:flex;gap:8px;align-items:center;color:var(--fg);font-size:13px"><input type="checkbox" data-dost="${k.uid}" ${ma?"checked":""}> ${ma?"Ma dostęp":"Brak dostępu"}</label>`;
    const buyer = k.koopZakupowiec===true;
    const buyerCtl = adm ? `<span class="pill st-Odebrane">Tak · administrator</span>`
      : `<label style="display:flex;gap:8px;align-items:center;color:var(--fg);font-size:13px"><input type="checkbox" data-buyer="${k.uid}" ${buyer?"checked":""}> ${buyer?"Ma uprawnienie":"Brak uprawnienia"}</label>`;
    return `<tr class="${k.aktywny===false?"closed":""}"><td class="strong">${esc(k.nazwa||k.login)}${k.uid===me.uid?' <span class="small">(Ty)</span>':""}</td><td class="mono">${esc(k.login)}</td>
      <td>${k.aktywny===false?'<span class="pill st-Anulowane">Zablokowane</span>':'<span class="pill st-W">Aktywne</span>'}</td><td>${ctl}</td><td>${buyerCtl}</td></tr>`;
  }).join("");
  const e=$("dEmpty"); e.hidden=!!list.length; e.innerHTML="<span>Wczytywanie kont…</span>";
}
document.addEventListener("change", async e=>{
  const c=e.target.closest("input[data-dost]"); if(!c || !isAdmin) return;
  const uid=c.dataset.dost, on=c.checked, k=K.find(x=>x.uid===uid);
  c.disabled=true;
  try{ await updateDoc(doc(db,"uzytkownicy",uid), {kooperacje:on}); toast((k?.nazwa||k?.login||"Konto")+(on?" – ma dostęp do Kooperacji":" – nie ma już dostępu do Kooperacji")); }
  catch(x){ c.checked=!on; failed(x); }
  finally{ c.disabled=false; }
});
document.addEventListener("change", async e=>{
  const c=e.target.closest("input[data-buyer]"); if(!c || !isAdmin) return;
  const uid=c.dataset.buyer, on=c.checked, k=K.find(x=>x.uid===uid);
  c.disabled=true;
  try{ await updateDoc(doc(db,"uzytkownicy",uid), {koopZakupowiec:on}); toast((k?.nazwa||k?.login||"Konto")+(on?" – nadano uprawnienie Zakupowiec":" – odebrano uprawnienie Zakupowiec")); }
  catch(x){ c.checked=!on; failed(x); }
  finally{ c.disabled=false; }
});
export let kontaUnsub=null;
export function watchKonta(){
  if (isAdmin && !kontaUnsub){
    kontaUnsub=onSnapshot(query(collection(db,"uzytkownicy"), where("rola","==","biuro")), s=>{ K=s.docs.map(d=>({uid:d.id,...d.data()})); renderDostep(); }, x=>console.warn(x));
  } else if (!isAdmin && kontaUnsub){ kontaUnsub(); kontaUnsub=null; K=[]; }
}

export function renderPulpit(){
  const t=today(), mon=monday(t), sun=addD(mon,6);
  const open=Z.filter(z=>!closed(z));
  const late=open.filter(z=>z.data && z.data<t);
  const td=open.filter(z=>z.data===t);
  const wk=open.filter(z=>z.data>=mon && z.data<=sun);
  $("kOpen").textContent=open.length;
  $("kOpenH").textContent=open.filter(z=>z.status==="Gotowe do odbioru").length+" gotowych do odbioru";
  $("kLate").textContent=late.length;
  $("kLateH").textContent=late.length? "najstarsze z "+fD(late.map(z=>z.data).sort()[0]) : "wszystko w terminie";
  $("kToday").textContent=td.length;
  $("kTodayH").textContent=td.length? [...new Set(td.map(z=>supName(z.podw)))].join(", ") : "brak odbiorów";
  $("kWeek").textContent=wk.length;
  $("kWeekH").textContent=`${fDs(mon)} – ${fDs(addD(mon,4))}`;

  const next=open.slice().sort(byDate).slice(0,20);
  $("pNext").innerHTML=next.map(z=>{const a=alertOf(z); return `<tr class="click ${a&&a[1]==="alert-late"?"late":""}" data-z="${z.id}">
    <td class="mono">${fD(z.data)}</td><td><span class="sw" style="background:${supColor(z.podw)}"></span>${esc(supName(z.podw))}</td>
    <td class="mono">${esc(z.nr)}</td><td>${esc(z.opis)}</td><td>${pill(z.status)}</td><td>${a?`<span class="${a[1]}">${a[0]}</span>`:""}</td><td class="small uw">${esc(z.uwagi)}</td><td>${quickBtns(z)}</td></tr>`;}).join("");
  const more=open.length-next.length, pe=$("pNextEmpty");
  if(!open.length){ pe.hidden=false; pe.innerHTML=`<strong>Brak otwartych zleceń</strong><span>Dodaj zlecenie przyciskiem „Nowe zlecenie” albo kliknij dzień w kalendarzu.</span>`; }
  else if(more>0){ pe.hidden=false; pe.innerHTML=`<span>… i jeszcze ${more} – pełna lista w zakładce Zlecenia</span>`; }
  else pe.hidden=true;

  $("pSup").innerHTML = P.length? sortedP().map(p=>{
    const mine=Z.filter(z=>z.podw===p.id), op=mine.filter(z=>!closed(z)), lt=op.filter(z=>z.data&&z.data<t);
    return `<div class="sup-card"><div class="nm"><span><span class="sw" style="background:var(--c${p.kolor??7})"></span>${esc(p.nazwa)}</span><span class="small">${esc(p.dzial||"")}</span></div>
      <div class="nums"><span>Razem <b>${mine.length}</b></span><span>Otwarte <b>${op.length}</b></span><span>Po term. <b class="${lt.length?"bad":""}">${lt.length}</b></span><span>Odebr. <b>${mine.filter(z=>z.status==="Odebrane").length}</b></span></div>
      <div class="small mono">${esc([p.tel,p.email].filter(Boolean).join("  ·  "))}</div></div>`;}).join("")
    : `<div class="empty"><span>Brak podwykonawców. ${isAdmin?"Wczytaj ich w zakładce Podwykonawcy.":"Administrator musi ich dodać."}</span></div>`;

  const months=[]; { const d=pd(t.slice(0,7)+"-01"); d.setMonth(d.getMonth()-9); for(let i=0;i<10;i++){ months.push(iso(d).slice(0,7)); d.setMonth(d.getMonth()+1);} }
  const ps=sortedP();
  const data=months.map(m=>ps.map(p=>Z.filter(z=>z.podw===p.id && (z.data||"").startsWith(m) && z.status!=="Anulowane").length));
  const max=Math.max(1,...data.map(r=>r.reduce((a,b)=>a+b,0)));
  const step = max<=5?1: max<=10?2: max<=25?5: 10, top=Math.ceil(max/step)*step;
  const W=320,H=170,L=26,B=22,T=8, cw=(W-L-4)/months.length, y=v=>T+(H-T-B)*(1-v/top);
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Liczba zleceń w ostatnich 10 miesiącach">`;
  for(let v=0; v<=top; v+=step){ svg+=`<line x1="${L}" x2="${W-4}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L-5}" y="${y(v)+4}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`; }
  months.forEach((m,i)=>{ let acc=0; const x=L+i*cw+cw*0.18, w=cw*0.64;
    data[i].forEach((n,j)=>{ if(!n) return; svg+=`<rect x="${x}" y="${y(acc+n)}" width="${w}" height="${y(acc)-y(acc+n)}" fill="var(--c${ps[j].kolor??7})"><title>${esc(ps[j].nazwa)} · ${MIES[+m.slice(5)-1]} ${m.slice(0,4)}: ${n}</title></rect>`; acc+=n; });
    svg+=`<text x="${L+i*cw+cw/2}" y="${H-6}" text-anchor="middle" font-size="10" fill="var(--muted)">${MIES_K[+m.slice(5)-1]}</text>`; });
  $("pChart").innerHTML=svg+"</svg>";
  $("pLegend").innerHTML=ps.map(p=>`<span><span class="sw" style="background:var(--c${p.kolor??7})"></span>${esc(p.nazwa)}</span>`).join("");

  const rs=[...new Set([...rodzaje, ...Z.map(z=>z.rodzaj).filter(Boolean)])];
  $("pRodz").innerHTML=rs.map(r=>{const all=Z.filter(z=>z.rodzaj===r); return `<tr><td>${esc(r)}</td><td class="num">${all.length}</td><td class="num">${all.filter(z=>!closed(z)).length}</td></tr>`;}).join("");
}

export function evHtml(z, showDate){
  const a=alertOf(z), late=a&&a[1]==="alert-late";
  const label=[z.nr, z.opis].filter(Boolean).join(" · ") || z.rodzaj || "zlecenie";
  return `<button type="button" class="ev ${late?"late":""} ${closed(z)?"done":""}" data-z="${z.id}" style="--c:${supColor(z.podw)}" title="${esc(supName(z.podw))} · ${esc(z.status)}">${showDate?`<span class="we">${DNI_K[pd(z.data).getDay()]} ${fDs(z.data)} · </span>`:""}${esc(label)}</button>`;
}
export function renderCal(){
  fillSupSelect($("calSup"), calSup);
  const [y,m]=calMonth.split("-").map(Number);
  $("calTitle").textContent = MIES[m-1][0].toUpperCase()+MIES[m-1].slice(1)+" "+y;
  let d=monday(calMonth+"-01"); const last=iso(new Date(y,m,0)), t=today();
  const list=Z.filter(z=>z.data && (!calSup||z.podw===calSup) && (calDone || !closed(z)) && z.status!=="Anulowane");
    if(!calSel || calSel.slice(0,7)!==calMonth) calSel = today().slice(0,7)===calMonth ? today() : calMonth+"-01";
  // weekend → najbliższy dzień roboczy w tym miesiącu
  const wd=pd(calSel).getDay();
  if(wd===6||wd===0){ const pon=addD(calSel, wd===6?2:1); calSel = pon.slice(0,7)===calMonth ? pon : addD(calSel, wd===6?-1:-2); }
  const byDay={};
  let h=`<div class="h wkh">Tydz.</div>`+[["Pn","Poniedziałek"],["Wt","Wtorek"],["Śr","Środa"],["Cz","Czwartek"],["Pt","Piątek"]].map(([a,b])=>`<div class="h"><span class="hs">${a}</span><span class="hl">${b}</span></div>`).join("");
  while(d<=last){
    h+=`<div class="wk">T${isoWeek(d)}</div>`;
    for(let i=0;i<5;i++){
      const day=addD(d,i), inM=day.slice(0,7)===calMonth;
      let evs=list.filter(z=>z.data===day);
      if(i===4) evs=evs.concat(list.filter(z=>z.data===addD(d,5)||z.data===addD(d,6)));
      evs.sort(byDate);
      const n=evs.length; byDay[day]=evs;
      // telefon: do 2 pasków ze skrótem podwykonawcy, reszta jako „+n”
      const dots=evs.slice(0,2).map(z=>{const a=alertOf(z); return `<em class="chipn ${a&&a[1]==="alert-late"?"late":""}" style="--c:${supColor(z.podw)}">${esc(supName(z.podw).split(/[-\s]/)[0].slice(0,5))}</em>`;}).join("")+(n>2?`<em class="chipn more">+${n-2}</em>`:"");
      h+=`<div class="day ${inM?"":"out"} ${day===t?"today":""} ${day===calSel?"sel":""} ${n?"":"blank"}" data-day="${day}" tabindex="0" aria-label="${DNI[pd(day).getDay()]} ${fD(day)}, zleceń: ${n}">
        <div class="dn"><b class="num">${+day.slice(8)}${day.slice(8)==="01"||(!inM&&day===addD(d,0))?`<small>${MIES_K[+day.slice(5,7)-1]}</small>`:""}</b><span class="cnt">${n? n+" "+(n===1?"zlecenie":(n<5?"zlecenia":"zleceń")):""}</span></div>
        <div class="dots">${dots}</div>
        ${evs.map(z=>evHtml(z, z.data!==day)).join("")}${canWrite?`<div class="slot" data-add="${day}" title="Dodaj zlecenie na ${fD(day)}">+ Dodaj zlecenie</div>`:""}</div>`;
    }
    d=addD(d,7);
  }
  $("cal").innerHTML=h;
  const se=byDay[calSel]||[];
  const nm=DNI[pd(calSel).getDay()];
  const zc=z=>{ const a=alertOf(z), late=a&&a[1]==="alert-late";
    return `<button type="button" class="zc ${late?"late":""} ${closed(z)?"done":""}" data-z="${z.id}" style="--c:${supColor(z.podw)}"><span class="bar"></span>
      <span><span class="sup">${esc(supName(z.podw))}${z.data!==calSel?` · ${DNI_K[pd(z.data).getDay()]} ${fDs(z.data)}`:""}</span><span class="t">${esc([z.nr,z.opis].filter(Boolean).join(" · ")||z.rodzaj||"zlecenie")}</span>${z.rodzaj||z.ilosc?`<span class="m">${esc([z.rodzaj, z.ilosc!=null&&z.ilosc!==""?z.ilosc+" szt.":""].filter(Boolean).join(" · "))}</span>`:""}</span>${pill(z.status)}</button>`; };
  $("calDay").innerHTML=`<div class="row"><h3>${nm[0].toUpperCase()+nm.slice(1)}, ${+calSel.slice(8)} ${MIES_D[+calSel.slice(5,7)-1]}</h3><span class="small">${se.length? se.length+" "+(se.length===1?"zlecenie":(se.length<5?"zlecenia":"zleceń")):""}</span></div>`+
    (se.length? se.map(zc).join("") : `<div class="empty">Brak odbiorów w tym dniu</div>`)+
    (canWrite?`<button type="button" class="btn primary addbig" data-add="${calSel}">+ Dodaj zlecenie na ten dzień</button>`:"");
  $("calLegend").innerHTML=sortedP().map(p=>`<span><span class="sw" style="background:var(--c${p.kolor??7})"></span>${esc(p.nazwa)}</span>`).join("")+`<span style="color:var(--bad);font-weight:600">Po terminie = czerwony tekst</span>`;
}

export function renderWeek(){
  fillSupSelect($("wkSup"), wkSup);
  const end=addD(wkStart,6);
  $("wkTitle").textContent=`Tydzień ${isoWeek(wkStart)} · ${fDs(wkStart)} – ${fD(addD(wkStart,4))}`;
  const list=Z.filter(z=>z.data>=wkStart && z.data<=end && (!wkSup||z.podw===wkSup) && (wkShow==="all" || !closed(z))).sort(byDate);
  let h="", cur="";
  for(const z of list){
    if(z.data!==cur){ cur=z.data; h+=`<tr class="dayhead"><td colspan="${canSeeAmounts()?10:9}">${DNI[pd(cur).getDay()]} ${fD(cur)}</td></tr>`; }
    const a=alertOf(z);
    h+=`<tr class="click ${a&&a[1]==="alert-late"?"late":""} ${closed(z)?"closed":""}" data-z="${z.id}"><td class="small">${DNI_K[pd(z.data).getDay()]}</td>
      <td><span class="sw" style="background:${supColor(z.podw)}"></span>${esc(supName(z.podw))}</td><td class="mono">${esc(z.nr)}</td><td>${esc(z.opis)}</td><td>${esc(z.rodzaj)}</td>
      <td class="num">${z.ilosc??""}</td>${canSeeAmounts()?`<td class="num">${moneyText(V[z.id]?.wartosc)}</td>`:""}<td>${pill(z.status)}</td><td class="small uw">${esc(z.uwagi)}</td><td>${quickBtns(z)}</td></tr>`;
  }
  $("thWkWartosc").hidden=!canSeeAmounts();
  $("wkRows").innerHTML=h;
  const e=$("wkEmpty"); e.hidden=!!list.length; e.innerHTML=`<span>Brak ${wkShow==="open"?"otwartych ":""}odbiorów w tym tygodniu.</span>`;
  const p=wkSup? sup(wkSup):null;
  // mail z planem tygodnia: wybrany podwykonawca – jeden przycisk; bez wyboru – przycisk dla każdego podwykonawcy z odbiorami + cały plan
  const mailto=(sp,L)=>{ const subj=`Plan odbiorów – tydzień ${isoWeek(wkStart)}`+(sp?" – "+sp.nazwa:"");
    return `mailto:${sp&&sp.email?encodeURIComponent(sp.email):""}?${sp&&sp.email2?"cc="+encodeURIComponent(sp.email2)+"&":""}subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(planText(L,sp))}`; };
  const wgPodw=[...new Set(list.map(z=>z.podw))].map(id=>({ s:sup(id), L:list.filter(z=>z.podw===id) })).filter(x=>x.s);
  $("wkMail").innerHTML = `<div class="row"><span class="lbl">Plan tygodnia do wysłania</span>`+
    (list.length? (p? `<a class="btn primary" id="wkMailto" href="${mailto(p,list)}">📧 Wyślij plan do ${esc(p.nazwa)}</a>` : `<a class="btn" id="wkMailAll" href="${mailto(null,list)}" title="Cały plan – adresata wpiszesz w poczcie">📧 Wyślij cały plan</a>`) : "")+
    `<button class="btn sm" type="button" id="wkCopy" ${list.length?"":"disabled"}>Kopiuj treść planu</button></div>`+
    (p? `<div class="row small">Do: ${p.email?`<code>${esc(p.email)}</code>`:"brak adresu – wpiszesz go w poczcie"} ${p.email2?`DW: <code>${esc(p.email2)}</code>`:""}</div>`
       : wgPodw.length? `<div class="row wkPodw">${wgPodw.map(x=>`<a class="btn sm" href="${mailto(x.s,x.L)}" title="${esc([x.s.email,x.s.email2].filter(Boolean).join(", ")||"brak adresu – wpiszesz go w poczcie")}"><span class="sw" style="background:${supColor(x.s.id||x.L[0].podw)}"></span>📧 ${esc(x.s.nazwa)} (${x.L.length})</a>`).join("")}</div>
         <div class="small">Każdy podwykonawca dostaje tylko swoje odbiory – adres z kartoteki podwykonawców.</div>` : "");
  $("wkCopy").onclick=()=>copyText(planText(list,p),"Skopiowano plan tygodnia");
}
export function planText(list, p){
  const lines=[`Plan odbiorów – tydzień ${isoWeek(wkStart)} (${fDs(wkStart)} – ${fD(addD(wkStart,4))})${p?" – "+p.nazwa:""}`,""]; let cur="";
  for(const z of list){
    if(z.data!==cur){ cur=z.data; const dn=DNI[pd(cur).getDay()]; lines.push((lines.length>2?"\n":"")+dn[0].toUpperCase()+dn.slice(1)+" "+fD(cur)+":"); }
    lines.push("- "+[p?null:supName(z.podw), z.nr, (z.opis||"").replace(/\s*\n\s*/g," / "), z.ilosc?z.ilosc+" szt":null].filter(Boolean).join(" – ")+(z.status&&z.status!=="Zlecone"?` [${z.status}]`:"")+(z.uwagi?` (${z.uwagi})`:""));
  }
  return lines.join("\n");
}
export async function copyText(txt,msg){ try{ await navigator.clipboard.writeText(txt); toast(msg); }catch{
  const ta=document.createElement("textarea"); ta.value=txt; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select();
  try{ document.execCommand("copy"); toast(msg);}catch{ toast("Nie udało się skopiować"); } ta.remove(); } }

export function renderZ(){
  fillSupSelect($("zSup"), zSup);
  $("thWartosc").hidden=!canSeeAmounts();
  $("zStatus").innerHTML=`<option value="">Każdy status</option>`+STATUSY.map(s=>`<option ${s===zStatus?"selected":""}>${s}</option>`).join("");
  const q=zQ.trim().toLowerCase();
  let list=Z.filter(z=>(!zSup||z.podw===zSup) && (!zStatus||z.status===zStatus) && (zClosed||zStatus||!closed(z)) &&
    (!q||[z.nr,z.opis,z.uwagi,z.rodzaj].join(" ").toLowerCase().includes(q))).sort(byDate);
  if(zNoAmt){ const ids=new Set(bezKwoty().map(z=>z.id)); list=list.filter(z=>ids.has(z.id)); }
  $("zNoAmtChip").hidden=!zNoAmt;
  $("zRows").innerHTML=list.map(z=>{const a=alertOf(z); return `<tr class="click ${a&&a[1]==="alert-late"?"late":""} ${closed(z)?"closed":""}" data-z="${z.id}">
    <td style="white-space:nowrap"><span class="mono">${fD(z.data)}</span>${z.data?`<br><span class="small">${DNI_K[pd(z.data).getDay()]} · tydz. ${isoWeek(z.data)}</span>`:""}</td>
    <td style="white-space:nowrap"><span class="sw" style="background:${supColor(z.podw)}"></span>${esc(supName(z.podw))}</td><td class="mono">${esc(z.nr)}</td><td>${esc(z.opis)}</td><td>${esc(z.rodzaj)}</td>
    <td class="num">${z.ilosc??""}</td>${canSeeAmounts()?`<td class="num">${moneyText(V[z.id]?.wartosc)}</td>`:""}<td>${pill(z.status)}${z.odebrano?`<br><span class="small">odebr. ${fDs(z.odebrano)}</span>`:""}${kursTag(z)}</td><td>${a?`<span class="${a[1]}">${a[0]}</span>`:""}</td><td class="small uw">${esc(z.uwagi)}</td>
    <td class="small" style="white-space:nowrap">${esc(z.zmienilNazwa||"")}<br>${fTs(z.zmieniono)}</td>
    <td>${quickBtns(z)}</td></tr>`;}).join("");
  const e=$("zEmpty"); e.hidden=!!list.length;
  e.innerHTML = Z.length? `<span>Żadne zlecenie nie pasuje do filtrów.</span>` : `<strong>Brak zleceń</strong><span>Dodaj pierwsze zlecenie przyciskiem „Nowe zlecenie”.</span>`;
}

/* ---------- przypomnienia na Pulpicie (administrator i Zakupowiec) ---------- */
// miesiąc do weryfikacji: bieżący w 3 ostatnie dni robocze, potem poprzedni – aż ktoś go zweryfikuje
export function verMonth(){
  const t=today(), d=pd(t); const last=new Date(d.getFullYear(),d.getMonth()+1,0); let wd=0, cut="";
  while(wd<3){ if(last.getDay()%6!==0){ wd++; cut=iso(last); } last.setDate(last.getDate()-1); }
  return t>=cut ? t.slice(0,7) : iso(new Date(d.getFullYear(),d.getMonth()-1,1)).slice(0,7);
}
export const snoozed = k => { try{ return localStorage.getItem("koop_odloz_"+k)===today(); }catch{ return false; } };
export const snooze = k => { try{ localStorage.setItem("koop_odloz_"+k,today()); }catch{} };
export let zNoAmt=false;
export const bezKwoty = () => { const lim=addD(today(),-30); return Z.filter(z=>z.status==="Odebrane" && z.odebrano && z.odebrano<=lim && kw(z.id)==null); };
export function renderAlerts(){
  const box=$("pAlerts"); if(!box) return;
  if(!canSeeAmounts()){ box.innerHTML=""; return; }
  const h=[], bk=bezKwoty().sort((a,b)=>a.odebrano.localeCompare(b.odebrano));
  if(bk.length && !snoozed("kwoty")){ const z=bk[0], n=bk.length;
    h.push(`<div class="pal bad"><span class="ic">!</span><div><b>${n} ${plural(n,"zlecenie","zlecenia","zleceń")} bez kwoty od ponad miesiąca</b><span class="small">Najstarsze: ${esc(supName(z.podw))} · ${esc(projOf(z))} ${esc(z.opis||"")}, odebrane ${fD(z.odebrano)} (${dniMiedzy(z.odebrano,today())} dni temu)</span></div>
      <div class="acts"><button class="btn sm" type="button" data-alert="kwoty">Pokaż zlecenia</button><button class="btn sm ghost" type="button" data-odloz="kwoty">Przypomnij jutro</button></div></div>`); }
  const ym=verMonth();
  if(Z.length && !WER["m_"+ym] && !snoozed("plik"+ym)){
    const last=Object.entries(WER).filter(([k])=>k.startsWith("m_")).sort().pop();
    h.push(`<div class="pal warn"><span class="ic">i</span><div><b>${ym===today().slice(0,7)?"Koniec miesiąca":"Zaległa weryfikacja"} – pobierz plik przyjęć z magazynu za ${esc(miesNazwa(ym).toLowerCase())}</b><span class="small">${last?"Ostatnia weryfikacja: "+esc(miesNazwa(last[0].slice(2)).toLowerCase())+".":"Jeszcze nie było weryfikacji."} Wgraj eksport przyjęć, a aplikacja sprawdzi, czy kwoty są wpisane i zgodne.</span></div>
      <div class="acts"><button class="btn sm primary" type="button" data-alert="wer">Weryfikuj</button><button class="btn sm ghost" type="button" data-odloz="plik${ym}">Przypomnij jutro</button></div></div>`); }
  box.innerHTML=h.join("");
}
$("pAlerts").addEventListener("click",e=>{
  const o=e.target.closest("[data-odloz]"); if(o){ snooze(o.dataset.odloz); renderAlerts(); return; }
  const a=e.target.closest("[data-alert]"); if(!a) return;
  if(a.dataset.alert==="kwoty"){ zNoAmt=true; zClosed=true; $("zClosed").checked=true; setTab("zlecenia"); renderZ(); }
  else setTab("weryfikacja");
});

/* ---------- wydruk tygodnia (logistyka, bez kwot) ---------- */
export function weekList(){ const end=addD(wkStart,6); return Z.filter(z=>z.status!=="Anulowane" && z.data>=wkStart && z.data<=end && (!wkSup||z.podw===wkSup) && (wkShow==="all"||!closed(z))).sort(byDate); }
// plan tygodnia jako PDF (aplikacja Android nie ma drukowania z przeglądarki; na komputerze przycisk „PDF”)
export async function weekPdf(){
  try{
    const list=weekList(), dni=[0,1,2,3,4].map(i=>addD(wkStart,i)), d=await newPdf("portrait");
    const y=pdfHeader(d,{title:"Odbiory z kooperacji · tydzień "+isoWeek(wkStart),okres:`${fDs(wkStart)} – ${fD(dni[4])}`,
      sub:`${wkSup?supName(wkSup):"wszyscy podwykonawcy"} · ${list.length} ${plural(list.length,"odbiór","odbiory","odbiorów")}`,meta:["Wydrukował: "+(me.nazwa||me.login),"Data: "+fD(today())]});
    const body=list.map(z=>[DNI_K[pd(z.data).getDay()]+" "+fDs(z.data), supName(z.podw), [projOf(z),z.opis].filter(Boolean).join(" · "),
      [z.ilosc!=null&&z.ilosc!==""?z.ilosc+" szt.":"",z.rodzaj].filter(Boolean).join(" · "), z.status+(z.uwagi?"\n"+z.uwagi:""), ""]);
    d.autoTable({head:[["Dzień","Podwykonawca","Projekt / element","Ilość / rodzaj","Status / uwagi","✓"]],body:body.length?body:[["","brak odbiorów w tym tygodniu","","","",""]],startY:y,styles:tStyle,headStyles:hStyle,
      columnStyles:{0:{cellWidth:18},5:{cellWidth:8}},alternateRowStyles:{fillColor:[243,247,252]},margin:{left:14,right:14,bottom:16}});
    pdfFooter(d,"Kooperacje · plan odbiorów · "+nowStamp());
    saveBlob(`plan-odbiorow-tydz-${isoWeek(wkStart)}.pdf`, d.output("blob"));
  }catch(x){ failed(x); }
}
export function printWeek(){
  if(natywna()) return weekPdf();
  const dni=[0,1,2,3,4].map(i=>addD(wkStart,i));
  const list=weekList();
  const it=z=>{ const we=z.data>dni[4]? (pd(z.data).getDay()===6?"Sob: ":"Nd: ") : "";
    return `<div class="pp-it"><b><span class="pp-box"></span>${esc(we+supName(z.podw))}</b><span>${esc([projOf(z),z.opis].filter(Boolean).join(" · "))}</span><small>${esc([z.ilosc!=null&&z.ilosc!==""?z.ilosc+" szt.":"",z.rodzaj].filter(Boolean).join(" · "))}${z.status==="Gotowe do odbioru"?" · gotowe do odbioru":""}${z.status==="Odebrane"?" · odebrane":""}</small>${z.uwagi?`<i>${esc(z.uwagi)}</i>`:""}</div>`; };
  const cols=dni.map((d,i)=>{ const L=list.filter(z=> i===4? z.data>=d : z.data===d); return `<div><h4>${DNI_K[pd(d).getDay()].replace(/^./,c=>c.toUpperCase())} ${fDs(d)}</h4>${L.map(it).join("")||'<div class="pp-it"><small>brak odbiorów</small></div>'}</div>`; }).join("");
  $("printArea").innerHTML=`<div class="pp"><div class="pp-h"><div><b>Odbiory z kooperacji · tydzień ${isoWeek(wkStart)}</b><span>${fDs(wkStart)} – ${fD(dni[4])} · ${wkSup?esc(supName(wkSup)):"wszyscy podwykonawcy"} · ${list.length} ${plural(list.length,"odbiór","odbiory","odbiorów")}</span></div><div class="pp-m">Wydrukował: ${esc(me.nazwa||me.login)}<br>${fD(today())}</div></div><div class="pp-g">${cols}</div><div class="pp-f">Kooperacje · plan odbiorów</div></div>`;
  window.print();
}
$("wkPrint").onclick=printWeek; $("wkPdf").onclick=weekPdf;

export function renderSup(){
  $("sRows").innerHTML=sortedP().map(p=>`<tr class="${isAdmin?"click":""}" data-s="${p.id}"><td class="strong"><span class="sw" style="background:var(--c${p.kolor??7})"></span>${esc(p.nazwa)}</td><td>${esc(p.dzial)}</td><td class="small">${esc(p.adres)}</td>
    <td class="mono">${esc(p.tel)}</td><td class="mono">${esc(p.email)}</td><td>${esc(p.osoba2)}</td><td class="mono">${esc(p.tel2)}</td><td class="mono">${esc(p.email2)}</td>
    <td class="num">${Z.filter(z=>z.podw===p.id).length}</td></tr>`).join("");
  const e=$("sEmpty"); e.hidden=!!P.length; e.innerHTML=`<strong>Brak podwykonawców</strong><span>${isAdmin?"Kliknij „Wczytaj podwykonawców z Excela” albo dodaj ich ręcznie.":"Administrator Truck App musi ich dodać."}</span>`;
  $("rodzList").innerHTML=rodzaje.map((r,i)=>`<span class="tag">${esc(r)}${isAdmin?`<button type="button" data-rmr="${i}" aria-label="Usuń rodzaj ${esc(r)}">×</button>`:""}</span>`).join("");
}

/* ---------- akcje ---------- */
document.addEventListener("click", e=>{
  const odb=e.target.closest("[data-odb]"); if (odb){ e.stopPropagation(); markOdebrane(odb.dataset.odb); return; }
  const got=e.target.closest("[data-gotowe]"); if (got){ e.stopPropagation(); markStatus(got.dataset.gotowe,"Gotowe do odbioru"); return; }
  const add=e.target.closest("[data-add]"); if (add){ if(canWrite) openZ(null,{data:add.dataset.add, podw:calSup}); return; }
  const ev=e.target.closest("[data-z]"); if (ev){ openZ(ev.dataset.z); return; }
  const day=e.target.closest(".day[data-day]"); if(day && narrow()){ calSel=day.dataset.day; if(calSel.slice(0,7)!==calMonth) calMonth=calSel.slice(0,7); renderCal(); return; }
  if(day && canWrite){ openZ(null,{data:day.dataset.day, podw:calSup}); return; }
  const s=e.target.closest("tr[data-s]"); if(s && isAdmin){ openS(s.dataset.s); return; }
  const rm=e.target.closest("[data-rmr]"); if(rm){ const r=rodzaje.slice(); r.splice(+rm.dataset.rmr,1); saveRodz(r); return; }
  const c=e.target.closest("[data-close]"); if(c) c.closest("dialog").close();
});
document.addEventListener("keydown", e=>{ if((e.key==="Enter"||e.key===" ") && e.target.classList?.contains("day")){ e.preventDefault(); if(narrow()){ calSel=e.target.dataset.day; renderCal(); return; } if(canWrite) openZ(null,{data:e.target.dataset.day, podw:calSup}); } });
$("btnNew").onclick=()=>openZ(null,{});
$("btnNewSup").onclick=()=>openS(null);
export const mAdd=n=>{ const d=pd(calMonth+"-01"); d.setMonth(d.getMonth()+n); calMonth=iso(d).slice(0,7); renderCal(); };
$("calPrev").onclick=()=>mAdd(-1); $("calNext").onclick=()=>mAdd(1); $("calToday").onclick=()=>{calMonth=today().slice(0,7); calSel=today(); renderCal();};
$("calSup").onchange=e=>{calSup=e.target.value; renderCal();};
$("calDone").onchange=e=>{calDone=e.target.checked; renderCal();};
$("wkPrev").onclick=()=>{wkStart=addD(wkStart,-7); renderWeek();}; $("wkNext").onclick=()=>{wkStart=addD(wkStart,7); renderWeek();};
$("wkToday").onclick=()=>{wkStart=monday(today()); renderWeek();};
$("wkSup").onchange=e=>{wkSup=e.target.value; renderWeek();}; $("wkShow").onchange=e=>{wkShow=e.target.value; renderWeek();};
$("zSup").onchange=e=>{zSup=e.target.value; renderZ();}; $("zStatus").onchange=e=>{zStatus=e.target.value; renderZ();};
$("zQ").oninput=e=>{zQ=e.target.value; renderZ();}; $("zClosed").onchange=e=>{zClosed=e.target.checked; renderZ();};
$("btnCsv").onclick=exportCsv; $("zNoAmtX").onclick=()=>{ zNoAmt=false; renderZ(); };

/* ---------- zapis zlecenia: wersja + historia w jednej transakcji ---------- */
// wspólny słownik projektów: kod wielkimi literami, do 40 znaków, bez „/” (id dokumentu)
export function dopiszProjekt(kod){
  const k=kodProjektu(kod);
  if(!k || k.length>40 || k.includes("/") || PROJ.some(p=>p.kod===k)) return;
  PROJ.push({kod:k});
  setDoc(doc(db,"projekty",k), {kod:k, zrodla:{koop:true}, utworzono:serverTimestamp(), utworzyl:me.login||""}, {merge:true}).catch(x=>console.warn(x));
}
// kurs w Truck App – logika w logika.js
export const ja = () => ({login:me.login, nazwa:me.nazwa});
export const nowyKurs = (zid, d) => nowyKursL(zid, d, sup(d.podw), ja(), serverTimestamp(), Date.now(), KD);
export const zmianyKursu = (k, d, zmiany) => zmianyKursuL(k, d, zmiany, sup(d.podw), ja(), serverTimestamp(), today());
export async function saveZ(id, data, expectedWersja, force){
  const ref = id? doc(db,C.z,id) : doc(collection(db,C.z));
  return runTransaction(db, async tx=>{
    const snap = await tx.get(ref);
    const cur = snap.exists()? snap.data() : null;
    if (id && !cur) return {gone:true};
    if (cur && !force && (cur.wersja||0)!==(expectedWersja||0)) return {conflict:cur};
    const kRef = cur?.kursId? doc(db,"kursy",cur.kursId) : null;
    const kSnap = kRef? await tx.get(kRef) : null;
    const zmiany = diff(cur, data);
    if (cur && !Object.keys(zmiany).length) return {nochange:true, id:ref.id};
    const kto = {zmieniono:serverTimestamp(), zmienil:me.uid, zmienilNazwa:me.nazwa||me.login};
    // kurs w logistyce
    const otwarte = data.status!=="Anulowane" && data.status!=="Odebrane";
    let kursId = cur?.kursId || "", kurs="";
    if (kSnap && kSnap.exists()){
      const u = zmianyKursu(kSnap.data(), data, zmiany);
      if (u){ tx.update(kRef, u); if(u.dataS) tx.set(doc(db,"koszty",kRef.id), {dataS:u.dataS}, {merge:true}); kurs = rodzajZmianyKursu(u); }
      if (!data.doLog) kursId = "";   // odznaczone: kurs anulowany i odpięty – ponowne zaznaczenie utworzy nowy
    } else if (kSnap && !data.doLog) kursId = "";   // kurs usunięty w Truck App – odpinamy
    if (data.doLog && otwarte && !kursId){
      const nRef = doc(collection(db,"kursy")), nk = nowyKurs(ref.id, data);
      tx.set(nRef, nk);
      tx.set(doc(db,"koszty",nRef.id), {dataS:nk.dataS, koszt:null, waluta:"PLN", dopl:null, faktura:null, oferty:null, zapytanie:null});
      kursId = nRef.id; kurs = "nowy";
    }
    const extra = {kursId};
    if (cur) tx.update(ref, {...data, ...kto, ...extra, wersja:(cur.wersja||0)+1});
    else tx.set(ref, {...data, ...kto, ...extra, utworzono:serverTimestamp(), utworzyl:me.uid, utworzylNazwa:me.nazwa||me.login, wersja:1});
    tx.set(doc(collection(ref,"historia")), {kiedy:serverTimestamp(), kto:me.uid, nazwa:me.nazwa||me.login, akcja:cur?"zmiana":"utworzenie", zmiany});
    return {ok:true, nowy:!cur, id:ref.id, kurs};
  });
}
export const kursStan = z => kursStanL(z, KR[z.kursId]);
export const kursTag = z => { const s=kursStan(z); return s? `<br><span class="pill ${s.cls}" title="Kurs w Truck App">${esc(s.txt)}</span>` : ""; };
export function pokazKurs(z){
  const box=$("zKurs"), s=z? kursStan(z) : null;
  if(!s){ box.hidden=true; return; }
  const k=KR[z.kursId];
  box.hidden=false;
  box.innerHTML=`<b>Truck App:</b> <span class="pill ${s.cls}">${esc(s.txt)}</span>${k?` <span class="small">status: ${esc(k.status||"")}${k.zal?" · odbiór "+fD(k.zal):""}</span>`:""}${s.dl?`<div class="small">${esc(s.dl)}</div>`:""}`;
}

export let zId=null, zWersja=0;
export function fillZ(v){
  $("z_data").value=v.data||""; $("z_podw").value=v.podw||""; $("z_nr").value=v.nr||""; $("z_rodzaj").value=v.rodzaj||"";
  $("z_opis").value=v.opis||""; $("z_ilosc").value=v.ilosc??""; $("z_status").value=v.status||"Zlecone"; $("z_odebrano").value=v.odebrano||""; $("z_uwagi").value=v.uwagi||"";
  $("z_wartosc").value=zId && V[zId]?.wartosc!=null ? V[zId].wartosc : "";
  $("z_dolog").checked=!!v.doLog;
}
export function openZ(id, preset){
  const z = id? Z.find(x=>x.id===id) : null;
  if(!z && !canWrite) return;
  if(!P.length && !z){ toast("Najpierw trzeba dodać podwykonawców (zakładka Podwykonawcy)"); setTab("podwykonawcy"); return; }
  zId=id; zWersja=z?.wersja||0;
  const v = z || {data:preset.data||today(), podw:preset.podw||sortedP()[0]?.id, status:"Zlecone", doLog:true};
  $("zTitle").textContent = z? "Zlecenie "+(z.nr||fD(z.data)) : "Nowe zlecenie";
  $("z_podw").innerHTML=sortedP().map(p=>`<option value="${p.id}">${esc(p.nazwa)}</option>`).join("");
  const rs=[...new Set([...rodzaje, v.rodzaj].filter(Boolean))];
  $("z_rodzaj").innerHTML=`<option value="">—</option>`+rs.map(r=>`<option>${esc(r)}</option>`).join("");
  $("z_status").innerHTML=STATUSY.map(s=>`<option>${s}</option>`).join("");
  // podpowiedzi: numery z Kooperacji + wspólny słownik projektów (Truck App, Zapytania, Kombajn)
  const opisProj=new Map(PROJ.map(p=>[p.kod,[p.nazwa,p.klient].filter(Boolean).join(" · ")]));
  $("projList").innerHTML=[...new Set([...Z.map(z=>(z.nr||"").trim()).filter(Boolean), ...PROJ.map(p=>p.kod)])].sort((a,b)=>a.localeCompare(b,"pl")).map(n=>`<option value="${esc(n)}">${esc(opisProj.get(n)||"")}</option>`).join("");
  fillZ(v);
  $("zDel").hidden=!z||!isAdmin; $("zDelAsk").hidden=true; $("zErr").hidden=true; $("zConflict").hidden=true;
  $("zWartoscWrap").hidden=!canSeeAmounts();
  $("z_wartosc").disabled=!canSeeAmounts();
  $("fZ").querySelectorAll(".grid input,.grid select,.grid textarea").forEach(el=>{ if(el.id!=="z_wartosc") el.disabled=!canWrite; });
  $("zSave").hidden=!canWrite; $("zSave").textContent="Zapisz";
  loadAudit(z); pokazKurs(z);
  $("dlgZ").showModal();
}
export async function loadAudit(z){
  const box=$("zAudit");
  if(!z){ box.hidden=true; return; }
  box.hidden=false;
  box.innerHTML=`<div>Dodał(a): <b>${esc(z.utworzylNazwa||"—")}</b> ${fTs(z.utworzono)} · Ostatnio: <b>${esc(z.zmienilNazwa||"—")}</b> ${fTs(z.zmieniono)}</div><div class="lbl">Historia zmian</div><ul><li>Wczytywanie…</li></ul>`;
  try{
    const qs=await getDocs(query(collection(db,C.z,z.id,"historia"), orderBy("kiedy","desc"), limit(30)));
    const val=(k,v)=> k==="podw"? supName(v) : (k==="data"||k==="odebrano")? (fD(v)||"—") : (v===""||v==null?"—":v);
    box.querySelector("ul").innerHTML = qs.docs.map(d=>{ const h=d.data();
      const ch=Object.entries(h.zmiany||{}).map(([k,[a,b]])=> h.akcja==="utworzenie"? null : `${POLA_NAZWY[k]||k}: ${esc(val(k,a))} → ${esc(val(k,b))}`).filter(Boolean).join("; ");
      return `<li>${fTs(h.kiedy)} · <b>${esc(h.nazwa)}</b> · ${h.akcja==="utworzenie"?"dodał(a) zlecenie":esc(ch)}</li>`; }).join("") || "<li>Brak wpisów.</li>";
  }catch(x){ box.querySelector("ul").innerHTML=`<li>Nie udało się wczytać historii.</li>`; }
}
$("z_status").onchange=e=>{ if(e.target.value==="Odebrane" && !$("z_odebrano").value) $("z_odebrano").value=today(); };
export function readZ(){
  return { data:$("z_data").value, podw:$("z_podw").value, nr:$("z_nr").value.trim(), rodzaj:$("z_rodzaj").value, opis:$("z_opis").value.trim(),
    ilosc: $("z_ilosc").value===""? null : Math.round(+$("z_ilosc").value), status:$("z_status").value, odebrano:$("z_odebrano").value, uwagi:$("z_uwagi").value.trim(), doLog:$("z_dolog").checked };
}
export let forceNext=false;
// Enter w polach jednowierszowych nie zapisuje zlecenia (w opisie i uwagach – nowa linia); zapis tylko przyciskiem „Zapisz”
$("fZ").addEventListener("keydown", e=>{ if(e.key==="Enter" && e.target.tagName==="INPUT" && e.target.type!=="checkbox") e.preventDefault(); });
$("fZ").addEventListener("submit", async e=>{
  e.preventDefault();
  const d=readZ();
  const amountRaw=canSeeAmounts()?$("z_wartosc").value.trim():"";
  const amount=amountRaw===""?null:Number(amountRaw.replace(",","."));
  const err = !d.data? "Podaj datę odbioru." : !d.podw? "Wybierz podwykonawcę." : (!d.nr && !d.opis)? "Wpisz nr zlecenia albo opis elementu." :
    (canSeeAmounts() && amountRaw!=="" && (!Number.isFinite(amount)||amount<0))? "Wpisz prawidłową, nieujemną wartość zamówienia." : "";
  if(err){ $("zErr").textContent=err; $("zErr").hidden=false; return; }
  if(d.status==="Odebrane" && !d.odebrano) d.odebrano=today();
  const proj=await resolveProject(d); if(proj===null) return;
  d.projekt=proj;
  $("zSave").disabled=true;
  try{
    const r=await saveZ(zId, d, zWersja, forceNext);
    if(r.ok) dopiszProjekt(projOf(d));   // nowy kod trafia do wspólnego słownika projektów
    forceNext=false;
    if(r.conflict){ showConflict(r.conflict); return; }
    if(r.gone){ $("zErr").textContent="To zlecenie zostało w międzyczasie usunięte."; $("zErr").hidden=false; return; }
    let kwotaZmieniona=false;
    const zid=r.id||zId;
    if(canSeeAmounts() && zid){
      const stara=V[zid]?.wartosc ?? null, nowa=amount===null?null:Math.round(amount*100)/100;
      if(stara!==nowa){
        const valueRef=doc(db,C.v,zid);
        if(nowa===null) await deleteDoc(valueRef);
        else await setDoc(valueRef,{wartosc:nowa, zrodlo:"recznie", zmieniono:serverTimestamp(), zmienil:me.uid, zmienilNazwa:me.nazwa||me.login},{merge:true});
        kwotaZmieniona=true;
      }
    }
    const kt = r.kurs==="nowy"? " – logistyka dostała kurs do przypisania kierowcy" : r.kurs==="anulowany"? " – kurs w Truck App anulowany" : r.kurs==="dostarczony"? " – kurs w Truck App zamknięty jako dowieziony" : r.kurs==="przywrocony"? " – kurs w Truck App przywrócony, logistyka przypisze kierowcę" : r.kurs==="zmieniony"? " – kurs w Truck App zaktualizowany" : "";
    toast((r.nowy? "Dodano zlecenie" : !r.nochange? "Zapisano zmiany" : kwotaZmieniona? "Zapisano wartość zamówienia" : "Bez zmian")+kt);
    $("dlgZ").close();
  }catch(x){ failed(x); }
  finally{ $("zSave").disabled=false; }
});
export function showConflict(cur){
  const box=$("zConflict"); box.hidden=false;
  box.innerHTML=`<div><b>${esc(cur.zmienilNazwa||"Ktoś")}</b> zmienił(a) to zlecenie ${fTs(cur.zmieniono)}, gdy je edytowałeś(aś). Twoje zmiany nie zostały jeszcze zapisane.</div>
    <div class="toolbar"><button class="btn sm" type="button" id="cfLoad">Wczytaj ich wersję</button><button class="btn sm" type="button" id="cfForce">Zapisz moją wersję mimo to</button></div>`;
  $("cfLoad").onclick=()=>{ fillZ(cur); zWersja=cur.wersja||0; box.hidden=true; loadAudit({...cur, id:zId}); toast("Wczytano aktualną wersję"); };
  $("cfForce").onclick=()=>{ forceNext=true; $("fZ").requestSubmit(); };
}
$("zDel").onclick=()=>{$("zDelAsk").hidden=false;};
$("zDelYes").onclick=async()=>{
  const z=Z.find(x=>x.id===zId); if(!z) return;
  try{
    const b=writeBatch(db); const {id, ...rest}=z;
    b.set(doc(db,C.kosz,zId), {...rest, usunieto:serverTimestamp(), usunal:me.uid, usunalNazwa:me.nazwa||me.login});
    b.delete(doc(db,C.z,zId)); b.delete(doc(db,C.v,zId));
    const k=z.kursId? KR[z.kursId] : null;
    if(k && !kursZamkniety(k)) b.update(doc(db,"kursy",z.kursId), {status:"Anulowane", zmieniono:serverTimestamp(), zmienil:me.login||""});
    await b.commit();
    toast("Usunięto zlecenie (kopia zostaje w koszu w bazie)"+(k && !kursZamkniety(k)?" – kurs w Truck App anulowany":"")); $("dlgZ").close();
  }catch(x){ failed(x); }
};
export async function markStatus(id, status){
  const z=Z.find(x=>x.id===id); if(!z) return;
  const d={}; for(const k of POLA) d[k]=z[k]??(k==="ilosc"?null:""); d.status=status; if(status==="Odebrane") d.odebrano=today();
  try{ const r=await saveZ(id,d,z.wersja||0,false);
    if(r.conflict){ toast("Ktoś właśnie zmienił to zlecenie – otwórz je i sprawdź"); return; }
    toast(status==="Odebrane"?"Oznaczono jako odebrane":"Oznaczono: gotowe do odbioru"); }catch(x){ failed(x); }
}
export const markOdebrane = id => markStatus(id,"Odebrane");
// przyciski szybkiej zmiany statusu w wierszu
export function quickBtns(z){
  if(!canWrite || closed(z)) return "";
  return `<span class="qb">${z.status!=="Gotowe do odbioru"?`<button class="btn sm" type="button" data-gotowe="${z.id}" title="Oznacz: gotowe do odbioru">Gotowe</button>`:""}<button class="btn sm" type="button" data-odb="${z.id}" title="Oznacz jako odebrane">Odebrane</button></span>`;
}

/* ---------- komunikaty ---------- */
export function failed(x){
  const c=x&&x.code;
  console.warn(x);
  toast(c==="permission-denied"? "Brak uprawnień do tej operacji." : c==="unavailable"? "Brak połączenia z bazą – spróbuj za chwilę." : "Nie udało się zapisać: "+(x&&x.message||x));
}
export let tt; export function toast(m){ const t=$("toast"); t.textContent=m; t.hidden=false; clearTimeout(tt); tt=setTimeout(()=>t.hidden=true,3000); }
export function note(m, bad){ const n=$("notice"); n.textContent=m||""; n.hidden=!m; n.classList.toggle("bad",!!bad); }

/* ---------- logowanie i dane ---------- */
$("fLogin").addEventListener("submit", async e=>{
  e.preventDefault();
  const l=$("lLogin").value, p=$("lPass").value;
  if(!normLogin(l)||!p){ $("lErr").textContent="Wpisz login i hasło."; $("lErr").hidden=false; return; }
  $("lBtn").disabled=true; $("lErr").hidden=true;
  try{ await zaloguj(SDK, auth, l, p); }
  catch(x){ $("lErr").textContent = komunikat(x); $("lErr").hidden=false;
  } finally { $("lBtn").disabled=false; }
});
export const doOut=()=>signOut(auth);
$("btnOut").onclick=doOut; $("msgOut").onclick=doOut;

export function stopSubs(){ subs.forEach(u=>{try{u();}catch{}}); subs=[]; }
export function startData(){
  const lost=x=>{ console.warn(x); note(x&&x.code==="permission-denied"? "Baza odmawia dostępu do Kooperacji. Administrator musi dodać reguły Kooperacji w Firebase (instrukcja, krok 1)." : "Utracono połączenie z bazą. Odśwież stronę.", true); };
  subs.push(onSnapshot(collection(db,C.z), s=>{ Z=s.docs.map(d=>({id:d.id,...d.data()})); render(); }, lost));
  subs.push(onSnapshot(collection(db,C.p), s=>{ P=s.docs.map(d=>({id:d.id,...d.data()})); render(); }, lost));
  PROJ=[];
  subs.push(onSnapshot(collection(db,"projekty"), s=>{ PROJ=s.docs.map(d=>d.data()); }, x=>console.warn(x)));
  KR={};
  subs.push(onSnapshot(query(collection(db,"kursy"), where("zrodlo","==","KOOP")), s=>{ KR=Object.fromEntries(s.docs.map(d=>[d.id,d.data()])); renderZ(); if(zId && $("dlgZ").open) pokazKurs(Z.find(x=>x.id===zId)); }, x=>console.warn(x)));
  V={};
  if(canSeeAmounts()) subs.push(onSnapshot(collection(db,C.v), s=>{ V=Object.fromEntries(s.docs.map(d=>[d.id,d.data()])); renderZ(); renderRaporty(); renderAlerts(); if(VER.rows.length) renderVer(false); if(zId && $("dlgZ").open) $("z_wartosc").value=V[zId]?.wartosc??""; }, lost));
  KO={};
  if(canSeeAmounts()) subs.push(onSnapshot(collection(db,C.k), s=>{ KO=Object.fromEntries(s.docs.map(d=>[d.id,d.data()])); renderRaporty(); if(VER.rows.length) renderVer(false); }, x=>console.warn(x)));
  KD=null;
  subs.push(onSnapshot(doc(db,"ustawienia","glowne"), s=>{ const o=s.exists()? s.data().koopOdbior : null; KD= o&&o.kier? o : null; }, x=>console.warn(x)));
  ustawWER({});
  if(canSeeAmounts()) subs.push(onSnapshot(doc(db,C.u,"weryfikacje"), s=>{ ustawWER(s.exists()? s.data() : {}); renderAlerts(); if(tab==="weryfikacja") renderVer(false); }, x=>console.warn(x)));
  subs.push(onSnapshot(doc(db,C.u,"slowniki"), s=>{ rodzajeZapisane=s.exists(); if(s.exists() && Array.isArray(s.data().rodzaje)) rodzaje=s.data().rodzaje.slice(); render(); }, lost));
}

export let userUnsub=null, metaUnsub=null, adminUid="";
onAuthStateChanged(auth, u=>{
  stopSubs(); if(userUnsub){userUnsub();userUnsub=null;} if(metaUnsub){metaUnsub();metaUnsub=null;}
  if(kontaUnsub){kontaUnsub();kontaUnsub=null;} K=[];
  me=null; Z=[]; P=[]; V={}; isBuyer=false; isAdmin=false;
  if(!u){ show("login"); return; }
  show("msg","Sprawdzam uprawnienia…");
  let started=false, konto=null, metaOk=false, userOk=false;
  const deny=m=>{ stopSubs(); started=false; me=null; isAdmin=false; isBuyer=false; V={}; watchKonta(); show("msg",m); };
  // decyzja o dostępie, gdy znamy i konto, i administratora
  const decide=()=>{
    if(!metaOk || !userOk) return;
    const k=konto, d=dostepBiura(u.uid, k, adminUid, "kooperacje");   // wspólna reguła SteelFlow
    if(!d.ok) return deny(k && k.rola==="biuro" && k.aktywny!==false ? "To konto nie ma dostępu do Kooperacji. Dostęp nadaje administrator w zakładce Dostęp." : d.powod);
    isAdmin = d.admin;
    isBuyer = k.koopZakupowiec===true;
    me={uid:u.uid, login:k.login||"", nazwa:k.nazwa||k.login||""};
    canWrite=true;
    show("app");
    if(!started){ started=true; startData(); }
    watchKonta();
    render();
  };
  metaUnsub=onSnapshot(doc(db,"meta","init"), s=>{ adminUid = s.exists()? (s.data().admin||"") : ""; metaOk=true; decide(); }, ()=>{ metaOk=true; decide(); });
  userUnsub=onSnapshot(doc(db,"uzytkownicy",u.uid), s=>{
    if(!s.exists() && s.metadata.fromCache) return;
    if(started){ stopSubs(); started=false; V={}; }
    konto=s.exists()? s.data() : null; userOk=true; decide();
  }, x=>{ show("msg","Nie udało się sprawdzić konta: "+(x&&x.code||x)); });
});
