import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator, collection, doc, onSnapshot, runTransaction, serverTimestamp, getDoc, getDocs, query, where, orderBy, limit, writeBatch, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { normLogin, iso, today, pd, addD, monday, isoWeek, fD, fDs, dniMiedzy, esc, plural, STATUSY, POLA, POLA_NAZWY, closed, projOf, alertOf as alertDnia, diff,
  normTxt, cellDate, cellNum, nrInText, kodProjektu, matchSup as matchSupL, kursZamkniety, nowyKurs as nowyKursL, zmianyKursu as zmianyKursuL, rodzajZmianyKursu, kursStan as kursStanL, podwykonawcyZArkusza, dopasujPZ, idKosztu } from "./logika.js?v=2";

/* ===== Firebase – ten sam projekt co Truck App ===== */
const firebaseConfig = {
  apiKey: "AIzaSyB8Zi3CTsEJDqnxpt2EpmEN0JKbQZkx9Ik",
  authDomain: "logistyka-app-41d7a.firebaseapp.com",
  projectId: "logistyka-app-41d7a",
  storageBucket: "logistyka-app-41d7a.firebasestorage.app",
  messagingSenderId: "730726420764",
  appId: "1:730726420764:web:fbd4a12acd2b5ebdb52ad9"
};
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
// adres ?emu na localhost łączy z lokalnym emulatorem bazy (testy ekranowe, tests/e2e)
if (new URLSearchParams(location.search).has("emu") && ["localhost","127.0.0.1"].includes(location.hostname)) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings:true }); connectFirestoreEmulator(db, "127.0.0.1", 8085);
}
// Login → konto Firebase dokładnie tak jak w Truck App
const loginEmail = t => normLogin(t) + "@konta." + firebaseConfig.authDomain;

const C = { z:"koop_zlecenia", p:"koop_podwykonawcy", u:"koop_ustawienia", kosz:"koop_kosz", v:"koop_wartosci", k:"koop_koszty" };
const $ = id => document.getElementById(id);
const RODZAJE_DOMYSLNE = ["Rynny","Kątowniki","Ceowniki","Uszka mobilne","Elementy zimnogięte","Blachy i obróbki","Bramy","Inne"];
const DNI = ["niedziela","poniedziałek","wtorek","środa","czwartek","piątek","sobota"];
const DNI_K = ["nd","pn","wt","śr","cz","pt","sb"];
const MIES = ["styczeń","luty","marzec","kwiecień","maj","czerwiec","lipiec","sierpień","wrzesień","październik","listopad","grudzień"];
const MIES_D = ["stycznia","lutego","marca","kwietnia","maja","czerwca","lipca","sierpnia","września","października","listopada","grudnia"];
const MIES_K = ["sty","lut","mar","kwi","maj","cze","lip","sie","wrz","paź","lis","gru"];

let PROJ = [];   // wspólny słownik projektów (kolekcja projekty)
let Z = [], P = [], V = {}, KR = {}, KO = {}, rodzaje = RODZAJE_DOMYSLNE.slice();
let KD = null;   // domyślny kierowca i auto do odbiorów z kooperacji (Truck App: ustawienia/glowne.koopOdbior)
let rodzajeZapisane = true;
let me = null;               // {uid, login, nazwa, admin}
let subs = [];
let canWrite = false, isAdmin = false, isBuyer = false;
const canSeeAmounts = () => isAdmin || isBuyer;
const moneyText = v => v==null || v==="" ? "—" : Number(v).toLocaleString("pl-PL",{minimumFractionDigits:2,maximumFractionDigits:2})+" zł";

/* ---------- daty ---------- */
const tsDate = t => t && typeof t.toDate==="function" ? t.toDate() : null;
const fTs = t => { const d=tsDate(t); return d ? String(d.getDate()).padStart(2,"0")+"."+String(d.getMonth()+1).padStart(2,"0")+" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0") : ""; };

/* ---------- pomocnicze ---------- */
const sup = id => P.find(p=>p.id===id);
const supName = id => sup(id)?.nazwa || "—";
const supColor = id => `var(--c${sup(id)?.kolor ?? 7})`;
const alertOf = z => alertDnia(z, today());
const stClass = s => "st-"+String(s||"Zlecone").split(" ")[0];
const pill = s => `<span class="pill ${stClass(s)}">${esc(s||"Zlecone")}</span>`;
const byDate = (a,b) => (a.data||"9").localeCompare(b.data||"9") || supName(a.podw).localeCompare(supName(b.podw),"pl");
const sortedP = () => P.slice().sort((a,b)=>(a.kolejnosc??99)-(b.kolejnosc??99)||String(a.nazwa).localeCompare(String(b.nazwa),"pl"));

/* ---------- widoki ---------- */
function show(view, msg){
  $("vLogin").hidden = view!=="login"; $("vApp").hidden = view!=="app"; $("vMsg").hidden = view!=="msg";
  if (view==="msg"){ $("msgText").textContent = msg; $("msgOut").hidden = !auth.currentUser; }
}
const TABS=["pulpit","kalendarz","tydzien","zlecenia","podwykonawcy","raporty","weryfikacja","dostep"];
let tab="pulpit";
function setTab(t){ tab=TABS.includes(t)?t:"pulpit"; if((tab==="raporty"||tab==="weryfikacja") && !canSeeAmounts()) tab="pulpit"; if(tab==="dostep" && !isAdmin) tab="pulpit"; for(const k of TABS) $("v-"+k).hidden = k!==tab;
  document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-selected", b.dataset.tab===tab));
  try{ history.replaceState(null,"","#"+tab); }catch{}
  if(me) renderTab(); }
document.querySelector("nav.tabs").addEventListener("click",e=>{ const b=e.target.closest("button[data-tab]"); if(b) setTab(b.dataset.tab); });
setTab((location.hash||"").slice(1));

let calMonth = today().slice(0,7), calSup="", calDone=true, calSel="";
const narrow = () => matchMedia("(max-width:700px)").matches;
let wkStart = monday(today()), wkSup="", wkShow="open";
let zSup="", zStatus="", zQ="", zClosed=false;
function fillSupSelect(el, val){ el.innerHTML = `<option value="">Wszyscy podwykonawcy</option>`+sortedP().map(p=>`<option value="${p.id}" ${p.id===val?"selected":""}>${esc(p.nazwa)}</option>`).join(""); }

