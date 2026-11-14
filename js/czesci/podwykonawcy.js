// Kooperacje: podwykonawcy, rodzaje i eksport CSV


import { doc, runTransaction, serverTimestamp, getDoc, writeBatch, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { normLogin, today, pd, isoWeek, fD, esc, projOf, kursZamkniety, podwykonawcyZArkusza } from "../logika.js?v=3";

import { C, DNI_K, KR, P, RODZAJE_DOMYSLNE, Z, alertOf, byDate, canSeeAmounts, db, fTs, failed, me, rodzaje, rodzajeZapisane, sup, supName, toast } from '../app.js?v=4';
import { $ } from './stale.js?v=4';
import { kw, loadXlsx, saveBlob } from './pliki.js?v=4';

/* ---------- podwykonawcy / rodzaje (administrator) ---------- */
export let sId=null;
export const SF=["nazwa","dzial","tel","adres","email","osoba2","tel2","email2","symbolMag"];
/* Wspólna lista z Truck App: podwykonawca zapisany tutaj trafia też do dostawców logistyki (ustawienia/glowne.dostawcy),
   żeby biuro miało jego adres i telefon w formularzu kursu; przy dodawaniu można wybrać firmę z listy dostawców Truck App. */
export let DOST=[];   // dostawcy z Truck App (do podpowiedzi)
export async function wczytajDostawcow(){
  try{ const sn=await getDoc(doc(db,"ustawienia","glowne")); DOST=sn.exists() && Array.isArray(sn.data().dostawcy)? sn.data().dostawcy : []; }catch{ DOST=[]; }
  $("dostLista").innerHTML=DOST.filter(x=>x.nazwa && !P.some(p=>String(p.nazwa).toLowerCase()===String(x.nazwa).toLowerCase())).map(x=>`<option value="${esc(x.nazwa)}">${esc(x.adres||"")}</option>`).join("");
}
export let dostUzupelniony="";
$("s_nazwa").addEventListener("change",()=>{
  const x=DOST.find(q=>String(q.nazwa).toLowerCase()===$("s_nazwa").value.trim().toLowerCase()); if(!x || dostUzupelniony===x.nazwa) return;
  dostUzupelniony=x.nazwa;
  const uzup=(id,v)=>{ if(v && !$(id).value.trim()) $(id).value=v; };
  uzup("s_adres",x.adres); uzup("s_tel",x.tel||(/\d{3}/.test(x.kontakt||"")?x.kontakt:"")); uzup("s_email",x.email);
  toast("Uzupełniono dane z listy dostawców Truck App");
});
export async function doDostawcowTruckApp(lista){
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
export function openS(id){
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
export const slug = s => normLogin(s).replace(/\./g,"-") || "p";
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
export async function saveRodz(r){ try{ await setDoc(doc(db,C.u,"slowniki"),{rodzaje:r}); toast("Zapisano listę rodzajów"); }catch(x){ failed(x); } }
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
export async function exportCsv(){
  try{
    await loadXlsx(); const X=window.XLSX, kwoty=canSeeAmounts();
    const head=["Data odbioru","Dzień","Tydz.","Podwykonawca","Nr / projekt","Element / opis","Rodzaj","Ilość [szt]","Z naszego materiału",...(kwoty?["Wartość [zł]"]:[]),"Status","Odebrano dnia","Alert","Uwagi","Dodał","Dodano","Ostatnio zmienił","Zmieniono"];
    const rows=Z.slice().sort(byDate).map(z=>[fD(z.data), z.data?DNI_K[pd(z.data).getDay()]:"", z.data?isoWeek(z.data):"", supName(z.podw), projOf(z), z.opis||"", z.rodzaj||"", z.ilosc??"", z.naszMat?"Tak":"",...(kwoty?[kw(z.id)??""]:[]), z.status, fD(z.odebrano), alertOf(z)?.[0]||"", z.uwagi||"", z.utworzylNazwa||"", fTs(z.utworzono), z.zmienilNazwa||"", fTs(z.zmieniono)]);
    const ws=X.utils.aoa_to_sheet([head,...rows]);
    ws["!cols"]=head.map(h=>({wch:/opis|Uwagi/.test(h)?30:h.length<8?8:16}));
    if(kwoty) for(let r=1;r<=rows.length;r++){ const c=ws[X.utils.encode_cell({r,c:9})]; if(c&&c.t==="n") c.z='#,##0.00 "zł"'; }
    const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,"Zlecenia");
    saveBlob(`kooperacje-${today()}.xlsx`, new Blob([X.write(wb,{bookType:"xlsx",type:"array"})],{type:"application/octet-stream"}));
    toast("Pobrano listę zleceń w Excelu");
  }catch(x){ failed(x); }
}
