// Kooperacje: weryfikacja kosztów z pliku przyjęć na magazyn


import { doc, serverTimestamp, writeBatch, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { today, fD, fDs, dniMiedzy, esc, plural, projOf, normTxt, cellDate, cellNum, matchSup as matchSupL, dopasujPZ, idKosztu } from "../logika.js?v=2";

import { C, KO, P, PROJ, Z, byDate, db, fTs, failed, me, supColor, supName, toast, verMonth } from '../app.js?v=3';
import { $ } from './stale.js?v=3';
import { kw, loadXlsx, miesNazwa, r2, saveBlob, zl2 } from './pliki.js?v=3';

/* ---------- weryfikacja kosztów z pliku przyjęć na magazyn ---------- */
export const VER={plik:"",rows:[],months:[],ym:"",manual:{},res:null};
export let WER={};
export const ustawWER = v => { WER = v; };   // koop_ustawienia/weryfikacje: m_RRRR-MM → {czas, kto, plik}
export const KOL={numer:["NUMER"],data:["DATA PRZYJECIA","DATA"],dost:["DOSTAWCA ODBIORCA SYMBOL","DOSTAWCA","KONTRAHENT"],netto:["WARTOSC NETTO","NETTO"],uwagi:["UWAGI"]};
export async function readVerFile(file){
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
export const matchSup = dost => matchSupL(dost, P);
export const znaneKody = () => [...new Set([...PROJ.map(p=>p.kod), ...Z.map(z=>z.nr), ...Z.map(z=>z.projekt)].filter(Boolean))];
export function computeVer(){
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
export const VST={ok:["p-ok","zgodne"],roznica:["p-warn","różnica"],brak:["p-bad","brak kwoty"],bezpz:["p-bad","bez przyjęcia PZ"],nokw:["p-idle","brak kwoty w pliku"]};
export function renderVer(zapisz){
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
export const IST={nowe:["p-warn","nowe"],zapisane:["p-ok","zapisane"],zmiana:["p-warn","inna kwota / projekt"]};
export function renderInne(V_){
  const box=$("vInneBox"); box.hidden=!V_.inne.length; if(!V_.inne.length) return;
  const nowe=V_.inne.filter(x=>x.st!=="zapisane");
  $("vInneInfo").textContent=`${V_.inne.length} ${plural(V_.inne.length,"pozycja","pozycje","pozycji")} · ${zl2(V_.sumInne)} zł netto · ${nowe.length? nowe.length+" do zapisania" : "wszystkie zapisane"}`;
  $("vInneRows").innerHTML=V_.inne.map(x=>{ const [cl,lb]=IST[x.st];
    return `<tr><td><b class="mono">${esc(x.projekt)}</b><br><span class="small">${esc(x.rodzaj)}</span></td><td class="mono">${esc(x.r.pz)}<br><span class="small">${fD(x.r.data)}</span></td><td>${esc(x.r.dost)}</td><td>${esc(x.r.uwagi)}</td>
      <td class="num">${x.r.netto==null?"—":zl2(x.r.netto)+" zł"}</td><td><span class="pill ${cl}">${lb}</span></td><td>${x.st!=="zapisane"?`<button class="btn sm" type="button" data-iset="${esc(x.id)}">Zapisz</button>`:`<button class="btn sm ghost" type="button" data-idel="${esc(x.id)}">Usuń</button>`}</td></tr>`; }).join("")
    + `<tr class="tot"><td colspan="4">Razem inne koszty · ${esc(miesNazwa(V_.ym))}</td><td class="num">${zl2(V_.sumInne)} zł</td><td colspan="2">${nowe.length?`<button class="btn sm primary" type="button" id="vInneAll">Zapisz wszystkie (${nowe.length})</button>`:""}</td></tr>`;
}
export async function inneSet(ids){
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
export async function verSet(ids){
  const L=VER.res.all.filter(x=>ids.includes(x.z.id) && x.plik!=null);
  try{
    const b=writeBatch(db);
    L.forEach(x=>b.set(doc(db,C.v,x.z.id),{wartosc:x.plik,pz:x.pz.map(r=>r.pz),zrodlo:"weryfikacja",zmieniono:serverTimestamp(),zmienil:me.uid,zmienilNazwa:me.nazwa||me.login},{merge:true}));
    await b.commit(); toast(L.length===1?"Wpisano kwotę z pliku":`Wpisano ${L.length} kwot z pliku`);
  }catch(x){ failed(x); }
}
export async function verXlsx(){
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