function render(){
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
function renderTab(){
  if (!me) return;
  ({ pulpit:renderPulpit, kalendarz:renderCal, tydzien:renderWeek, zlecenia:renderZ, podwykonawcy:renderSup, dostep:renderDostep,
     raporty:renderRaporty, weryfikacja:()=>{ if(canSeeAmounts()) renderVer(false); } })[tab]?.();
}

/* ---------- dostęp (administrator): pole uzytkownicy/{uid}.kooperacje ---------- */
let K = [];   // konta biura z Truck App
function renderDostep(){
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
let kontaUnsub=null;
function watchKonta(){
  if (isAdmin && !kontaUnsub){
    kontaUnsub=onSnapshot(query(collection(db,"uzytkownicy"), where("rola","==","biuro")), s=>{ K=s.docs.map(d=>({uid:d.id,...d.data()})); renderDostep(); }, x=>console.warn(x));
  } else if (!isAdmin && kontaUnsub){ kontaUnsub(); kontaUnsub=null; K=[]; }
}

function renderPulpit(){
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

function evHtml(z, showDate){
  const a=alertOf(z), late=a&&a[1]==="alert-late";
  const label=[z.nr, z.opis].filter(Boolean).join(" · ") || z.rodzaj || "zlecenie";
  return `<button type="button" class="ev ${late?"late":""} ${closed(z)?"done":""}" data-z="${z.id}" style="--c:${supColor(z.podw)}" title="${esc(supName(z.podw))} · ${esc(z.status)}">${showDate?`<span class="we">${DNI_K[pd(z.data).getDay()]} ${fDs(z.data)} · </span>`:""}${esc(label)}</button>`;
}
function renderCal(){
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

function renderWeek(){
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
  $("wkMail").innerHTML = `<div class="row"><span class="lbl">Plan tygodnia do wysłania</span><button class="btn sm" type="button" id="wkCopy" ${list.length?"":"disabled"}>Kopiuj treść planu</button>${p&&p.email&&list.length?`<a class="btn sm" id="wkMailto" href="#">Otwórz w poczcie</a>`:""}</div>`+
    (p? `<div class="row small">Do: ${p.email?`<code>${esc(p.email)}</code>`:"brak adresu"} ${p.email2?`DW: <code>${esc(p.email2)}</code>`:""}</div>`
       : `<div class="small">Wybierz podwykonawcę, żeby zobaczyć adresy e-mail (Do i DW) do wysłania planu.</div>`);
  $("wkCopy").onclick=()=>copyText(planText(list,p),"Skopiowano plan tygodnia");
  const mt=$("wkMailto"); if(mt){ const subj=`Plan odbiorów – tydzień ${isoWeek(wkStart)}`;
    mt.href=`mailto:${encodeURIComponent(p.email)}?${p.email2?"cc="+encodeURIComponent(p.email2)+"&":""}subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(planText(list,p))}`; }
}
function planText(list, p){
  const lines=[`Plan odbiorów – tydzień ${isoWeek(wkStart)} (${fDs(wkStart)} – ${fD(addD(wkStart,4))})${p?" – "+p.nazwa:""}`,""]; let cur="";
  for(const z of list){
    if(z.data!==cur){ cur=z.data; const dn=DNI[pd(cur).getDay()]; lines.push((lines.length>2?"\n":"")+dn[0].toUpperCase()+dn.slice(1)+" "+fD(cur)+":"); }
    lines.push("- "+[p?null:supName(z.podw), z.nr, z.opis, z.ilosc?z.ilosc+" szt":null].filter(Boolean).join(" – ")+(z.status&&z.status!=="Zlecone"?` [${z.status}]`:"")+(z.uwagi?` (${z.uwagi})`:""));
  }
  return lines.join("\n");
}
async function copyText(txt,msg){ try{ await navigator.clipboard.writeText(txt); toast(msg); }catch{
  const ta=document.createElement("textarea"); ta.value=txt; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select();
  try{ document.execCommand("copy"); toast(msg);}catch{ toast("Nie udało się skopiować"); } ta.remove(); } }

function renderZ(){
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

/* ---------- wspólne: biblioteki, pliki, kwoty, projekty ---------- */
const loadScript = src => new Promise((ok,err)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=()=>err(new Error("Nie udało się wczytać "+src)); document.head.appendChild(s); });
let xlsxReady=null, pdfReady=null;
function loadXlsx(){ if(!xlsxReady) xlsxReady=(window.XLSX?Promise.resolve():loadScript("vendor/xlsx.full.min.js")).catch(e=>{xlsxReady=null; throw e;}); return xlsxReady; }
function loadPdf(){
  if(!pdfReady) pdfReady=(window.jspdf?Promise.resolve():loadScript("vendor/jspdf.umd.min.js"))
    .then(()=>window.jspdf.jsPDF.API.autoTable?null:loadScript("vendor/jspdf.plugin.autotable.min.js"))
    .then(()=>window.PDF_FONT_R?null:loadScript("vendor/pdf-fonts.js")).catch(e=>{pdfReady=null; throw e;});
  return pdfReady;
}
// aplikacja Android (Capacitor): pliki idą przez okno „Udostępnij” (zapis w Pobranych, Dysk, mail…) – jak w Zapytaniach
const natywna = () => !!globalThis.Capacitor?.isNativePlatform?.();
const base64 = blob => new Promise((ok,err)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result).split(",")[1]); r.onerror=err; r.readAsDataURL(blob); });
async function udostepnij(name, blob){
  const { Filesystem, Share } = globalThis.Capacitor.Plugins;
  const plik = await Filesystem.writeFile({ path:name, data:await base64(blob), directory:"CACHE" });
  await Share.share({ title:name, files:[plik.uri], dialogTitle:"Zapisz lub wyślij plik" });
}
function saveBlob(name, blob){ if(natywna()) return udostepnij(name, blob).catch(x=>{ if(!/cancel/i.test(x?.message||"")) toast("Nie udało się zapisać pliku: "+(x?.message||x)); });
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},1500); }
const safeName = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[łŁ]/g,"l").replace(/[^A-Za-z0-9._-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,60);
const kw = id => { const v=V[id]?.wartosc; return v==null||v===""||!Number.isFinite(Number(v)) ? null : Number(v); };
const r2 = v => Math.round((v||0)*100)/100;
const zl2 = v => v==null ? "—" : Number(v).toLocaleString("pl-PL",{minimumFractionDigits:2,maximumFractionDigits:2});
const pct = (v,t) => t ? (v/t*100).toLocaleString("pl-PL",{minimumFractionDigits:1,maximumFractionDigits:1})+"%" : "—";
const tsIso = t => { const d=tsDate(t); return d ? iso(d) : ""; };
const nowStamp = () => { const d=new Date(); return fD(iso(d))+" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); };
const miesNazwa = ym => ym ? MIES[+ym.slice(5)-1].replace(/^./,c=>c.toUpperCase())+" "+ym.slice(0,4) : "";

/* ---------- PDF w stylu Kalkulatora stali (niebieski) ---------- */
const PDF_BLUE=[31,78,140], PDF_LINE=[67,148,208], PDF_TXT=[21,32,43], PDF_MUTED=[86,104,122];
const PIE_KOL=["#1f4e8c","#3a78c2","#6fa3dc","#a3c6ec","#cfe0f5","#8aa4c2","#5b7699"];
async function newPdf(orient){
  await loadPdf();
  const d=new window.jspdf.jsPDF({orientation:orient||"portrait",unit:"mm",format:"a4"});
  d.addFileToVFS("dv.ttf",window.PDF_FONT_R); d.addFont("dv.ttf","DV","normal");
  d.addFileToVFS("dvb.ttf",window.PDF_FONT_B); d.addFont("dvb.ttf","DV","bold");
  d.setFont("DV","normal"); return d;
}
let logoPng=null;
async function logoData(){
  if(logoPng) return logoPng;
  try{
    const svg=await (await fetch("icon.svg")).text();
    const img=new Image(); img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg); await img.decode();
    const c=document.createElement("canvas"); c.width=c.height=256; c.getContext("2d").drawImage(img,0,0,256,256);
    return logoPng=c.toDataURL("image/png");
  }catch{ return null; }
}
function pdfHeader(d,{title,okres,sub,meta,logo}){
  const W=d.internal.pageSize.getWidth(); let x=14;
  if(logo){ d.addImage(logo,"PNG",14,9,15,15); x=32; }
  d.setFont("DV","bold"); d.setFontSize(16); d.setTextColor(...PDF_TXT); d.text(title,x,15);
  if(okres){ d.setFontSize(10.5); d.setTextColor(...PDF_BLUE); d.text(okres,x,21); }
  d.setFont("DV","normal"); d.setFontSize(8.5); d.setTextColor(...PDF_MUTED);
  if(sub) d.text(sub,x,26);
  let y=12; (meta||[]).forEach(t=>{ d.text(t,W-14,y,{align:"right"}); y+=4.4; });
  const ly=Math.max(y,29.5); d.setDrawColor(...PDF_LINE); d.setLineWidth(.8); d.line(14,ly,W-14,ly);
  return ly+5;
}
function pdfFooter(d,note){
  const n=d.internal.getNumberOfPages(), W=d.internal.pageSize.getWidth(), H=d.internal.pageSize.getHeight();
  for(let i=1;i<=n;i++){ d.setPage(i); d.setFont("DV","normal"); d.setFontSize(7.5); d.setTextColor(120,132,144);
    d.text(note,14,H-8); d.text("Strona "+i+" z "+n,W-14,H-8,{align:"right"}); }
}
const tStyle={font:"DV",fontSize:8.2,cellPadding:1.6,lineColor:[211,218,225],lineWidth:.1,textColor:PDF_TXT};
const hStyle={fillColor:PDF_BLUE,textColor:255,fontStyle:"bold",halign:"center",valign:"middle"};
const fStyle={fillColor:[223,234,247],textColor:PDF_TXT,fontStyle:"bold"};
function pieCanvas(parts){
  const c=document.createElement("canvas"); c.width=c.height=600; const g=c.getContext("2d");
  const tot=parts.reduce((a,p)=>a+p.v,0); let a0=-Math.PI/2;
  parts.forEach((p,i)=>{ const a1=a0+2*Math.PI*p.v/tot; g.beginPath(); g.moveTo(300,300); g.arc(300,300,280,a0,a1); g.closePath();
    g.fillStyle=PIE_KOL[i%PIE_KOL.length]; g.fill(); g.lineWidth=6; g.strokeStyle="#fff"; g.stroke();
    const sh=p.v/tot; if(sh>=.06){ const m=(a0+a1)/2; g.fillStyle=i<2||i===6?"#fff":"#15202b"; g.font="bold 40px sans-serif"; g.textAlign="center"; g.textBaseline="middle";
      g.fillText(Math.round(sh*100)+"%",300+180*Math.cos(m),300+180*Math.sin(m)); }
    a0=a1; });
  return c.toDataURL("image/png");
}
// wykres kołowy + legenda + podsumowanie pod tabelą
function pdfPie(d,y,parts,title,sum){
  const W=d.internal.pageSize.getWidth(), H=d.internal.pageSize.getHeight();
  if(y+56>H-14){ d.addPage(); y=16; }
  d.setDrawColor(201,216,234); d.setLineWidth(.3); d.roundedRect(14,y,W-28,52,1.5,1.5);
  const tot=parts.reduce((a,p)=>a+p.v,0);
  if(tot>0){ d.addImage(pieCanvas(parts),"PNG",18,y+4,44,44); }
  let ly=y+8; const lx=67;
  d.setFont("DV","bold"); d.setFontSize(9); d.setTextColor(...PDF_BLUE); d.text(title,lx,ly); ly+=5.5;
  d.setFontSize(8.2);
  parts.forEach((p,i)=>{ const col=PIE_KOL[i%PIE_KOL.length]; d.setFillColor(parseInt(col.slice(1,3),16),parseInt(col.slice(3,5),16),parseInt(col.slice(5,7),16));
    d.rect(lx,ly-2.6,3,3,"F"); d.setFont("DV","normal"); d.setTextColor(...PDF_TXT);
    d.text(d.splitTextToSize(p.n,40)[0],lx+5,ly); d.setFont("DV","bold"); d.text(pct(p.v,tot),lx+60,ly,{align:"right"}); ly+=5; });
  const sx=W-14-56; d.setDrawColor(201,216,234); d.line(sx-5,y+6,sx-5,y+46);
  let sy=y+12; sum.forEach(([k,v],i)=>{ const big=i===sum.length-1; d.setFont("DV","normal"); d.setFontSize(big?10.5:8.5); d.setTextColor(...PDF_MUTED); d.text(k,sx,sy);
    d.setFont("DV","bold"); d.setTextColor(...PDF_TXT); d.text(v,W-18,sy,{align:"right"}); sy+=big?9:7; });
  return y+58;
}
function pieParts(rows, n=6){
  const L=rows.filter(r=>r.sum>0).map(r=>({n:r.name,v:r.sum})).sort((a,b)=>b.v-a.v);
  if(L.length<=n+1) return L;
  return L.slice(0,n).concat([{n:"Pozostałe",v:L.slice(n).reduce((a,p)=>a+p.v,0)}]);
}

/* ---------- raporty kwot: grupowanie, zestawienia projektów, Excel, PDF ---------- */
const R={period:"month", year:new Date().getFullYear(), slice:new Date().getMonth()+1, od:"", do:"", group:"podw", sup:"", open:new Set(), proj:""};
const GRUPY={
  podw:   {t:"Podwykonawca",   k:z=>z.podw,                 n:k=>supName(k),                       sub:"rodzaj"},
  rodzaj: {t:"Rodzaj usługi",  k:z=>z.rodzaj||"",           n:k=>k||"(bez rodzaju)",               sub:"podw"},
  projekt:{t:"Projekt",        k:z=>projOf(z),              n:k=>k||"(bez projektu)",              sub:"podw"},
  mies:   {t:"Miesiąc",        k:z=>(z.data||"").slice(0,7),n:k=>miesNazwa(k)||"—",                sub:"podw"}
};
const subKey=(t,z)=> t==="podw"? z.podw : (z.rodzaj||"");
const subName=(t,k)=> t==="podw"? supName(k) : (k||"(bez rodzaju)");
const SLICES={month:MIES.map((m,i)=>[i+1,m.replace(/^./,c=>c.toUpperCase())]), quarter:[[1,"I kwartał"],[2,"II kwartał"],[3,"III kwartał"],[4,"IV kwartał"]], half:[[1,"I półrocze"],[2,"II półrocze"]]};
function rBounds(){
  const y=R.year;
  if(R.period==="custom"){ const od=R.od||(y+"-01-01"), dd=R.do||today(); return {start:od<=dd?od:dd, end:od<=dd?dd:od, label:`${fD(od)} – ${fD(dd)}`}; }
  let sm=0, em=11, label="Rok "+y;
  if(R.period==="month"){ sm=R.slice-1; em=sm; label=SLICES.month[sm][1]+" "+y; }
  else if(R.period==="quarter"){ sm=(R.slice-1)*3; em=sm+2; label=SLICES.quarter[R.slice-1][1]+" "+y; }
  else if(R.period==="half"){ sm=(R.slice-1)*6; em=sm+5; label=SLICES.half[R.slice-1][1]+" "+y; }
  return {start:`${y}-${String(sm+1).padStart(2,"0")}-01`, end:iso(new Date(y,em+1,0)), label};
}
function rData(){
  const b=rBounds(), G=GRUPY[R.group];
  const orders=Z.filter(z=>z.status!=="Anulowane" && z.data && z.data>=b.start && z.data<=b.end && (!R.sup||z.podw===R.sup));
  const sumOf=L=>r2(L.reduce((a,z)=>a+(kw(z.id)||0),0)), cnt=L=>L.filter(z=>kw(z.id)!=null).length;
  const m=new Map(); orders.forEach(z=>{ const k=G.k(z); if(!m.has(k)) m.set(k,[]); m.get(k).push(z); });
  const rows=[...m].map(([k,L])=>{
    const sm=new Map(); L.forEach(z=>{ const s=subKey(G.sub,z); if(!sm.has(s)) sm.set(s,[]); sm.get(s).push(z); });
    const subs=[...sm].map(([s,SL])=>({k:s,name:subName(G.sub,s),orders:SL,count:SL.length,valued:cnt(SL),sum:sumOf(SL),proj:[...new Set(SL.map(projOf).filter(Boolean))]}))
      .sort((a,c)=>c.sum-a.sum||c.count-a.count||a.name.localeCompare(c.name,"pl"));
    return {k,name:G.n(k),orders:L.slice().sort(byDate),count:L.length,valued:cnt(L),sum:sumOf(L),subs,proj:[...new Set(L.map(projOf).filter(Boolean))]};
  });
  rows.sort(R.group==="mies" ? (a,c)=>a.k.localeCompare(c.k) : (a,c)=>c.sum-a.sum||c.count-a.count||a.name.localeCompare(c.name,"pl"));
  return {b,G,orders,rows,total:sumOf(orders),valued:cnt(orders)};
}
function fillReportControls(){
  $("rPeriod").value=R.period; $("rYear").value=R.year;
  const sl=SLICES[R.period]; $("rSliceWrap").hidden=!sl; $("rYearWrap").hidden=R.period==="custom"; $("rCustom").hidden=R.period!=="custom";
  if(sl){ $("rSlice").innerHTML=sl.map(([v,l])=>`<option value="${v}">${l}</option>`).join(""); R.slice=Math.min(R.slice,sl.length); $("rSlice").value=String(R.slice); }
  $("rOd").value=R.od; $("rDo").value=R.do;
  document.querySelectorAll("#rGroup button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.g===R.group?"true":"false"));
  const cur=R.sup; $("rSup").innerHTML=`<option value="">Wszyscy podwykonawcy</option>`+sortedP().map(p=>`<option value="${p.id}">${esc(p.nazwa)}</option>`).join(""); $("rSup").value=cur;
}
function renderRaporty(){
  if(!canSeeAmounts()) return;
  fillReportControls();
  const D=rData(), G=D.G;
  $("rRange").textContent=`Okres: ${D.b.label} (${fD(D.b.start)} – ${fD(D.b.end)}) · według daty odbioru, bez anulowanych`;
  $("rTotal").textContent=zl2(D.total)+" zł";
  $("rCount").textContent=`${D.valued} z ${D.orders.length}`;
  $("rCountHint").textContent=D.orders.length-D.valued ? `${D.orders.length-D.valued} ${plural(D.orders.length-D.valued,"czeka","czekają","czeka")} na kwotę` : "wszystkie wycenione";
  $("rAverage").textContent=D.valued? zl2(D.total/D.valued)+" zł" : "—";
  const top=D.rows.filter(r=>r.sum>0).sort((a,c)=>c.sum-a.sum)[0];
  $("rTopLbl").textContent="Największy · "+G.t.toLowerCase(); $("rTop").textContent=top? top.name : "—"; $("rTopHint").textContent=top? pct(top.sum,D.total)+" wartości" : "brak kwot";
  $("rHead").innerHTML=`<tr><th>${G.t}</th><th class="num">Zlecenia</th><th class="num">Z kwotą</th><th class="num">Wartość</th><th class="num">Udział</th><th></th></tr>`;
  $("rTitle").textContent="Według: "+G.t.toLowerCase();
  const max=Math.max(...D.rows.map(r=>r.sum),0);
  $("rRows").innerHTML = D.rows.length ? D.rows.map(r=>{
    const open=R.open.has(r.k);
    const subTxt=r.subs.map(s=>`${esc(s.name)} ${s.count}`).join(" · ");
    const projBtn=R.group==="projekt" && r.k && r.count>=2 ? `<button class="btn sm" type="button" data-rproj="${esc(r.k)}">Zestawienie</button>` : "";
    let h=`<tr class="click ${open?"open":""}" data-rk="${esc(r.k)}"><td><b>${esc(r.name)}</b><br><span class="small">${subTxt}</span></td><td class="num">${r.count}</td><td class="num">${r.valued}</td><td class="num">${zl2(r.sum)} zł</td><td class="num">${pct(r.sum,D.total)}</td>
      <td class="barcell"><div class="rbar"><span style="width:${max?Math.max(r.sum/max*100,r.sum?2:0):0}%"></span></div>${projBtn}</td></tr>`;
    if(open) h+=`<tr class="rsub"><td colspan="6"><table><thead><tr><th>Data odbioru</th><th>Podwykonawca</th><th>Nr / projekt</th><th>Element / opis</th><th>Rodzaj</th><th>Status</th><th class="num">Wartość</th></tr></thead><tbody>${
      r.orders.map(z=>`<tr class="click" data-z="${z.id}"><td class="mono">${fD(z.data)}</td><td><span class="sw" style="background:${supColor(z.podw)}"></span>${esc(supName(z.podw))}</td><td class="mono">${esc(projOf(z))}</td><td>${esc(z.opis)}</td><td>${esc(z.rodzaj)}</td><td>${pill(z.status)}</td><td class="num">${kw(z.id)==null?'<span class="small">brak kwoty</span>':zl2(kw(z.id))+" zł"}</td></tr>`).join("")}</tbody></table></td></tr>`;
    return h; }).join("") + `<tr class="tot"><td>Razem</td><td class="num">${D.orders.length}</td><td class="num">${D.valued}</td><td class="num">${zl2(D.total)} zł</td><td class="num">${D.total?"100%":"—"}</td><td></td></tr>`
    : `<tr><td colspan="6" class="small">Brak zleceń w wybranym okresie.</td></tr>`;
  renderMat(D);
  renderProjekt();
}
// inne koszty (materiał) z weryfikacji, w okresie raportu, według projektu
function matData(b){
  const L=Object.values(KO).filter(k=>k.data && k.data>=b.start && k.data<=b.end);
  const m=new Map(); L.forEach(k=>{ const key=kodProjektu(k.projekt)||"(bez projektu)"; const g=m.get(key)||{projekt:key,n:0,sum:0,rodzaje:new Set(),L:[]}; g.n++; g.sum=r2(g.sum+(k.netto||0)); g.rodzaje.add(k.rodzaj||""); g.L.push(k); m.set(key,g); });
  const rows=[...m.values()].sort((a,c)=>c.sum-a.sum); return {rows,sum:r2(rows.reduce((a,g)=>a+g.sum,0)),n:L.length};
}
function renderMat(D){
  const M=matData(D.b); $("rMat").hidden=!M.n;
  $("rTotalHint").textContent= M.n? `+ inne koszty (materiał) ${zl2(M.sum)} zł = ${zl2(r2(D.total+M.sum))} zł` : "zlecenia w wybranym okresie";
  if(!M.n) return;
  $("rMatRows").innerHTML=M.rows.map(g=>`<tr><td><b>${esc(g.projekt)}</b></td><td>${esc([...g.rodzaje].filter(Boolean).join(", "))}</td><td class="num">${g.n}</td><td class="num">${zl2(g.sum)} zł</td></tr>`).join("")
    +`<tr class="tot"><td colspan="2">Razem</td><td class="num">${M.n}</td><td class="num">${zl2(M.sum)} zł</td></tr>`;
}
const matProj = k => Object.values(KO).filter(x=>normTxt(x.projekt)===normTxt(k)).sort((a,b)=>(a.data||"").localeCompare(b.data||""));
// zestawienie jednego projektu (wszystkie jego zlecenia, bez względu na okres)
function projData(k){
  const L=Z.filter(z=>projOf(z)===k && z.status!=="Anulowane").sort((a,b)=>(tsIso(a.utworzono)||a.data||"").localeCompare(tsIso(b.utworzono)||b.data||""));
  const zam=L.map(z=>tsIso(z.utworzono)||z.data).filter(Boolean).sort(), odb=L.map(z=>z.odebrano).filter(Boolean).sort();
  const sum=r2(L.reduce((a,z)=>a+(kw(z.id)||0),0));
  const mat=matProj(k), sumMat=r2(mat.reduce((a,x)=>a+(x.netto||0),0));
  return {k,L,sum,mat,sumMat,razem:r2(sum+sumMat),first:zam[0]||"",last:odb.length?odb[odb.length-1]:"",odebrane:L.filter(z=>z.status==="Odebrane").length};
}
function renderProjekt(){
  const box=$("rProj"); if(!R.proj){ box.hidden=true; return; }
  const P_=projData(R.proj); if(!P_.L.length){ R.proj=""; box.hidden=true; return; }
  box.hidden=false;
  $("rpTitle").textContent="Projekt "+P_.k;
  $("rpSum").textContent=zl2(P_.sum)+" zł"; $("rpMat").textContent=zl2(P_.sumMat)+" zł"; $("rpMatH").textContent=P_.mat.length? `${P_.mat.length} ${plural(P_.mat.length,"pozycja","pozycje","pozycji")} · razem ${zl2(P_.razem)} zł` : "brak w zapisanych przyjęciach"; $("rpCnt").textContent=P_.L.length; $("rpCntH").textContent=`${P_.odebrane} ${plural(P_.odebrane,"odebrane","odebrane","odebranych")}`;
  const dni=dniMiedzy(P_.first,P_.last); $("rpDni").textContent=dni==null?"—":dni+" "+plural(dni,"dzień","dni","dni"); $("rpDniH").textContent=P_.first?`${fDs(P_.first)} – ${P_.last?fDs(P_.last):"w toku"}`:"";
  $("rpRows").innerHTML=P_.L.map(z=>{ const zm=tsIso(z.utworzono)||""; const d=dniMiedzy(zm,z.odebrano);
    return `<tr class="click" data-z="${z.id}"><td>${esc(z.opis||z.rodzaj||"zlecenie")}<br><span class="small">${esc(z.rodzaj)}</span></td><td><span class="sw" style="background:${supColor(z.podw)}"></span>${esc(supName(z.podw))}</td><td class="mono">${fD(zm)}</td>
      <td>${z.odebrano?`<span class="mono">${fD(z.odebrano)}</span>`:`<span class="pill st-Gotowe">odbiór ${fDs(z.data)}</span>`}</td><td class="num">${d==null?"–":d}</td><td class="num">${kw(z.id)==null?'<span class="small">brak kwoty</span>':zl2(kw(z.id))+" zł"}</td></tr>`; }).join("")
    + `<tr class="tot"><td colspan="5">Razem kooperacja ${esc(P_.k)}</td><td class="num">${zl2(P_.sum)} zł</td></tr>`;
  $("rpMatBox").hidden=!P_.mat.length;
  $("rpMatRows").innerHTML=P_.mat.map(x=>`<tr><td>${esc(x.rodzaj||"")}<br><span class="small">${esc(x.uwagi||"")}</span></td><td>${esc(x.dost||"")}</td><td class="mono">${esc(x.pz)}</td><td class="mono">${fD(x.data)}</td><td class="num">${zl2(x.netto)} zł</td></tr>`).join("")
    + `<tr class="tot"><td colspan="4">Razem materiał · kooperacja + materiał = ${zl2(P_.razem)} zł</td><td class="num">${zl2(P_.sumMat)} zł</td></tr>`;
}
async function rXlsx(){
  try{
    await loadXlsx(); const D=rData(), G=D.G, X=window.XLSX;
    const subLbl=G.sub==="podw"?"Podwykonawca":"Rodzaj usługi";
    const aoa=[["Raport wartości zamówień – Kooperacje"],["Okres",`${D.b.label} (${fD(D.b.start)} – ${fD(D.b.end)})`],["Grupowanie",G.t],["Podwykonawca",R.sup?supName(R.sup):"wszyscy"],["Sporządził",me.nazwa||me.login],["Data",fD(today())],[],
      [G.t,subLbl,"Projekty","Zlecenia","Z kwotą","Wartość [zł]","Udział"]];
    const r0=aoa.length;
    D.rows.forEach(r=>r.subs.forEach((s,i)=>aoa.push([i?"":r.name,s.name,s.proj.join(", "),s.count,s.valued,s.sum,D.total?s.sum/D.total:0])));
    aoa.push(["Razem","","",D.orders.length,D.valued,D.total,D.total?1:0]);
    const ws=X.utils.aoa_to_sheet(aoa); ws["!cols"]=[{wch:24},{wch:20},{wch:34},{wch:9},{wch:9},{wch:15},{wch:9}];
    for(let r=r0;r<aoa.length;r++){ const a=ws[X.utils.encode_cell({r,c:5})], b=ws[X.utils.encode_cell({r,c:6})]; if(a&&a.t==="n") a.z='#,##0.00 "zł"'; if(b&&b.t==="n") b.z="0.0%"; }
    const lista=[["Data odbioru","Podwykonawca","Nr / projekt","Element / opis","Rodzaj","Ilość","Status","Zamówiono","Odebrano","Wartość [zł]","Uwagi"]];
    D.orders.slice().sort(byDate).forEach(z=>lista.push([fD(z.data),supName(z.podw),projOf(z),z.opis||"",z.rodzaj||"",z.ilosc??"",z.status,fD(tsIso(z.utworzono)),fD(z.odebrano),kw(z.id)??"",z.uwagi||""]));
    const ws2=X.utils.aoa_to_sheet(lista); ws2["!cols"]=[{wch:12},{wch:16},{wch:16},{wch:30},{wch:16},{wch:7},{wch:16},{wch:12},{wch:12},{wch:13},{wch:30}];
    for(let r=1;r<lista.length;r++){ const c=ws2[X.utils.encode_cell({r,c:9})]; if(c&&c.t==="n") c.z='#,##0.00 "zł"'; }
    const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,"Raport"); X.utils.book_append_sheet(wb,ws2,"Zlecenia");
    const M=matData(D.b);
    if(M.n){ const am=[["Projekt","Rodzaj","PZ","Data","Dostawca","Uwagi","Netto [zł]"]]; M.rows.forEach(g=>g.L.forEach(k=>am.push([g.projekt,k.rodzaj||"",k.pz,fD(k.data),k.dost||"",k.uwagi||"",k.netto??""]))); am.push(["Razem","","","","","",M.sum]);
      const wm=X.utils.aoa_to_sheet(am); wm["!cols"]=[{wch:16},{wch:14},{wch:20},{wch:11},{wch:24},{wch:30},{wch:13}];
      for(let r=1;r<am.length;r++){ const c=wm[X.utils.encode_cell({r,c:6})]; if(c&&c.t==="n") c.z='#,##0.00 "zł"'; } X.utils.book_append_sheet(wb,wm,"Inne koszty"); }
    saveBlob(`raport-kooperacje-${safeName(D.b.label)}.xlsx`, new Blob([X.write(wb,{bookType:"xlsx",type:"array"})],{type:"application/octet-stream"}));
    toast("Pobrano raport w Excelu");
  }catch(x){ failed(x); }
}
async function rPdf(){
  try{
    const D=rData(), G=D.G, d=await newPdf("portrait"), logo=$("rLogo").checked? await logoData():null;
    const subLbl=G.sub==="podw"?"Podwykonawca":"Rodzaj usługi", zProj=R.group!=="projekt";
    let y=pdfHeader(d,{title:"Raport wartości zamówień",okres:`Okres: ${D.b.label} · ${fD(D.b.start)} – ${fD(D.b.end)}`,
      sub:`Kooperacje · według: ${G.t.toLowerCase()} · ${R.sup?supName(R.sup):"wszyscy podwykonawcy"}`,meta:["Sporządził: "+(me.nazwa||me.login),"Data: "+fD(today())],logo});
    const head=[[subLbl,...(zProj?["Projekty"]:[]),"Zlecenia","Z kwotą","Wartość [zł]","Udział"]], body=[], ncol=head[0].length;
    D.rows.forEach(r=>{ body.push([{content:r.name+"   ·   "+zl2(r.sum)+" zł ("+pct(r.sum,D.total)+")",colSpan:ncol,styles:{fontStyle:"bold",textColor:PDF_BLUE,fillColor:[255,255,255],fontSize:8.8}}]);
      r.subs.forEach(s=>body.push([s.name,...(zProj?[s.proj.join(", ")]:[]),s.count,s.valued,zl2(s.sum),pct(s.sum,D.total)])); });
    const cs=zProj?{0:{cellWidth:38},1:{cellWidth:62},2:{halign:"right"},3:{halign:"right"},4:{halign:"right"},5:{halign:"right"}}:{0:{cellWidth:70},1:{halign:"right"},2:{halign:"right"},3:{halign:"right"},4:{halign:"right"}};
    d.autoTable({head,body,foot:[[{content:"Razem",styles:{halign:"left"}},...(zProj?[""]:[]),D.orders.length,D.valued,zl2(D.total),D.total?"100%":"—"]],startY:y,styles:tStyle,headStyles:hStyle,footStyles:{...fStyle,halign:"right"},
      columnStyles:cs,alternateRowStyles:{fillColor:[243,247,252]},margin:{left:14,right:14,bottom:16},showFoot:"lastPage"});
    y=d.lastAutoTable.finalY+6;
    y=pdfPie(d,y,pieParts(D.rows),"Udział w wartości",[["Zlecenia z kwotą",`${D.valued} z ${D.orders.length}`],["Średnio na zlecenie",D.valued?zl2(D.total/D.valued)+" zł":"—"],["Razem",zl2(D.total)+" zł"]]);
    const M=matData(D.b);
    if(M.n){ d.setFont("DV","bold"); d.setFontSize(10); d.setTextColor(...PDF_BLUE); d.text("Inne koszty (materiał) według projektu",14,y+2);
      d.autoTable({head:[["Projekt","Rodzaje","Pozycji","Netto [zł]"]],body:M.rows.map(g=>[g.projekt,[...g.rodzaje].filter(Boolean).join(", "),g.n,zl2(g.sum)]),
        foot:[[{content:"Razem materiał · kooperacja + materiał = "+zl2(r2(D.total+M.sum))+" zł",colSpan:2,styles:{halign:"left"}},M.n,zl2(M.sum)]],startY:y+5,styles:tStyle,headStyles:hStyle,footStyles:{...fStyle,halign:"right"},
        columnStyles:{2:{halign:"right"},3:{halign:"right"}},alternateRowStyles:{fillColor:[243,247,252]},margin:{left:14,right:14,bottom:16},showFoot:"lastPage"}); }
    pdfFooter(d,"Kooperacje · wydruk "+nowStamp());
    saveBlob(`raport-kooperacje-${safeName(D.b.label)}.pdf`, d.output("blob"));
  }catch(x){ failed(x); }
}
async function projXlsx(){
  try{
    await loadXlsx(); const P_=projData(R.proj), X=window.XLSX;
    const aoa=[["Zestawienie projektu "+P_.k],["Zlecenia",P_.L.length],["Wartość",P_.sum],["Data",fD(today())],[],["Element / opis","Rodzaj","Podwykonawca","Zamówiono","Termin odbioru","Odebrano","Dni","Wartość [zł]"]];
    const r0=aoa.length;
    P_.L.forEach(z=>{ const zm=tsIso(z.utworzono); aoa.push([z.opis||"",z.rodzaj||"",supName(z.podw),fD(zm),fD(z.data),fD(z.odebrano),dniMiedzy(zm,z.odebrano)??"",kw(z.id)??""]); });
    aoa.push(["Razem kooperacja","","","","","","",P_.sum]);
    if(P_.mat.length){ aoa.push([],["Inne koszty (materiał)","Dostawca","PZ","Data","","","","Netto [zł]"]); P_.mat.forEach(x=>aoa.push([(x.rodzaj||"")+" – "+(x.uwagi||""),x.dost||"",x.pz,fD(x.data),"","","",x.netto??""]));
      aoa.push(["Razem materiał","","","","","","",P_.sumMat],["Razem projekt","","","","","","",P_.razem]); }
    const ws=X.utils.aoa_to_sheet(aoa); ws["!cols"]=[{wch:30},{wch:16},{wch:16},{wch:12},{wch:14},{wch:12},{wch:6},{wch:14}];
    for(let r=r0;r<aoa.length;r++){ const c=ws[X.utils.encode_cell({r,c:7})]; if(c&&c.t==="n") c.z='#,##0.00 "zł"'; }
    const c2=ws["B3"]; if(c2) c2.z='#,##0.00 "zł"';
    const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,"Projekt");
    saveBlob(`projekt-${safeName(P_.k)}.xlsx`, new Blob([X.write(wb,{bookType:"xlsx",type:"array"})],{type:"application/octet-stream"}));
  }catch(x){ failed(x); }
}
async function projPdf(){
  try{
    const P_=projData(R.proj), d=await newPdf("portrait"), logo=$("rLogo").checked? await logoData():null;
    let y=pdfHeader(d,{title:"Zestawienie projektu "+P_.k,okres:`Okres: ${fD(P_.first)} – ${P_.last?fD(P_.last):"w toku"}`,
      sub:`Kooperacje · ${P_.L.length} ${plural(P_.L.length,"zlecenie","zlecenia","zleceń")} · ${[...new Set(P_.L.map(z=>supName(z.podw)))].join(", ")}`,meta:["Sporządził: "+(me.nazwa||me.login),"Data: "+fD(today())],logo});
    const body=P_.L.map(z=>{ const zm=tsIso(z.utworzono); const dd=dniMiedzy(zm,z.odebrano); return [z.opis||z.rodzaj||"zlecenie",z.rodzaj||"",supName(z.podw),fD(zm),z.odebrano?fD(z.odebrano):"odbiór "+fD(z.data),dd==null?"–":dd,kw(z.id)==null?"brak":zl2(kw(z.id))]; });
    d.autoTable({head:[["Element / opis","Rodzaj","Podwykonawca","Zamówiono","Odebrano","Dni","Wartość [zł]"]],body,foot:[[{content:"Razem",styles:{halign:"left"}},"","","","","",zl2(P_.sum)]],startY:y,styles:tStyle,headStyles:hStyle,footStyles:{...fStyle,halign:"right"},
      columnStyles:{0:{cellWidth:50},5:{halign:"right"},6:{halign:"right"}},alternateRowStyles:{fillColor:[243,247,252]},margin:{left:14,right:14,bottom:16},showFoot:"lastPage"});
    y=d.lastAutoTable.finalY+6;
    const bySup=new Map(); P_.L.forEach(z=>{ if(kw(z.id)) bySup.set(supName(z.podw),(bySup.get(supName(z.podw))||0)+kw(z.id)); });
    if(P_.mat.length){ d.setFont("DV","bold"); d.setFontSize(10); d.setTextColor(...PDF_BLUE); d.text("Inne koszty (materiał)",14,y+2);
      d.autoTable({head:[["Materiał","Dostawca","PZ","Data","Netto [zł]"]],body:P_.mat.map(x=>[(x.rodzaj||"")+(x.uwagi?" – "+x.uwagi:""),x.dost||"",x.pz,fD(x.data),zl2(x.netto)]),
        foot:[[{content:"Razem materiał",colSpan:4,styles:{halign:"left"}},zl2(P_.sumMat)]],startY:y+5,styles:tStyle,headStyles:hStyle,footStyles:{...fStyle,halign:"right"},
        columnStyles:{0:{cellWidth:62},4:{halign:"right"}},alternateRowStyles:{fillColor:[243,247,252]},margin:{left:14,right:14,bottom:16},showFoot:"lastPage"});
      y=d.lastAutoTable.finalY+6; }
    if(P_.mat.length) bySup.set("Materiał",P_.sumMat);
    pdfPie(d,y,pieParts([...bySup].map(([name,sum])=>({name,sum}))),"Udział w kosztach",[["Kooperacja",zl2(P_.sum)+" zł"],["Materiał",zl2(P_.sumMat)+" zł"],["Razem projekt",zl2(P_.razem)+" zł"]]);
    pdfFooter(d,"Kooperacje · wydruk "+nowStamp());
    saveBlob(`projekt-${safeName(P_.k)}.pdf`, d.output("blob"));
  }catch(x){ failed(x); }
}
$("rPeriod").addEventListener("change",e=>{ R.period=e.target.value; R.slice=R.period==="month"?new Date().getMonth()+1:R.period==="quarter"?Math.floor(new Date().getMonth()/3)+1:R.period==="half"?(new Date().getMonth()<6?1:2):1; R.open.clear(); renderRaporty(); });
$("rYear").addEventListener("change",e=>{ R.year=Number(e.target.value)||new Date().getFullYear(); R.open.clear(); renderRaporty(); });
$("rSlice").addEventListener("change",e=>{ R.slice=Number(e.target.value)||1; R.open.clear(); renderRaporty(); });
$("rOd").addEventListener("change",e=>{ R.od=e.target.value; renderRaporty(); });
$("rDo").addEventListener("change",e=>{ R.do=e.target.value; renderRaporty(); });
$("rSup").addEventListener("change",e=>{ R.sup=e.target.value; R.open.clear(); renderRaporty(); });
$("rGroup").addEventListener("click",e=>{ const b=e.target.closest("button[data-g]"); if(!b) return; R.group=b.dataset.g; R.open.clear(); renderRaporty(); });
$("rRows").addEventListener("click",e=>{
  const pb=e.target.closest("[data-rproj]"); if(pb){ e.stopPropagation(); R.proj=pb.dataset.rproj; renderProjekt(); $("rProj").scrollIntoView({behavior:"smooth",block:"start"}); return; }
  if(e.target.closest("[data-z]")) return;
  const tr=e.target.closest("tr[data-rk]"); if(!tr) return; const k=tr.dataset.rk; R.open.has(k)?R.open.delete(k):R.open.add(k); renderRaporty();
});
$("btnRXlsx").onclick=rXlsx; $("btnRPdf").onclick=rPdf;
$("btnPXlsx").onclick=projXlsx; $("btnPPdf").onclick=projPdf; $("btnPClose").onclick=()=>{ R.proj=""; renderProjekt(); };

/* ---------- projekt przy zapisie: ta sama nazwa po ponad miesiącu → pytanie ---------- */
function askProject(nr, data, groups){
  return new Promise(res=>{
    const dlg=$("dlgP"), nowy=`${nr} · ${data.slice(5,7)}.${data.slice(0,4)}`;
    let key=nowy, i=2; while(Z.some(z=>projOf(z)===key)) key=`${nowy} (${i++})`;
    $("pqT").textContent=`Projekt „${nr}” już był`;
    const g=groups[0];
    $("pqTxt").innerHTML=`Ostatnie zlecenie dla ${esc(nr)} było <b>${fD(g.last)}</b>, czyli ponad miesiąc temu (${g.n} ${plural(g.n,"zlecenie","zlecenia","zleceń")}${canSeeAmounts()&&g.sum?", "+zl2(g.sum)+" zł":""}). Do którego projektu dodać to zlecenie?`;
    $("pqCh").innerHTML=`<label class="on"><input type="radio" name="pq" value="${esc(key)}" checked><b>Nowy projekt ${esc(key)}</b><span class="small">osobne zestawienie</span></label>`+
      groups.map(x=>`<label><input type="radio" name="pq" value="${esc(x.k)}"><b>Dopisz do ${esc(x.k)}</b><span class="small">${x.n} ${plural(x.n,"zlecenie","zlecenia","zleceń")}, ostatnie ${fD(x.last)}</span></label>`).join("");
    $("pqCh").onchange=()=>$("pqCh").querySelectorAll("label").forEach(l=>l.classList.toggle("on",l.querySelector("input").checked));
    const done=v=>{ dlg.removeEventListener("close",onClose); res(v); };
    const onClose=()=>done(dlg.returnValue==="ok"? ($("pqCh").querySelector("input:checked")?.value ?? null) : null);
    dlg.returnValue=""; dlg.addEventListener("close",onClose); dlg.showModal();
  });
}
// zwraca klucz projektu do zapisania w polu `projekt` ("" = taki sam jak nr), albo null gdy anulowano
async function resolveProject(d){
  const cur=zId? Z.find(x=>x.id===zId) : null, nr=(d.nr||"").trim();
  if(!nr) return "";
  if(cur && normTxt(cur.nr)===normTxt(nr)) return cur.projekt||"";
  const others=Z.filter(z=>z.id!==zId && z.status!=="Anulowane" && normTxt(z.nr)===normTxt(nr));
  if(!others.length) return "";
  const gm=new Map();
  others.forEach(z=>{ const k=projOf(z), last=[z.data,tsIso(z.utworzono),z.odebrano].filter(Boolean).sort().pop()||""; const g=gm.get(k)||{k,n:0,last:"",sum:0}; g.n++; if(last>g.last) g.last=last; g.sum+=kw(z.id)||0; gm.set(k,g); });
  const G=[...gm.values()].sort((a,b)=>b.last.localeCompare(a.last));
  const kiedy=d.data||today();
  const key = (!G[0].last || G[0].last>=addD(kiedy,-30)) ? G[0].k : await askProject(nr,kiedy,G);
  if(key==null) return null;
  return normTxt(key)===normTxt(nr) ? "" : key;
}

/* ---------- weryfikacja kosztów z pliku przyjęć na magazyn ---------- */
const VER={plik:"",rows:[],months:[],ym:"",manual:{},res:null};
let WER={};   // koop_ustawienia/weryfikacje: m_RRRR-MM → {czas, kto, plik}
const KOL={numer:["NUMER"],data:["DATA PRZYJECIA","DATA"],dost:["DOSTAWCA ODBIORCA SYMBOL","DOSTAWCA","KONTRAHENT"],netto:["WARTOSC NETTO","NETTO"],uwagi:["UWAGI"]};
async function readVerFile(file){
  try{
    await loadXlsx(); const X=window.XLSX;
    const wb=X.read(await file.arrayBuffer(),{cellDates:true}); const ws=wb.Sheets[wb.SheetNames[0]];
    const aoa=X.utils.sheet_to_json(ws,{header:1,raw:true,defval:""});
    const hi=aoa.slice(0,15).findIndex(r=>r.some(c=>normTxt(c)==="UWAGI"));
    if(hi<0) throw new Error("Nie znalazłem w pliku nagłówka z kolumną „Uwagi”. Wgraj eksport przyjęć z magazynu.");
    const H=aoa[hi].map(normTxt), col={};
    for(const [k,names] of Object.entries(KOL)) col[k]=names.map(n=>H.findIndex(h=>h===n)).find(i=>i>=0) ?? names.map(n=>H.findIndex(h=>h.startsWith(n))).find(i=>i>=0) ?? -1;
    const brak=Object.entries(col).filter(([,i])=>i<0).map(([k])=>({numer:"Numer",data:"Data przyjęcia",dost:"Dostawca",netto:"Wartość netto",uwagi:"Uwagi"}[k]));
    if(brak.length) throw new Error("W pliku brakuje kolumn: "+brak.join(", ")+".");
    VER.rows=aoa.slice(hi+1).map((r,i)=>({i,pz:String(r[col.numer]||"").trim(),data:cellDate(r[col.data]),dost:String(r[col.dost]||"").trim(),netto:cellNum(r[col.netto]),uwagi:String(r[col.uwagi]||"").trim()})).filter(r=>r.pz&&r.data);
    if(!VER.rows.length) throw new Error("W pliku nie ma żadnych przyjęć.");
    VER.plik=file.name; VER.manual={};
    VER.months=[...new Set(VER.rows.map(r=>r.data.slice(0,7)))].sort().reverse();
    const cel=verMonth(); VER.ym=VER.months.includes(cel)? cel : VER.months[0];
    renderVer(true);
  }catch(x){ toast(x.message||String(x)); }
}
const matchSup = dost => matchSupL(dost, P);
const znaneKody = () => [...new Set([...PROJ.map(p=>p.kod), ...Z.map(z=>z.nr), ...Z.map(z=>z.projekt)].filter(Boolean))];
function computeVer(){
  const ym=VER.ym, rowsM=VER.rows.filter(r=>r.data.slice(0,7)===ym);
  const D=dopasujPZ(rowsM, Z, P, VER.manual, znaneKody());
  const wyn=[...D.przyp].map(([zid,pz])=>{ const z=Z.find(x=>x.id===zid); const plik=pz.some(r=>r.netto!=null)? r2(pz.reduce((a,r)=>a+(r.netto||0),0)) : null, app=kw(zid);
    const st= plik==null? "nokw" : app==null? "brak" : Math.abs(app-plik)<0.005? "ok" : "roznica"; return {z,pz,plik,app,st}; });
  const ids=new Set(D.przyp.keys());
  const bezpz=Z.filter(z=>z.status==="Odebrane" && (z.odebrano||"").slice(0,7)===ym && !ids.has(z.id)).map(z=>({z,pz:[],plik:null,app:kw(z.id),st:"bezpz"}));
  const order={roznica:0,brak:1,bezpz:2,nokw:3,ok:4};
  const all=wyn.concat(bezpz).sort((a,b)=>order[a.st]-order[b.st]||byDate(a.z,b.z));
  const inne=D.inne.map(x=>{ const id=idKosztu(x.r.pz), zap=KO[id]; return {...x, id, zap, st: !zap? "nowe" : Math.abs((zap.netto||0)-(x.r.netto||0))<0.005 && normTxt(zap.projekt)===normTxt(x.projekt)? "zapisane" : "zmiana"}; });
  return {ym,rowsM,all,niedop:D.niedop,inne,pominiete:D.pominiete.length,przypisane:rowsM.length-D.niedop.length-D.inne.length-D.pominiete.length,
    cnt:k=>all.filter(x=>x.st===k).length,sumApp:r2(all.reduce((a,x)=>a+(x.app||0),0)),sumPlik:r2(all.reduce((a,x)=>a+(x.plik||0),0)),sumInne:r2(inne.reduce((a,x)=>a+(x.r.netto||0),0))};
}
const VST={ok:["p-ok","zgodne"],roznica:["p-warn","różnica"],brak:["p-bad","brak kwoty"],bezpz:["p-bad","bez przyjęcia PZ"],nokw:["p-idle","brak kwoty w pliku"]};
function renderVer(zapisz){
  const has=VER.rows.length>0; $("vRes").hidden=!has;
  $("vMonthWrap").hidden=!has; $("vEmpty").hidden=has;
  const last=Object.entries(WER).filter(([k])=>k.startsWith("m_")).sort().pop();
  $("vLast").textContent= last? `Ostatnia weryfikacja: ${miesNazwa(last[0].slice(2))} (${esc(last[1].kto||"")}, ${fTs(last[1].czas)||"przed chwilą"})` : "Jeszcze nie było weryfikacji.";
  if(!has) return;
  $("vMonth").innerHTML=VER.months.map(m=>`<option value="${m}">${miesNazwa(m)}</option>`).join(""); $("vMonth").value=VER.ym;
  const V_=VER.res=computeVer();
  $("vFile").innerHTML=`<b>${esc(VER.plik)}</b><span>${V_.rowsM.length} ${plural(V_.rowsM.length,"przyjęcie","przyjęcia","przyjęć")} w miesiącu ${esc(miesNazwa(V_.ym))} · ${V_.przypisane} dopasowanych do zleceń · ${V_.niedop.length} od podwykonawców do przypisania · ${V_.inne.length} innych kosztów (materiał) · ${V_.pominiete} pominiętych</span>`;
  $("vOk").textContent=V_.cnt("ok"); $("vDiff").textContent=V_.cnt("roznica"); $("vBrak").textContent=V_.cnt("brak"); $("vBezpz").textContent=V_.cnt("bezpz");
  $("vTitle").textContent="Weryfikacja kosztów · "+miesNazwa(V_.ym);
  $("vRows").innerHTML=V_.all.map(x=>{ const z=x.z, [cl,lb]=VST[x.st];
    const roz= x.st==="roznica"? ` ${x.plik-x.app>0?"+":""}${zl2(x.plik-x.app)} zł` : "";
    const akcja= x.st==="brak"? `<button class="btn sm primary" type="button" data-vset="${z.id}">Wpisz z pliku</button>` : x.st==="roznica"? `<button class="btn sm" type="button" data-vset="${z.id}">Przyjmij z pliku</button>` : x.st==="bezpz"? `<button class="btn sm" type="button" data-z="${z.id}">Otwórz zlecenie</button>` : "";
    return `<tr><td><b class="mono">${esc(projOf(z)||"—")}</b><br><span class="small"><span class="sw" style="background:${supColor(z.podw)}"></span>${esc(supName(z.podw))} · ${esc(z.opis||z.rodzaj||"")}</span></td><td class="mono">${fDs(z.odebrano||z.data)}</td>
      <td class="mono">${x.pz.map(r=>`${esc(r.pz)}<br><span class="small">${fD(r.data)}</span>`).join("<br>")||'<span class="small">brak w pliku</span>'}</td><td>${x.pz.map(r=>esc(r.uwagi)).join("<br>")}</td>
      <td class="num">${x.app==null?'<span class="small">—</span>':zl2(x.app)+" zł"}</td><td class="num">${x.plik==null?'<span class="small">—</span>':zl2(x.plik)+" zł"}</td><td><span class="pill ${cl}">${lb}${roz}</span></td><td>${akcja}</td></tr>`; }).join("")
    + V_.niedop.map(({r,sup})=>{ const opcje=Z.filter(z=>z.podw===sup && z.status!=="Anulowane" && Math.abs(dniMiedzy(r.data,z.odebrano||z.data)??999)<=60).sort(byDate);
      return `<tr><td><span class="small"><span class="sw" style="background:${supColor(sup)}"></span>${esc(supName(sup))}</span><br><select data-vman="${r.i}" aria-label="Przypisz do zlecenia"><option value="">— przypisz do zlecenia —</option>${opcje.map(z=>`<option value="${z.id}">${esc(projOf(z)||"")} · ${esc(z.opis||z.rodzaj||"")} · ${fDs(z.data)}</option>`).join("")}</select></td>
        <td></td><td class="mono">${esc(r.pz)}<br><span class="small">${fD(r.data)}</span></td><td>${esc(r.uwagi)||'<span class="small">(puste uwagi)</span>'}</td><td></td><td class="num">${r.netto==null?"—":zl2(r.netto)+" zł"}</td><td><span class="pill p-warn">nie dopasowano</span></td><td></td></tr>`; }).join("")
    + `<tr class="tot"><td colspan="4">Razem ${esc(miesNazwa(V_.ym))}</td><td class="num">${zl2(V_.sumApp)} zł</td><td class="num">${zl2(V_.sumPlik)} zł</td><td colspan="2">${V_.cnt("brak")?`<button class="btn sm primary" type="button" id="vAll">Wpisz wszystkie brakujące (${V_.cnt("brak")})</button>`:""}</td></tr>`;
  if(!V_.all.length && !V_.niedop.length) $("vRows").innerHTML=`<tr><td colspan="8" class="small">W tym miesiącu nie ma przyjęć od podwykonawców ani odebranych zleceń.</td></tr>`;
  renderInne(V_);
  if(zapisz) setDoc(doc(db,C.u,"weryfikacje"),{["m_"+V_.ym]:{czas:serverTimestamp(),kto:me.nazwa||me.login,plik:VER.plik}},{merge:true}).catch(x=>console.warn(x));
}
// inne koszty (materiał): przyjęcia od zwykłych dostawców z kodem projektu w uwagach, np. „Blacha JANR1220-26B”
const IST={nowe:["p-warn","nowe"],zapisane:["p-ok","zapisane"],zmiana:["p-warn","inna kwota / projekt"]};
function renderInne(V_){
  const box=$("vInneBox"); box.hidden=!V_.inne.length; if(!V_.inne.length) return;
  const nowe=V_.inne.filter(x=>x.st!=="zapisane");
  $("vInneInfo").textContent=`${V_.inne.length} ${plural(V_.inne.length,"pozycja","pozycje","pozycji")} · ${zl2(V_.sumInne)} zł netto · ${nowe.length? nowe.length+" do zapisania" : "wszystkie zapisane"}`;
  $("vInneRows").innerHTML=V_.inne.map(x=>{ const [cl,lb]=IST[x.st];
    return `<tr><td><b class="mono">${esc(x.projekt)}</b><br><span class="small">${esc(x.rodzaj)}</span></td><td class="mono">${esc(x.r.pz)}<br><span class="small">${fD(x.r.data)}</span></td><td>${esc(x.r.dost)}</td><td>${esc(x.r.uwagi)}</td>
      <td class="num">${x.r.netto==null?"—":zl2(x.r.netto)+" zł"}</td><td><span class="pill ${cl}">${lb}</span></td><td>${x.st!=="zapisane"?`<button class="btn sm" type="button" data-iset="${esc(x.id)}">Zapisz</button>`:`<button class="btn sm ghost" type="button" data-idel="${esc(x.id)}">Usuń</button>`}</td></tr>`; }).join("")
    + `<tr class="tot"><td colspan="4">Razem inne koszty · ${esc(miesNazwa(V_.ym))}</td><td class="num">${zl2(V_.sumInne)} zł</td><td colspan="2">${nowe.length?`<button class="btn sm primary" type="button" id="vInneAll">Zapisz wszystkie (${nowe.length})</button>`:""}</td></tr>`;
}
async function inneSet(ids){
  const L=VER.res.inne.filter(x=>ids.includes(x.id));
  try{
    const b=writeBatch(db);
    L.forEach(x=>b.set(doc(db,C.k,x.id),{pz:x.r.pz,data:x.r.data,ym:x.r.data.slice(0,7),dost:x.r.dost,uwagi:x.r.uwagi,netto:x.r.netto??null,projekt:x.projekt,rodzaj:x.rodzaj,
      zapisano:serverTimestamp(),zapisal:me.uid,zapisalNazwa:me.nazwa||me.login}));
    await b.commit(); toast(L.length===1?"Zapisano koszt":`Zapisano ${L.length} ${plural(L.length,"koszt","koszty","kosztów")}`);
  }catch(x){ failed(x); }
}
$("vInneRows").addEventListener("click",e=>{
  const s_=e.target.closest("[data-iset]"); if(s_){ inneSet([s_.dataset.iset]); return; }
  const d_=e.target.closest("[data-idel]"); if(d_){ deleteDoc(doc(db,C.k,d_.dataset.idel)).then(()=>toast("Usunięto koszt")).catch(failed); return; }
  if(e.target.id==="vInneAll") inneSet(VER.res.inne.filter(x=>x.st!=="zapisane").map(x=>x.id));
});
async function verSet(ids){
  const L=VER.res.all.filter(x=>ids.includes(x.z.id) && x.plik!=null);
  try{
    const b=writeBatch(db);
    L.forEach(x=>b.set(doc(db,C.v,x.z.id),{wartosc:x.plik,pz:x.pz.map(r=>r.pz),zrodlo:"weryfikacja",zmieniono:serverTimestamp(),zmienil:me.uid,zmienilNazwa:me.nazwa||me.login},{merge:true}));
    await b.commit(); toast(L.length===1?"Wpisano kwotę z pliku":`Wpisano ${L.length} kwot z pliku`);
  }catch(x){ failed(x); }
}
async function verXlsx(){
  try{
    await loadXlsx(); const X=window.XLSX, V_=VER.res; if(!V_) return;
    const aoa=[["Weryfikacja kosztów – "+miesNazwa(V_.ym)],["Plik",VER.plik],["Data",fD(today())],[],["Nr / projekt","Podwykonawca","Element / opis","Odebrano","Przyjęcia PZ","Uwagi z pliku","W aplikacji [zł]","W pliku netto [zł]","Wynik"]];
    const r0=aoa.length;
    V_.all.forEach(x=>aoa.push([projOf(x.z),supName(x.z.podw),x.z.opis||"",fD(x.z.odebrano),x.pz.map(r=>r.pz).join(", "),x.pz.map(r=>r.uwagi).join("; "),x.app??"",x.plik??"",VST[x.st][1]]));
    V_.niedop.forEach(({r,sup})=>aoa.push(["",supName(sup),"","",r.pz,r.uwagi,"",r.netto??"","nie dopasowano"]));
    aoa.push(["Razem","","","","","",V_.sumApp,V_.sumPlik,""]);
    const ws=X.utils.aoa_to_sheet(aoa); ws["!cols"]=[{wch:16},{wch:16},{wch:26},{wch:11},{wch:22},{wch:30},{wch:14},{wch:14},{wch:18}];
    for(let r=r0;r<aoa.length;r++) [6,7].forEach(c=>{ const cell=ws[X.utils.encode_cell({r,c})]; if(cell&&cell.t==="n") cell.z='#,##0.00 "zł"'; });
    const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,"Weryfikacja");
    if(V_.inne.length){ const ai=[["Projekt","Rodzaj","PZ","Data","Dostawca","Uwagi","Netto [zł]","Stan"]]; V_.inne.forEach(x=>ai.push([x.projekt,x.rodzaj,x.r.pz,fD(x.r.data),x.r.dost,x.r.uwagi,x.r.netto??"",IST[x.st][1]]));
      ai.push(["Razem","","","","","",V_.sumInne,""]); const wi=X.utils.aoa_to_sheet(ai); wi["!cols"]=[{wch:16},{wch:14},{wch:20},{wch:11},{wch:24},{wch:30},{wch:13},{wch:16}];
      for(let r=1;r<ai.length;r++){ const c=wi[X.utils.encode_cell({r,c:6})]; if(c&&c.t==="n") c.z='#,##0.00 "zł"'; } X.utils.book_append_sheet(wb,wi,"Inne koszty"); }
    saveBlob(`weryfikacja-${V_.ym}.xlsx`, new Blob([X.write(wb,{bookType:"xlsx",type:"array"})],{type:"application/octet-stream"}));
  }catch(x){ failed(x); }
}
$("vInput").addEventListener("change",e=>{ const f=e.target.files[0]; if(f) readVerFile(f); e.target.value=""; });
$("vMonth").addEventListener("change",e=>{ VER.ym=e.target.value; renderVer(true); });
$("vXlsx").onclick=verXlsx;
$("vRows").addEventListener("click",e=>{ const b=e.target.closest("[data-vset]"); if(b){ verSet([b.dataset.vset]); return; } if(e.target.id==="vAll") verSet(VER.res.all.filter(x=>x.st==="brak").map(x=>x.z.id)); });
$("vRows").addEventListener("change",e=>{ const s=e.target.closest("[data-vman]"); if(!s) return; if(s.value) VER.manual[s.dataset.vman]=s.value; else delete VER.manual[s.dataset.vman]; renderVer(false); });

/* ---------- przypomnienia na Pulpicie (administrator i Zakupowiec) ---------- */
// miesiąc do weryfikacji: bieżący w 3 ostatnie dni robocze, potem poprzedni – aż ktoś go zweryfikuje
function verMonth(){
  const t=today(), d=pd(t); const last=new Date(d.getFullYear(),d.getMonth()+1,0); let wd=0, cut="";
  while(wd<3){ if(last.getDay()%6!==0){ wd++; cut=iso(last); } last.setDate(last.getDate()-1); }
  return t>=cut ? t.slice(0,7) : iso(new Date(d.getFullYear(),d.getMonth()-1,1)).slice(0,7);
}
const snoozed = k => { try{ return localStorage.getItem("koop_odloz_"+k)===today(); }catch{ return false; } };
const snooze = k => { try{ localStorage.setItem("koop_odloz_"+k,today()); }catch{} };
let zNoAmt=false;
const bezKwoty = () => { const lim=addD(today(),-30); return Z.filter(z=>z.status==="Odebrane" && z.odebrano && z.odebrano<=lim && kw(z.id)==null); };
function renderAlerts(){
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
function weekList(){ const end=addD(wkStart,6); return Z.filter(z=>z.status!=="Anulowane" && z.data>=wkStart && z.data<=end && (!wkSup||z.podw===wkSup) && (wkShow==="all"||!closed(z))).sort(byDate); }
// plan tygodnia jako PDF (aplikacja Android nie ma drukowania z przeglądarki; na komputerze przycisk „PDF”)
async function weekPdf(){
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
function printWeek(){
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

function renderSup(){
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
const mAdd=n=>{ const d=pd(calMonth+"-01"); d.setMonth(d.getMonth()+n); calMonth=iso(d).slice(0,7); renderCal(); };
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
function dopiszProjekt(kod){
  const k=kodProjektu(kod);
  if(!k || k.length>40 || k.includes("/") || PROJ.some(p=>p.kod===k)) return;
  PROJ.push({kod:k});
  setDoc(doc(db,"projekty",k), {kod:k, zrodla:{koop:true}, utworzono:serverTimestamp(), utworzyl:me.login||""}, {merge:true}).catch(x=>console.warn(x));
}
// kurs w Truck App – logika w logika.js
const ja = () => ({login:me.login, nazwa:me.nazwa});
const nowyKurs = (zid, d) => nowyKursL(zid, d, sup(d.podw), ja(), serverTimestamp(), Date.now(), KD);
const zmianyKursu = (k, d, zmiany) => zmianyKursuL(k, d, zmiany, sup(d.podw), ja(), serverTimestamp(), today());
async function saveZ(id, data, expectedWersja, force){
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
const kursStan = z => kursStanL(z, KR[z.kursId]);
const kursTag = z => { const s=kursStan(z); return s? `<br><span class="pill ${s.cls}" title="Kurs w Truck App">${esc(s.txt)}</span>` : ""; };
function pokazKurs(z){
  const box=$("zKurs"), s=z? kursStan(z) : null;
  if(!s){ box.hidden=true; return; }
  const k=KR[z.kursId];
  box.hidden=false;
  box.innerHTML=`<b>Truck App:</b> <span class="pill ${s.cls}">${esc(s.txt)}</span>${k?` <span class="small">status: ${esc(k.status||"")}${k.zal?" · odbiór "+fD(k.zal):""}</span>`:""}${s.dl?`<div class="small">${esc(s.dl)}</div>`:""}`;
}

let zId=null, zWersja=0;
function fillZ(v){
  $("z_data").value=v.data||""; $("z_podw").value=v.podw||""; $("z_nr").value=v.nr||""; $("z_rodzaj").value=v.rodzaj||"";
  $("z_opis").value=v.opis||""; $("z_ilosc").value=v.ilosc??""; $("z_status").value=v.status||"Zlecone"; $("z_odebrano").value=v.odebrano||""; $("z_uwagi").value=v.uwagi||"";
  $("z_wartosc").value=zId && V[zId]?.wartosc!=null ? V[zId].wartosc : "";
  $("z_dolog").checked=!!v.doLog;
}
function openZ(id, preset){
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
async function loadAudit(z){
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
function readZ(){
  return { data:$("z_data").value, podw:$("z_podw").value, nr:$("z_nr").value.trim(), rodzaj:$("z_rodzaj").value, opis:$("z_opis").value.trim(),
    ilosc: $("z_ilosc").value===""? null : Math.round(+$("z_ilosc").value), status:$("z_status").value, odebrano:$("z_odebrano").value, uwagi:$("z_uwagi").value.trim(), doLog:$("z_dolog").checked };
}
let forceNext=false;
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
function showConflict(cur){
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
async function markStatus(id, status){
  const z=Z.find(x=>x.id===id); if(!z) return;
  const d={}; for(const k of POLA) d[k]=z[k]??(k==="ilosc"?null:""); d.status=status; if(status==="Odebrane") d.odebrano=today();
  try{ const r=await saveZ(id,d,z.wersja||0,false);
    if(r.conflict){ toast("Ktoś właśnie zmienił to zlecenie – otwórz je i sprawdź"); return; }
    toast(status==="Odebrane"?"Oznaczono jako odebrane":"Oznaczono: gotowe do odbioru"); }catch(x){ failed(x); }
}
const markOdebrane = id => markStatus(id,"Odebrane");
// przyciski szybkiej zmiany statusu w wierszu
function quickBtns(z){
  if(!canWrite || closed(z)) return "";
  return `<span class="qb">${z.status!=="Gotowe do odbioru"?`<button class="btn sm" type="button" data-gotowe="${z.id}" title="Oznacz: gotowe do odbioru">Gotowe</button>`:""}<button class="btn sm" type="button" data-odb="${z.id}" title="Oznacz jako odebrane">Odebrane</button></span>`;
}

/* ---------- podwykonawcy / rodzaje (administrator) ---------- */
let sId=null;
const SF=["nazwa","dzial","tel","adres","email","osoba2","tel2","email2","symbolMag"];
/* Wspólna lista z Truck App: podwykonawca zapisany tutaj trafia też do dostawców logistyki (ustawienia/glowne.dostawcy),
   żeby biuro miało jego adres i telefon w formularzu kursu; przy dodawaniu można wybrać firmę z listy dostawców Truck App. */
let DOST=[];   // dostawcy z Truck App (do podpowiedzi)
async function wczytajDostawcow(){
  try{ const sn=await getDoc(doc(db,"ustawienia","glowne")); DOST=sn.exists() && Array.isArray(sn.data().dostawcy)? sn.data().dostawcy : []; }catch{ DOST=[]; }
  $("dostLista").innerHTML=DOST.filter(x=>x.nazwa && !P.some(p=>String(p.nazwa).toLowerCase()===String(x.nazwa).toLowerCase())).map(x=>`<option value="${esc(x.nazwa)}">${esc(x.adres||"")}</option>`).join("");
}
let dostUzupelniony="";
$("s_nazwa").addEventListener("change",()=>{
  const x=DOST.find(q=>String(q.nazwa).toLowerCase()===$("s_nazwa").value.trim().toLowerCase()); if(!x || dostUzupelniony===x.nazwa) return;
  dostUzupelniony=x.nazwa;
  const uzup=(id,v)=>{ if(v && !$(id).value.trim()) $(id).value=v; };
  uzup("s_adres",x.adres); uzup("s_tel",x.tel||(/\d{3}/.test(x.kontakt||"")?x.kontakt:"")); uzup("s_email",x.email);
  toast("Uzupełniono dane z listy dostawców Truck App");
});
async function doDostawcowTruckApp(lista){
  const ref=doc(db,"ustawienia","glowne");
  return runTransaction(db, async tx=>{
    const sn=await tx.get(ref); if(!sn.exists()) return 0;
    const L=(Array.isArray(sn.data().dostawcy)? sn.data().dostawcy : []).map(x=>({...x})); let n=0;
    for(const p of lista){
      const x=L.find(q=>String(q.nazwa).toLowerCase()===String(p.nazwa).toLowerCase());
      if(x){ for(const [k,v] of [["adres",p.adres],["tel",p.tel],["email",p.email]]) if(v && x[k]!==v){ x[k]=v; n++; } if(!x.koop){ x.koop=true; n++; } }
      else { L.push({ nazwa:p.nazwa, adres:p.adres||"", nip:"", tel:p.tel||"", kontakt:p.dzial||"", email:p.email||"", koop:true }); n++; }
    }
    if(!n) return 0;
    L.sort((a,b)=>String(a.nazwa).localeCompare(String(b.nazwa),"pl"));
    tx.update(ref, {dostawcy:L}); return n;
  }).catch(x=>{ console.warn(x); return -1; });
}
function openS(id){
  sId=id; const p=id? sup(id) : null;
  dostUzupelniony=""; wczytajDostawcow();
  $("sTitle").textContent = p? p.nazwa : "Nowy podwykonawca";
  for(const k of SF) $("s_"+k).value = p?.[k]||"";
  $("s_bezAwizacji").checked = !!p?.bezAwizacji;
  const used=P.map(x=>x.kolor); const k0 = p? (p.kolor??7) : ([0,1,2,3,4,5,6].find(c=>!used.includes(c)) ?? 7);
  $("s_kolor").innerHTML=[0,1,2,3,4,5,6,7].map(c=>`<label><input type="radio" name="kolor" value="${c}" ${c===k0?"checked":""} aria-label="Kolor ${c+1}"><span style="background:var(--c${c})"></span></label>`).join("");
  $("sDel").hidden=!p; $("sDelAsk").hidden=true; $("sErr").hidden=true;
  $("dlgS").showModal();
}
const slug = s => normLogin(s).replace(/\./g,"-") || "p";
$("fS").addEventListener("submit", async e=>{
  e.preventDefault();
  const d={}; for(const k of SF) d[k]=$("s_"+k).value.trim();
  d.kolor=+($("fS").querySelector("input[name=kolor]:checked")?.value ?? 7);
  d.bezAwizacji=$("s_bezAwizacji").checked;
  if(!d.nazwa){ $("sErr").textContent="Podaj nazwę podwykonawcy."; $("sErr").hidden=false; return; }
  if(P.some(p=>p.id!==sId && String(p.nazwa).toLowerCase()===d.nazwa.toLowerCase())){ $("sErr").textContent="Taki podwykonawca już jest na liście."; $("sErr").hidden=false; return; }
  const prev=sId? sup(sId):null; d.kolejnosc = prev?.kolejnosc ?? (Math.max(0,...P.map(p=>p.kolejnosc||0))+1);
  let id=sId; if(!id){ id=slug(d.nazwa); if(P.some(p=>p.id===id)) id+="-"+Date.now().toString(36); }
  try{ await setDoc(doc(db,C.p,id), d);
    // otwarte kursy tego podwykonawcy w Truck App: czy logistyka ma przypominać o awizo
    const doZm=Object.entries(KR).filter(([,k])=>!kursZamkniety(k) && Z.some(z=>z.kursId && z.podw===id && KR[z.kursId]===k) && !!k.awizoZbedne!==d.bezAwizacji);
    if(doZm.length){ const b=writeBatch(db); doZm.forEach(([kid])=>b.update(doc(db,"kursy",kid),{awizoZbedne:d.bezAwizacji,zmieniono:serverTimestamp(),zmienil:me.login||""})); await b.commit().catch(x=>console.warn(x)); }
    const tr=await doDostawcowTruckApp([d]);
    toast((prev?"Zapisano dane podwykonawcy":"Dodano podwykonawcę")+(tr>0?" – także na liście dostawców Truck App":tr<0?" (lista dostawców Truck App bez zmian – brak dostępu)":"")); $("dlgS").close(); }catch(x){ failed(x); }
});
$("sDel").onclick=()=>{
  const n=Z.filter(z=>z.podw===sId).length; const a=$("sDelAsk"); a.hidden=false;
  a.innerHTML = n? `Ten podwykonawca ma ${n} zleceń — najpierw je usuń albo przepisz.` : `Usunąć podwykonawcę? <button class="btn sm danger" id="sDelYes" type="button">Tak, usuń</button>`;
  const y=$("sDelYes"); if(y) y.onclick=async()=>{ try{ await deleteDoc(doc(db,C.p,sId)); toast("Usunięto podwykonawcę"); $("dlgS").close(); }catch(x){ failed(x); } };
};
$("fRodz").addEventListener("submit", e=>{ e.preventDefault(); const v=$("newRodz").value.trim(); if(!v) return;
  if(rodzaje.some(r=>r.toLowerCase()===v.toLowerCase())){ toast("Taki rodzaj już jest"); return; } saveRodz([...rodzaje, v]); $("newRodz").value=""; });
async function saveRodz(r){ try{ await setDoc(doc(db,C.u,"slowniki"),{rodzaje:r}); toast("Zapisano listę rodzajów"); }catch(x){ failed(x); } }
// Podwykonawcy z arkusza Excel (kolumny: Nazwa, Osoba / dział, Telefon, Adres odbioru, E-mail, Osoba 2, Telefon 2, E-mail 2).
// Dane kontaktowe są tylko w bazie – nie w kodzie aplikacji (repozytorium jest publiczne).
$("btnSeed").onclick=()=>$("seedFile").click();
$("seedFile").onchange=async e=>{
  const f=e.target.files[0]; e.target.value=""; if(!f) return;
  try{
    await loadXlsx(); const X=window.XLSX;
    const wb=X.read(await f.arrayBuffer()); const aoa=X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false,defval:""});
    const L=podwykonawcyZArkusza(aoa); if(!L.length) throw new Error("W arkuszu nie ma żadnego podwykonawcy.");
    const b=writeBatch(db); let nowi=0, zm=0, kol=Math.max(0,...P.map(p=>p.kolejnosc||0));
    const zajete=new Set(P.map(p=>p.kolor));
    for(const w of L){
      const ist=P.find(p=>String(p.nazwa).toLowerCase()===w.nazwa.toLowerCase());
      const dane=Object.fromEntries(Object.entries(w).filter(([k,v])=>v!==""||k==="nazwa"));
      if(ist){ b.set(doc(db,C.p,ist.id), dane, {merge:true}); zm++; }
      else { let id=slug(w.nazwa); if(P.some(p=>p.id===id)) id+="-"+Date.now().toString(36)+nowi;
        const kolor=[0,1,2,3,4,5,6].find(c=>!zajete.has(c)) ?? 7; zajete.add(kolor);
        b.set(doc(db,C.p,id), {...w, kolor, kolejnosc:++kol}); nowi++; }
    }
    if(!rodzajeZapisane) b.set(doc(db,C.u,"slowniki"), {rodzaje:RODZAJE_DOMYSLNE}, {merge:true});
    await b.commit(); await doDostawcowTruckApp(L);
    toast(`Wczytano z pliku: ${nowi} nowych, ${zm} zaktualizowanych podwykonawców (także na liście dostawców Truck App)`);
  }catch(x){ toast(x.message||String(x)); }
};

/* ---------- eksport CSV (Excel, średnik, polskie znaki) ---------- */
async function exportCsv(){
  try{
    await loadXlsx(); const X=window.XLSX, kwoty=canSeeAmounts();
    const head=["Data odbioru","Dzień","Tydz.","Podwykonawca","Nr / projekt","Element / opis","Rodzaj","Ilość [szt]",...(kwoty?["Wartość [zł]"]:[]),"Status","Odebrano dnia","Alert","Uwagi","Dodał","Dodano","Ostatnio zmienił","Zmieniono"];
    const rows=Z.slice().sort(byDate).map(z=>[fD(z.data), z.data?DNI_K[pd(z.data).getDay()]:"", z.data?isoWeek(z.data):"", supName(z.podw), projOf(z), z.opis||"", z.rodzaj||"", z.ilosc??"",...(kwoty?[kw(z.id)??""]:[]), z.status, fD(z.odebrano), alertOf(z)?.[0]||"", z.uwagi||"", z.utworzylNazwa||"", fTs(z.utworzono), z.zmienilNazwa||"", fTs(z.zmieniono)]);
    const ws=X.utils.aoa_to_sheet([head,...rows]);
    ws["!cols"]=head.map(h=>({wch:/opis|Uwagi/.test(h)?30:h.length<8?8:16}));
    if(kwoty) for(let r=1;r<=rows.length;r++){ const c=ws[X.utils.encode_cell({r,c:8})]; if(c&&c.t==="n") c.z='#,##0.00 "zł"'; }
    const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,"Zlecenia");
    saveBlob(`kooperacje-${today()}.xlsx`, new Blob([X.write(wb,{bookType:"xlsx",type:"array"})],{type:"application/octet-stream"}));
    toast("Pobrano listę zleceń w Excelu");
  }catch(x){ failed(x); }
}

/* ---------- komunikaty ---------- */
function failed(x){
  const c=x&&x.code;
  console.warn(x);
  toast(c==="permission-denied"? "Brak uprawnień do tej operacji." : c==="unavailable"? "Brak połączenia z bazą – spróbuj za chwilę." : "Nie udało się zapisać: "+(x&&x.message||x));
}
let tt; function toast(m){ const t=$("toast"); t.textContent=m; t.hidden=false; clearTimeout(tt); tt=setTimeout(()=>t.hidden=true,3000); }
function note(m, bad){ const n=$("notice"); n.textContent=m||""; n.hidden=!m; n.classList.toggle("bad",!!bad); }

/* ---------- logowanie i dane ---------- */
$("fLogin").addEventListener("submit", async e=>{
  e.preventDefault();
  const l=$("lLogin").value, p=$("lPass").value;
  if(!normLogin(l)||!p){ $("lErr").textContent="Wpisz login i hasło."; $("lErr").hidden=false; return; }
  $("lBtn").disabled=true; $("lErr").hidden=true;
  try{ await signInWithEmailAndPassword(auth, loginEmail(l), p); }
  catch(x){
    const c=x&&x.code;
    $("lErr").textContent = (c==="auth/invalid-credential"||c==="auth/wrong-password"||c==="auth/user-not-found"||c==="auth/invalid-email")? "Zły login lub hasło."
      : c==="auth/too-many-requests"? "Za dużo prób. Odczekaj chwilę i spróbuj ponownie."
      : c==="auth/network-request-failed"? "Brak połączenia z internetem." : "Nie udało się zalogować ("+(c||x)+").";
    $("lErr").hidden=false;
  } finally { $("lBtn").disabled=false; }
});
const doOut=()=>signOut(auth);
$("btnOut").onclick=doOut; $("msgOut").onclick=doOut;

function stopSubs(){ subs.forEach(u=>{try{u();}catch{}}); subs=[]; }
function startData(){
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
  WER={};
  if(canSeeAmounts()) subs.push(onSnapshot(doc(db,C.u,"weryfikacje"), s=>{ WER=s.exists()? s.data() : {}; renderAlerts(); if(tab==="weryfikacja") renderVer(false); }, x=>console.warn(x)));
  subs.push(onSnapshot(doc(db,C.u,"slowniki"), s=>{ rodzajeZapisane=s.exists(); if(s.exists() && Array.isArray(s.data().rodzaje)) rodzaje=s.data().rodzaje.slice(); render(); }, lost));
}

let userUnsub=null, metaUnsub=null, adminUid="";
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
    const k=konto;
    if(!k) return deny("To konto nie ma dostępu do aplikacji.");
    if(k.rola!=="biuro") return deny("Kooperacje są dostępne tylko dla kont biura.");
    if(k.aktywny===false) return deny("To konto jest zablokowane w Truck App.");
    isAdmin = adminUid===u.uid;
    isBuyer = k.koopZakupowiec===true;
    if(k.kooperacje===false && !isAdmin) return deny("To konto nie ma dostępu do Kooperacji. Dostęp nadaje administrator w zakładce Dostęp.");
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
